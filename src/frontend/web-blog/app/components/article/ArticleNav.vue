<!--
  @file ArticleNav.vue
  @description 文章详情页上一篇 / 下一篇导航卡片
  @author TixXin
  @since 2026-03-20
-->

<template>
  <nav class="article-nav" :aria-label="folder ? `${folder}专栏的相邻文章` : '相邻文章'">
    <p v-if="folder" class="article-nav__folder">同专栏 · {{ folder }}</p>
    <CommonRequestFeedback
      v-if="error"
      class="article-nav__error"
      title="部分文章信息加载失败"
      description="请重试加载相邻文章和相关推荐。"
      :pending="pending"
      compact
      @retry="$emit('retry')"
    />
    <NuxtLink v-if="prev" :to="articlePath(prev)" class="article-nav__card article-nav__card--prev">
      <Icon name="lucide:chevron-left" size="20" class="article-nav__icon" aria-hidden="true" />
      <div class="article-nav__text">
        <p class="article-nav__label">上一篇</p>
        <p class="article-nav__title">{{ prev.title }}</p>
      </div>
    </NuxtLink>
    <NuxtLink v-if="next" :to="articlePath(next)" class="article-nav__card article-nav__card--next">
      <div class="article-nav__text">
        <p class="article-nav__label">下一篇</p>
        <p class="article-nav__title">{{ next.title }}</p>
      </div>
      <Icon name="lucide:chevron-right" size="20" class="article-nav__icon" aria-hidden="true" />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import type { RelatedPost } from '~/features/post/types'
defineProps<{
  prev: RelatedPost | null
  next: RelatedPost | null
  folder?: string | null
  error?: boolean
  pending?: boolean
}>()
defineEmits<{ retry: [] }>()
</script>

<style lang="scss" scoped>
.article-nav {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border-soft);

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: 1fr 1fr;
  }
}

.article-nav__error,
.article-nav__folder {
  grid-column: 1 / -1;
}

.article-nav__folder {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
  overflow-wrap: anywhere;
}

.article-nav__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: $radius-md;
  border: 1px solid var(--border-soft);
  background: var(--surface-1);
  text-decoration: none;
  color: inherit;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  box-shadow: var(--shadow-card);

  &:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--text-main);
    outline-offset: 3px;
  }

  /* 上一篇固定左列、下一篇固定右列：只有一侧时不会把“下一篇”挤到左边 */
  @media (min-width: $breakpoint-sm) {
    &--prev {
      grid-column: 1;
    }

    &--next {
      grid-column: 2;
    }
  }

  &--next {
    text-align: right;
    justify-content: flex-end;
  }
}

.article-nav__icon {
  flex-shrink: 0;
  color: var(--text-soft);
  transition: transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .article-nav__card--prev:hover & {
    transform: translateX(-4px);
    color: var(--text-muted);
  }

  .article-nav__card--next:hover & {
    transform: translateX(4px);
    color: var(--text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .article-nav__card:hover & {
      transform: none;
    }
  }
}

.article-nav__text {
  min-width: 0;
}

.article-nav__label {
  margin: 0 0 0.125rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-soft);
}

.article-nav__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .article-nav__card:hover & {
    color: var(--text-main);
  }
}
</style>
