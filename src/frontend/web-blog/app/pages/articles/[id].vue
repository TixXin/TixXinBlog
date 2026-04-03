<!--
  @file [id].vue
  @description 文章详情页：正文、目录、评论与相关推荐
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
    <CommonReadingProgress :progress="progress" />
    <CommonCustomScrollbar ref="scrollbarRef" class="article-page" viewport-class="article-viewport" show-back-to-top>
      <ArticleStickyHeader
        :title="article.title"
        :category="article.category"
        :date="article.date"
        :read-time="article.readTime"
      />
      <div class="article-page__inner">
        <div v-if="!coverError" class="article-page__cover-wrap">
          <NuxtImg
            :src="article.cover"
            :alt="article.title"
            class="article-page__cover"
            fetchpriority="high"
            format="webp"
            @error="coverError = true"
          />
        </div>
        <div class="article-page__stats">
          <span class="article-page__stat">
            <Icon name="lucide:eye" size="14" />
            {{ formatCount(article.views) }}
          </span>
          <span class="article-page__stat">
            <Icon name="lucide:heart" size="14" />
            {{ article.likes }}
          </span>
          <span class="article-page__stat">
            <Icon name="lucide:message-circle" size="14" />
            {{ article.comments }}
          </span>
        </div>
        <ArticleContent :sections="article.content" />
        <ArticleNav />
        <ArticleCommentSection :comments="comments" />
      </div>
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <ArticleTableOfContents :items="tocItems" :active-id="activeId" />
          <ArticleRelatedPosts :posts="relatedPosts" />
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

const {
  article,
  comments,
  relatedPosts,
  tocItems,
  articleExcerpt,
} = useArticleDetail(route.params.id as string)

const { progress } = useReadingProgress(scrollRoot)
const { activeId } = useTableOfContents(tocItems.value)

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
      innerHTML: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.value.title,
        'image': article.value.cover,
        'datePublished': article.value.date,
        'author': {
          '@type': 'Person',
          'name': 'TixXin',
          'url': 'https://tixxin.dev',
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'TixXin Blog',
        },
        'description': articleExcerpt.value,
      })),
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
}
</style>
