<!--
  @file [id].vue
  @description 文章详情页：正文、目录、评论与相关推荐
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner article-detail-page">
    <Teleport to="body">
      <CommonReadingProgress :progress="progress" />
    </Teleport>
    <CommonCustomScrollbar
      ref="scrollbarRef"
      class="article-page"
      viewport-class="article-viewport"
      :show-back-to-top="false"
      primary
    >
      <ArticleStickyHeader
        :title="article.title"
        :category="article.category"
        :date="article.date"
        :read-time="article.readTime"
      />
      <div class="article-page__inner">
        <ArticleReadingResume
          v-if="resumeProgress !== null"
          :progress="resumeProgress"
          :read-time="article.readTime"
          @resume="resumeReading"
        />
        <p v-if="isMockArticle" class="article-page__demo-note">
          {{ $t('article.detail.demoNote') }}
        </p>
        <div v-if="article.cover" class="article-page__cover-wrap">
          <CommonContentImage
            :src="article.cover"
            :alt="article.coverAlt || article.title"
            class="article-page__cover"
            fetchpriority="high"
            format="webp"
            width="800"
            height="320"
            sizes="(min-width: 640px) 80vw, 100vw"
          />
        </div>
        <ArticleStatsBar
          :views="articleViews"
          :likes="articleLikes"
          :liked="articleLiked"
          :interaction-pending="interactionPending"
          :interaction-loaded="interactionLoaded"
          :favorited="isFavorited(article.id)"
          :total-comments="total"
          :article-title="article.title"
          :canonical-url="canonicalUrl"
          @toggle-like="toggleArticleLike"
          @toggle-favorite="toggleFavorite(article.id)"
        />
        <CommonRequestFeedback
          v-if="interactionError"
          :title="interactionError"
          :pending="interactionPending"
          compact
          @retry="reloadInteraction"
        />
        <div ref="readingContent" class="article-reading-content">
          <ArticleMarkdown v-if="article.contentRaw" :content="article.contentRaw" :title="article.title" />
          <!-- 结构化正文含代码高亮（Shiki），懒加载使其不进入文章页首屏 chunk -->
          <LazyArticleContent v-else :sections="article.content ?? []" />
        </div>
        <CommonRelatedContent :items="article.relatedContent" />
        <ArticleNav
          :prev="navigation.prev"
          :next="navigation.next"
          :folder="navigationFolder"
          :error="discoveryError"
          :pending="discoveryPending"
          @retry="retryDiscovery"
        />
        <ArticleCommentSection
          v-model="draft"
          :comments="comments"
          :total="total"
          :reply-target="replyTarget"
          :submitting="submitting"
          :loading="loading"
          :busy="busy"
          :can-submit="canSubmit"
          :submit-error="submitError"
          :submit-notice="submitNotice"
          :load-error="loadError"
          :like-error="likeError"
          :pending-likes="pendingLikes"
          @submit="submit"
          @reply="reply"
          @cancel-reply="cancelReply"
          @like="like"
          @retry="reload"
        />
        <CommonGuestIdentityModal
          :visible="identityVisible"
          @confirm="submit()"
          @cancel="identityVisible = false"
          @login="switchToLogin"
        />
      </div>
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="body">
        <CommonContextDrawer
          v-if="tocItems.length && needsCompactToc"
          v-slot="{ close }"
          class="article-toc-entry"
          :label="$t('article.toc.title')"
          icon="lucide:list"
        >
          <ArticleTableOfContents :items="tocItems" :active-id="activeId" :progress="progress" @navigate="close" />
        </CommonContextDrawer>
      </Teleport>
    </ClientOnly>
    <Teleport to="#right-sidebar-target">
      <SidebarRightSidebar>
        <ArticleTableOfContents :items="tocItems" :active-id="activeId" :progress="progress" />
        <ArticleRelatedPosts :posts="relatedPosts" />
        <SidebarReadingHistoryCard />
        <AboutDonateCard />
      </SidebarRightSidebar>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { useArticleDetailSeo } from '~/features/article/useArticleDetailSeo'

const route = useRoute()
const { currentThemeId, switchingState } = useLayoutTheme()
const nexusSidebarVisible = useMediaQuery('(min-width: 1440px)')
const auroraSidebarVisible = useMediaQuery('(min-width: 1280px)')
const needsCompactToc = computed(
  () =>
    currentThemeId.value === 'dock' ||
    (currentThemeId.value === 'nexus' ? !nexusSidebarVisible.value : !auroraSidebarVisible.value),
)
const isMockArticle = useRuntimeConfig().public.postUseMockRepo !== false
const scrollbarRef = ref<{ viewport: HTMLElement | null } | null>(null)
const readingContent = ref<HTMLElement | null>(null)
const scrollRoot = computed(() => scrollbarRef.value?.viewport ?? null)

const requestScope = usePageRequestScope()
const routeArticleId = route.params.id as string
// 数字地址的评论与详情同时读取；自定义地址需等详情解析出文章 ID 后再读。
const earlyComments = isNumericArticleId(routeArticleId) ? useArticleComments(routeArticleId) : undefined
// 详情失败时页面直接抛错，提前发起的评论结果被丢弃，这里只避免未处理的拒绝。
earlyComments?.catch(() => undefined)
const {
  article,
  relatedPosts,
  navigation,
  navigationFolder,
  discoveryError,
  discoveryPending,
  retryDiscovery,
  tocItems,
  articleExcerpt,
} = await useArticleDetail(routeArticleId, { reuseLoaded: switchingState.value === 'loading' })
requestScope.assertActive()
const canonicalPath = articlePath(article.value)
if (route.path !== canonicalPath)
  await navigateTo({ path: canonicalPath, query: route.query, hash: route.hash }, { redirectCode: 301, replace: true })
requestScope.assertActive()
const publicSite = useSiteUrl()
const { settings: siteSettings } = useSiteSettings()
const canonicalUrl = computed(() => `${publicSite}${articlePath(article.value)}`)

useArticleDetailSeo({
  article,
  articleExcerpt,
  canonicalUrl,
  publicSite,
  siteSettings,
})

const {
  comments,
  total,
  draft,
  replyTarget,
  submitting,
  loading,
  busy,
  canSubmit,
  submitError,
  submitNotice,
  loadError,
  likeError,
  pendingLikes,
  identityVisible,
  submit,
  reply,
  cancelReply,
  like,
  reload,
} = await (earlyComments ?? useArticleComments(article.value.id))
requestScope.assertActive()
const { open: openLoginDrawer } = useLoginDrawer()
function switchToLogin() {
  identityVisible.value = false
  openLoginDrawer('login', true)
}
const { isFavorited, toggleFavorite } = useLikes()
const {
  likes: articleLikes,
  views: articleViews,
  liked: articleLiked,
  pending: interactionPending,
  loaded: interactionLoaded,
  error: interactionError,
  toggle: toggleArticleLike,
  load: reloadInteraction,
} = useArticleInteraction(article.value.id, article.value)
const { addToHistory } = useReadingHistory()

const { progress, resumeProgress, resumeReading } = useReadingProgress(
  scrollRoot,
  readingContent,
  () => article.value.id,
)
const { activeId } = useTableOfContents(() => tocItems.value)

onMounted(() => {
  addToHistory({
    id: article.value.id,
    title: article.value.title,
    cover: article.value.cover,
    date: article.value.date,
  })
})
</script>

<style lang="scss" scoped>
.article-page__demo-note {
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  color: var(--text-soft);
  font-size: 0.875rem;
}
.article-page {
  flex: 1;
  min-height: 0;
}
.article-toc-entry {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: calc(6rem + env(safe-area-inset-bottom));
  z-index: 55;
  box-shadow: var(--shadow-card);
  border-radius: $radius-md;
}

.article-page__inner {
  // 顶部与粘性页头分隔线留出间距，封面不再贴线；底部加厚缓冲，避免评论框滚到底时紧贴 dock
  padding: 1.5rem 2rem 4rem;
  @media (max-width: 480px) {
    padding: 1rem 0.75rem 5rem;
  }
}

.article-page__cover-wrap {
  width: 100%;
  height: 240px;
  border-radius: $radius-md;
  overflow: hidden;
  margin-bottom: 1.5rem;

  @media (min-width: $breakpoint-sm) {
    height: 320px;
  }
}

.article-page__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
