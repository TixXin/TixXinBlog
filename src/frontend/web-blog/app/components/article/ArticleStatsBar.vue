<!-- @file ArticleStatsBar.vue @description 文章详情页阅读量、点赞、收藏、评论计数与分享按钮组 -->
<template>
  <div class="article-page__stats">
    <span class="article-page__stat">
      <Icon name="lucide:eye" size="14" />
      {{ formatCount(views) }}
    </span>
    <button
      type="button"
      class="article-page__stat article-page__stat--btn"
      :class="{ 'is-liked': liked }"
      :disabled="interactionPending || !interactionLoaded"
      :aria-pressed="liked"
      :aria-label="$t('article.detail.likeLabel', { count: likes }, likes)"
      @click="emit('toggleLike')"
    >
      <Icon name="lucide:heart" size="14" />
      {{ likes }}
    </button>
    <button
      type="button"
      class="article-page__stat article-page__stat--btn"
      :class="{ 'is-favorited': favorited }"
      :aria-pressed="favorited"
      @click="emit('toggleFavorite')"
    >
      <Icon :name="favorited ? 'lucide:bookmark-check' : 'lucide:bookmark'" size="14" />
      {{ favorited ? $t('article.detail.favorited') : $t('article.detail.favorite') }}
    </button>
    <span class="article-page__stat">
      <Icon name="lucide:message-circle" size="14" />
      {{ totalComments }}
    </span>
    <ClientOnly>
      <CommonShareButtons :title="articleTitle" :url="canonicalUrl" class="article-page__share" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { formatNumber } from '~/utils/format'

defineProps<{
  views: number
  likes: number
  liked: boolean
  interactionPending: boolean
  interactionLoaded: boolean
  favorited: boolean
  totalComments: number
  articleTitle: string
  canonicalUrl: string
}>()

const emit = defineEmits<{
  (e: 'toggleLike' | 'toggleFavorite'): void
}>()

function formatCount(n: number) {
  return formatNumber(n)
}
</script>

<style lang="scss" scoped>
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
</style>
