<!--
  @file TagCloudCard.vue
  @description 可用键盘与触屏操作的静态标签云，标签不重复或自动移动
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card tag-cloud-card">
    <div class="tag-cloud-card__header">
      <h3 class="tag-cloud-card__title"><Icon name="lucide:hash" size="16" /> 探索标签</h3>
      <span class="tag-cloud-card__count text-xs">{{ tags.length }} 个标签</span>
    </div>
    <div class="tag-cloud-card__tags" role="group" aria-label="按标签筛选">
      <button
        v-for="tag in tags"
        :key="tag.name"
        type="button"
        :aria-pressed="activeTag === tag.name"
        class="tag-cloud-card__tag"
        :class="{ 'is-active': activeTag === tag.name }"
        @click="$emit('select', tag.name)"
      >
        <span class="tag-cloud-card__hash" aria-hidden="true" :style="{ color: tag.color }">#</span>
        {{ tag.name }}
        <span class="tag-cloud-card__tag-count">{{ tag.count }}</span>
      </button>
    </div>
    <p v-if="!tags.length" class="tag-cloud-card__empty">暂无标签</p>
  </section>
</template>

<script setup lang="ts">
import type { TagItem } from '~/features/stats/types'

withDefaults(
  defineProps<{
    tags: TagItem[]
    /** 当前选中的标签名 */
    activeTag?: string | null
  }>(),
  { activeTag: null },
)

defineEmits<{
  select: [tagName: string]
}>()
</script>

<style lang="scss" scoped>
.tag-cloud-card {
  padding: 1.25rem;
  overflow: hidden;

  // 紧凑档（lg–xl）：右栏只有 260px 宽，卡片 padding 收窄
  @media (min-width: $breakpoint-lg) and (max-width: #{$breakpoint-xl - 1px}) {
    padding: 1rem;
  }
}

.tag-cloud-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tag-cloud-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.tag-cloud-card__count {
  color: var(--text-muted);
}

.tag-cloud-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-cloud-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow-wrap: anywhere;
  min-height: 32px;
  padding: 0.375rem 0.25rem;
  border-radius: 9px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-1);
  color: var(--text-muted);
  border: 1px solid var(--border);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  cursor: pointer;

  @media (pointer: coarse) {
    min-height: 44px;
  }

  &:hover {
    background: var(--accent-soft);
    color: var(--text-main);
    border-color: var(--border-hover);
  }

  &.is-active {
    background: var(--accent-soft);
    color: var(--text-main);
    border-color: var(--accent);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
}

.tag-cloud-card__hash {
  font-weight: 700;
}

.tag-cloud-card__tag-count {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 500;
}

.tag-cloud-card__empty {
  font-size: 0.875rem;
  color: var(--text-soft);
}
</style>
