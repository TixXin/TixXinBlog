<!--
  @file [id].vue
  @description 文章详情页：正文、目录、评论与相关推荐
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
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
        <p v-if="isMockArticle" class="article-page__demo-note">
          演示文章：正文为通用排版示例，不代表标题对应的正式内容。
        </p>
        <div v-if="article.cover" class="article-page__cover-wrap">
          <CommonContentImage
            v-if="!coverError"
            :src="article.cover"
            :alt="article.coverAlt || article.title"
            class="article-page__cover"
            fetchpriority="high"
            format="webp"
            width="800"
            height="320"
            sizes="(min-width: 640px) 80vw, 100vw"
            @error="coverError = true"
          />
          <div v-else class="article-page__cover-fallback">
            <Icon name="lucide:image-off" size="32" />
            <span>封面加载失败</span>
          </div>
        </div>
        <div class="article-page__stats">
          <span class="article-page__stat">
            <Icon name="lucide:eye" size="14" />
            {{ formatCount(articleViews) }}
          </span>
          <button
            type="button"
            class="article-page__stat article-page__stat--btn"
            :class="{ 'is-liked': articleLiked }"
            :disabled="interactionPending || !interactionLoaded"
            :aria-pressed="articleLiked"
            :aria-label="`点赞文章，${articleLikes} 个赞`"
            @click="toggleArticleLike"
          >
            <Icon :name="'lucide:heart'" size="14" />
            {{ articleLikes }}
          </button>
          <button
            type="button"
            class="article-page__stat article-page__stat--btn"
            :class="{ 'is-favorited': isFavorited(article.id) }"
            :aria-pressed="isFavorited(article.id)"
            @click="toggleFavorite(article.id)"
          >
            <Icon :name="isFavorited(article.id) ? 'lucide:bookmark-check' : 'lucide:bookmark'" size="14" />
            {{ isFavorited(article.id) ? '已收藏' : '收藏' }}
          </button>
          <span class="article-page__stat">
            <Icon name="lucide:message-circle" size="14" />
            {{ total }}
          </span>
          <ClientOnly>
            <CommonShareButtons :title="article.title" :url="canonicalUrl" class="article-page__share" />
          </ClientOnly>
        </div>
        <p v-if="interactionError" role="alert" class="article-page__inline-error">
          {{ interactionError }}
          <button type="button" @click="reloadInteraction">重试</button>
        </p>
        <div ref="readingContent" class="article-reading-content">
          <ArticleMarkdown v-if="article.contentRaw" :content="article.contentRaw" :title="article.title" />
          <!-- 结构化正文含代码高亮（Shiki），懒加载使其不进入文章页首屏 chunk -->
          <LazyArticleContent v-else :sections="article.content ?? []" />
        </div>
        <CommonRelatedContent :items="article.relatedContent" />
        <ArticleNav :prev="navigation.prev" :next="navigation.next" :error="discoveryError" />
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
          @confirm="submit"
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
          label="文章目录"
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
import { absoluteUrl } from '~/utils/absoluteUrl'
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
const coverError = ref(false)
const scrollbarRef = ref<{ viewport: HTMLElement | null } | null>(null)
const readingContent = ref<HTMLElement | null>(null)
const scrollRoot = computed(() => scrollbarRef.value?.viewport ?? null)

const requestScope = usePageRequestScope()
const routeArticleId = route.params.id as string
// 数字地址的评论与详情同时读取；自定义地址需等详情解析出文章 ID 后再读。
const earlyComments = isNumericArticleId(routeArticleId) ? useArticleComments(routeArticleId) : undefined
// 详情失败时页面直接抛错，提前发起的评论结果被丢弃，这里只避免未处理的拒绝。
earlyComments?.catch(() => undefined)
const { article, relatedPosts, navigation, discoveryError, tocItems, articleExcerpt } = await useArticleDetail(
  routeArticleId,
  { reuseLoaded: switchingState.value === 'loading' },
)
requestScope.assertActive()
const canonicalPath = articlePath(article.value)
if (route.path !== canonicalPath)
  await navigateTo({ path: canonicalPath, query: route.query, hash: route.hash }, { redirectCode: 301, replace: true })
requestScope.assertActive()
const publicSite = useSiteUrl()
const { settings: siteSettings } = useSiteSettings()
const canonicalUrl = computed(() => `${publicSite}${articlePath(article.value)}`)
const seoDescription = computed(() => article.value.seoDescription || articleExcerpt.value)
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

const { progress } = useReadingProgress(scrollRoot, readingContent)
const { activeId } = useTableOfContents(() => tocItems.value)

onMounted(() => {
  addToHistory({
    id: article.value.id,
    title: article.value.title,
    cover: article.value.cover,
    date: article.value.date,
  })
})

function formatCount(n: number) {
  return n.toLocaleString('zh-CN')
}

usePageSeo({
  title: () => article.value.seoTitle || article.value.title,
  description: () => seoDescription.value,
  type: 'article',
  canonical: () => canonicalUrl.value,
  image: () => article.value.cover,
  imageAlt: () => article.value.coverAlt || article.value.title,
  // 可索引时不写 robots，保留模块默认的 max-image-preview 等指令
  robots: () => (article.value.seoNoindex ? 'noindex, follow' : undefined),
})
const articleTags = computed(() => (article.value.tags ?? []).map((tag) => tag.label))
useSeoMeta({
  articlePublishedTime: () => article.value.date || undefined,
  articleModifiedTime: () => article.value.updatedAt || undefined,
  articleSection: () => article.value.category || undefined,
  articleTag: () => (articleTags.value.length ? articleTags.value : undefined),
})
useHead({
  meta: () => (articleTags.value.length ? [{ name: 'keywords', content: articleTags.value.join(',') }] : []),
})

const articleImage = computed(() => absoluteUrl(article.value.cover, publicSite))
const authorName = computed(() => siteSettings.value.ownerName || siteSettings.value.name)
useJsonLd('article', () => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: article.value.seoTitle || article.value.title,
  description: seoDescription.value,
  url: canonicalUrl.value,
  mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl.value },
  ...(articleImage.value ? { image: [articleImage.value] } : {}),
  datePublished: article.value.date,
  ...(article.value.updatedAt ? { dateModified: article.value.updatedAt } : {}),
  ...(articleTags.value.length ? { keywords: articleTags.value.join(',') } : {}),
  ...(article.value.category ? { articleSection: article.value.category } : {}),
  inLanguage: 'zh-CN',
  author: { '@type': 'Person', name: authorName.value, url: publicSite + '/about' },
  publisher: { '@type': 'Person', name: authorName.value, url: publicSite + '/' },
}))
useJsonLd('breadcrumb', () => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首页', item: publicSite + '/' },
    ...(article.value.category
      ? [
          {
            '@type': 'ListItem',
            position: 2,
            name: article.value.category,
            item: `${publicSite}/?category=${encodeURIComponent(article.value.category)}`,
          },
        ]
      : []),
    {
      '@type': 'ListItem',
      position: article.value.category ? 3 : 2,
      name: article.value.title,
      item: canonicalUrl.value,
    },
  ],
}))
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

.article-page__cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--surface-2);
  color: var(--text-faint);
  font-size: 0.8125rem;
}

/* 统计项统一内边距，整行左移同等距离，让首项图标与正文左缘对齐、各项间距一致 */
.article-page__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.5rem -0.5rem;
  font-size: 0.8125rem;
  color: var(--text-soft);
}

.article-page__stat {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;

  &--btn {
    border: none;
    background: none;
    cursor: var(--interaction-cursor, pointer);
    border-radius: $radius-sm;
    transition: $transition-fast;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    font-size: inherit;
    color: inherit;

    &:hover {
      background: var(--surface-2);
      color: var(--text-main);
    }

    &.is-liked {
      color: #ef4444;
    }

    &.is-favorited {
      color: var(--accent-text);
    }
  }
}

.article-page__share {
  margin-left: auto;
}

.article-page__inline-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: -0.75rem 0 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-soft);

  button {
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: $radius-md;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: var(--interaction-cursor, pointer);

    &:hover {
      color: var(--text-main);
    }
  }
}
</style>
