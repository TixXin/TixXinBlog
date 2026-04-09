<!--
  @file [id].vue
  @description 文章详情页：正文、目录、评论与相关推荐
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
    <CommonReadingProgress :progress="progress" />
    <CommonCustomScrollbar ref="scrollbarRef" class="article-page" viewport-class="article-viewport" :show-back-to-top="false" primary>
      <ArticleStickyHeader
        :title="article.title"
        :category="article.category"
        :date="article.date"
        :read-time="article.readTime"
      />
      <div class="article-page__inner">
        <div class="article-page__cover-wrap">
          <NuxtImg
            v-if="!coverError"
            :src="article.cover"
            :alt="article.title"
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
            {{ formatCount(article.views) }}
          </span>
          <button
            type="button"
            class="article-page__stat article-page__stat--btn"
            :class="{ 'is-liked': isLiked(article.id) }"
            @click="toggleLike(article.id)"
          >
            <Icon :name="isLiked(article.id) ? 'lucide:heart' : 'lucide:heart'" size="14" />
            {{ article.likes + (isLiked(article.id) ? 1 : 0) }}
          </button>
          <button
            type="button"
            class="article-page__stat article-page__stat--btn"
            :class="{ 'is-favorited': isFavorited(article.id) }"
            @click="toggleFavorite(article.id)"
          >
            <Icon :name="isFavorited(article.id) ? 'lucide:bookmark-check' : 'lucide:bookmark'" size="14" />
            {{ isFavorited(article.id) ? '已收藏' : '收藏' }}
          </button>
          <span class="article-page__stat">
            <Icon name="lucide:message-circle" size="14" />
            {{ article.comments }}
          </span>
          <ClientOnly>
            <CommonShareButtons :title="article.title" class="article-page__share" />
          </ClientOnly>
        </div>
        <ArticleContent :sections="article.content" />
        <ArticleNav />
        <ArticleCommentSection :comments="comments" @submit="(c) => comments.unshift(c)" />
      </div>
    </CommonCustomScrollbar>
    <ClientOnly>
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
const route = useRoute()
const coverError = ref(false)
const scrollbarRef = ref<{ viewport: HTMLElement | null } | null>(null)
const scrollRoot = computed(() => scrollbarRef.value?.viewport ?? null)

const { article, comments, relatedPosts, tocItems, articleExcerpt } = useArticleDetail(route.params.id as string)
const { isLiked, toggleLike, isFavorited, toggleFavorite } = useLikes()
const { addToHistory } = useReadingHistory()

const { progress } = useReadingProgress(scrollRoot)
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
  title: () => article.value.title,
  description: () => articleExcerpt.value,
  ogTitle: () => `${article.value.title} - TixXin Blog`,
  ogDescription: () => articleExcerpt.value,
  ogType: 'article',
  ogImage: () => article.value.cover,
  twitterCard: 'summary_large_image',
  twitterTitle: () => `${article.value.title} - TixXin Blog`,
  twitterDescription: () => articleExcerpt.value,
})

useHead({
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
            name: 'TixXin',
            url: 'https://tixxin.dev',
          },
          publisher: {
            '@type': 'Organization',
            name: 'TixXin Blog',
          },
          description: articleExcerpt.value,
        }),
      ),
    },
  ],
})
</script>

<style lang="scss" scoped>
.article-page {
  flex: 1;
  min-height: 0;
}

.article-page__inner {
  padding: 0 2rem 2rem;
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
    transition: all 0.2s;
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
      color: var(--accent);
    }
  }
}

.article-page__share {
  margin-left: auto;
}
</style>
