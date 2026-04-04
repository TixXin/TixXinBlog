<!--
  @file TableOfContents.vue
  @description 文章右侧目录导航，支持层级缩进与当前章节高亮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="toc card">
    <div class="toc__header">
      <h3 class="toc__title">
        <Icon name="lucide:list" size="16" />
        文章目录
      </h3>
      <span v-if="progress !== undefined" class="toc__progress">{{ Math.round(progress) }}%</span>
    </div>
    <nav class="toc__nav" aria-label="文章目录">
      <a
        v-for="item in items"
        :key="item.id"
        :href="`#${item.id}`"
        class="toc__link"
        :class="{
          'toc__link--active': item.id === activeId,
          'toc__link--sub': item.level > 2,
        }"
        :style="{ paddingLeft: `${0.75 + (item.level - 2) * 0.75}rem` }"
      >
        <span class="toc__dot" :class="{ 'toc__dot--sub': item.level > 2 }" />
        {{ item.text }}
      </a>
    </nav>
  </section>
</template>

<script setup lang="ts">
import type { TocItem } from '~/features/post/types'

defineProps<{
  items: TocItem[]
  activeId: string
  progress?: number
}>()
</script>

<style lang="scss" scoped>
.toc {
  display: none;
  padding: 1.25rem;
  border-radius: $radius-card;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  transition: $transition-colors;

  @media (min-width: $breakpoint-lg) {
    display: block;
  }
}

.toc__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.toc__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

.toc__progress {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface-2);
  padding: 0.125rem 0.375rem;
  border-radius: $radius-sm;
}

.toc__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toc__link {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: $radius-md;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: $transition-fast;

  &:hover {
    background: var(--surface-3);
    color: var(--text-main);
  }

  &--sub {
    font-size: 0.8125rem;
    color: var(--text-soft);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.toc__dot {
  width: 6px;
  height: 6px;
  border-radius: $radius-full;
  flex-shrink: 0;
  background: var(--text-soft);

  &--sub {
    width: 4px;
    height: 4px;
  }
}
</style>
