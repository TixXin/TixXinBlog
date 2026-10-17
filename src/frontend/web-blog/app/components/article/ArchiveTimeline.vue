<!--
  @file ArchiveTimeline.vue
  @description 文章归档时间线：按年份分组展示徽章、标题与条目列表
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="archive-timeline">
    <section v-for="(y, yearIndex) in years" :key="y.year" class="archive-timeline__year">
      <div class="archive-timeline__head">
        <div class="archive-timeline__badge" :class="{ 'archive-timeline__badge--primary': yearIndex === 0 }">
          <span class="archive-timeline__badge-text">{{ y.shortYear }}</span>
        </div>
        <div class="archive-timeline__head-text">
          <h3 class="archive-timeline__title">{{ y.year }} 年</h3>
          <p class="archive-timeline__count">共 {{ y.count }} 篇</p>
        </div>
      </div>

      <div class="archive-timeline__track">
        <ArticleArchiveItem
          v-for="(post, postIndex) in y.posts"
          :key="post.href"
          :post="post"
          :is-first="postIndex === 0"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ArchiveYear } from '~/features/article/types'

defineProps<{
  years: ArchiveYear[]
}>()
</script>

<style lang="scss" scoped>
.archive-timeline {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.archive-timeline__head {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.archive-timeline__badge {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-3);
  border: 1px solid var(--border);

  &--primary {
    background: var(--text-main);
    border-color: var(--text-main);

    .archive-timeline__badge-text {
      color: var(--surface-1);
    }
  }
}

.archive-timeline__badge-text {
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-muted);
}

.archive-timeline__head-text {
  min-width: 0;
}

.archive-timeline__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
}

.archive-timeline__count {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
}

/* 轨道线落在年份徽章的中轴上；条目圆点通过 --archive-track-gap 压在线上 */
.archive-timeline__track {
  --archive-track-gap: 1.5rem;
  margin-left: calc(2.5rem / 2 - 1px);
  padding-left: var(--archive-track-gap);
  border-left: 2px solid var(--border-soft);

  @media (max-width: $breakpoint-sm) {
    --archive-track-gap: 1.25rem;
  }
}
</style>
