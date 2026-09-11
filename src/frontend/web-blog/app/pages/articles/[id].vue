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
            aria-label="点赞文章"
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
            <CommonShareButtons :title="article.title" class="article-page__share" />
          </ClientOnly>
        </div>
        <p v-if="interactionError" role="alert">
          {{ interactionError }} <button type="button" @click="reloadInteraction">重试</button>
        </p>
        <div ref="readingContent" class="article-reading-content">
          <ArticleMarkdown v-if="article.contentRaw" :content="article.contentRaw" />
          <ArticleContent v-else :sections="article.content" />
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
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <ArticleTableOfContents :items="tocItems" :active-id="activeId" :progress="progress" />
          <ArticleRelatedPosts :posts="relatedPosts" />
          <SidebarReadingHistoryCard />
          <AboutDonateCard />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
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
const { article, relatedPosts, navigation, discoveryError, tocItems, articleExcerpt } = await useArticleDetail(
  route.params.id as string,
  { reuseLoaded: switchingState.value === 'loading' },
)
requestScope.assertActive()
const canonicalPath = articlePath(article.value)
if (route.path !== canonicalPath)
  await navigateTo({ path: canonicalPath, query: route.query, hash: route.hash }, { redirectCode: 301, replace: true })
requestScope.assertActive()
const publicSite = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
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
} = await useArticleComments(article.value.id)
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

useSeoMeta({
  title: () => article.value.seoTitle || article.value.title,
  description: () => seoDescription.value,
  ogTitle: () => article.value.seoTitle || article.value.title,
  ogDescription: () => seoDescription.value,
  ogType: 'article',
  ogUrl: () => canonicalUrl.value,
  robots: () => (article.value.seoNoindex ? 'noindex, follow' : 'index, follow'),
  ogImage: () => article.value.cover,
  twitterCard: 'summary_large_image',
  twitterTitle: () => article.value.seoTitle || article.value.title,
  twitterDescription: () => seoDescription.value,
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.value.title,
          image: article.value.cover,
          datePublished: article.value.date,
          author: {
            '@type': 'Person',
            name: siteSettings.value.ownerName,
            url: publicSite,
          },
          publisher: {
            '@type': 'Organization',
            name: siteSettings.value.name,
          },
          description: seoDescription.value,
          mainEntityOfPage: canonicalUrl.value,
        }).replace(/</g, String.fromCharCode(92) + 'u003c'),
      ),
    },
  ],
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
  // 底部加厚缓冲，避免评论框滚到底时紧贴 dock
  padding: 0 2rem 4rem;
  @media (max-width: 480px) {
    padding: 0 0.75rem 5rem;
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

.article-page__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-soft);
}

.article-page__stat {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;

  &--btn {
    border: none;
    background: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
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
</style>
