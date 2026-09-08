<!--
  @file ArchiveItem.vue
  @description 文章归档单条时间线条目：日期、分类标签与可点击标题
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="archive-item" :class="{ 'archive-item--first': isFirst }">
    <span class="archive-item__dot" aria-hidden="true" />
    <div class="archive-item__body">
      <div class="archive-item__meta">
        <time class="archive-item__date" :datetime="post.date">{{ post.date }}</time>
        <span class="archive-item__tag" :class="`archive-item__tag--${post.categoryColor}`">
          {{ post.category }}
        </span>
      </div>
      <NuxtLink :to="post.href" class="archive-item__title">
        {{ post.title }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArchivePost } from '~/features/article/types'

defineProps<{
  post: ArchivePost
  isFirst: boolean
}>()
</script>

<style lang="scss" scoped>
.archive-item {
  position: relative;
  padding-left: 1.75rem;

  &--first {
    padding-top: 0;
  }
}

.archive-item__dot {
  position: absolute;
  /* 与父轨道的 border-left + padding-left 对齐，使圆点压在时间线上 */
  left: calc(-1.5rem - 1px + 0.3125rem);
  top: 0.35rem;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: $radius-full;
  background: var(--surface-1);
  border: 2px solid var(--text-soft);
  box-shadow: 0 0 0 2px var(--surface-2);
}

.archive-item__body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-bottom: 1.25rem;
}

.archive-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.archive-item__date {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.archive-item__tag {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: $radius-sm;
  border: 1px solid transparent;
}

.archive-item__tag--emerald {
  background: var(--tag-emerald-bg);
  color: var(--tag-emerald-text);
  border-color: var(--tag-emerald-border);
}

.archive-item__tag--rose {
  background: var(--tag-rose-bg);
  color: var(--tag-rose-text);
  border-color: var(--tag-rose-border);
}

.archive-item__tag--sky {
  background: var(--tag-sky-bg);
  color: var(--tag-sky-text);
  border-color: var(--tag-sky-border);
}

.archive-item__tag--amber {
  background: var(--tag-amber-bg);
  color: var(--tag-amber-text);
  border-color: var(--tag-amber-border);
}

.archive-item__tag--blue {
  background: var(--tag-blue-bg);
  color: var(--tag-blue-text);
  border-color: var(--tag-blue-border);
}

.archive-item__tag--orange {
  background: var(--tag-orange-bg);
  color: var(--tag-orange-text);
  border-color: var(--tag-orange-border);
}

.archive-item__tag--slate {
  background: var(--surface-3);
  color: var(--text-muted);
  border-color: var(--border);
}

.archive-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-main);
  text-decoration: none;
  line-height: 1.45;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    border-radius: $radius-sm;
  }
}
</style>
