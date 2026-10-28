<!--
  @file TagCloudCard.vue
  @description 标签独立页入口与首页筛选，支持键盘与触屏操作
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card tag-cloud-card">
    <div class="tag-cloud-card__header">
      <h2 class="tag-cloud-card__title"><Icon name="lucide:hash" size="16" /> {{ $t('layout.sidebar.tags.title') }}</h2>
      <span class="tag-cloud-card__count text-xs">{{ $t('layout.sidebar.tags.count', { count: tags.length }) }}</span>
    </div>
    <div class="tag-cloud-card__tags" role="group" :aria-label="$t('layout.sidebar.tags.groupLabel')">
      <div
        v-for="tag in displayedTags"
        :key="tag.name"
        class="tag-cloud-card__tag"
        :class="{ 'is-active': activeTag === tag.name }"
      >
        <NuxtLink :to="postTagPath(tag.name)" class="tag-cloud-card__link">
          <span class="tag-cloud-card__hash" aria-hidden="true" :style="{ color: tag.color }">#</span>
          {{ tag.name }}
          <span class="tag-cloud-card__tag-count">{{ tag.count }}</span>
        </NuxtLink>
        <CommonTooltip :content="$t('layout.sidebar.tags.filter', { name: tag.name })">
          <button
            type="button"
            class="tag-cloud-card__filter"
            :aria-label="$t('layout.sidebar.tags.filter', { name: tag.name })"
            :aria-pressed="activeTag === tag.name"
            @click="$emit('select', tag.name)"
          >
            <Icon name="lucide:list-filter" size="13" aria-hidden="true" />
          </button>
        </CommonTooltip>
      </div>
    </div>
    <div v-if="hasMore" class="tag-cloud-card__footer">
      <button
        type="button"
        class="tag-cloud-card__toggle"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        <span>{{
          isExpanded ? $t('layout.sidebar.tags.collapse') : $t('layout.sidebar.tags.expand', { count: remainingCount })
        }}</span>
        <Icon :name="isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="14" aria-hidden="true" />
      </button>
    </div>
    <p v-if="!tags.length" class="tag-cloud-card__empty">{{ $t('layout.sidebar.tags.empty') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TagItem } from '~/features/stats/types'
import { postTagPath } from '~/features/post/taxonomy'

const props = withDefaults(
  defineProps<{
    tags: TagItem[]
    /** 当前选中的标签名 */
    activeTag?: string | null
    /** 默认折叠展示的标签上限 */
    limit?: number
  }>(),
  { activeTag: null, limit: 14 },
)

defineEmits<{
  select: [tagName: string]
}>()

const isExpanded = ref(false)

const hasMore = computed(() => props.tags.length > props.limit)

// 当当前激活的 activeTag 处于折叠部分时，自动展开
watch(
  () => props.activeTag,
  (tag) => {
    if (!tag) return
    const activeIndex = props.tags.findIndex((item) => item.name === tag)
    if (activeIndex >= props.limit) {
      isExpanded.value = true
    }
  },
  { immediate: true },
)

const displayedTags = computed(() => {
  if (isExpanded.value || !hasMore.value) return props.tags
  return props.tags.slice(0, props.limit)
})

const remainingCount = computed(() => Math.max(0, props.tags.length - props.limit))
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
  align-items: stretch;
  max-width: 100%;
  overflow-wrap: anywhere;
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

.tag-cloud-card__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 32px;
  padding: 0.375rem 0.25rem;
  border-radius: 9px 0 0 9px;

  @media (pointer: coarse) {
    min-height: 44px;
  }
}

.tag-cloud-card__filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  min-height: 32px;
  border-left: 1px solid var(--border);
  border-radius: 0 9px 9px 0;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  @media (pointer: coarse) {
    width: 44px;
    min-height: 44px;
  }

  &:hover,
  &[aria-pressed='true'] {
    color: var(--accent-text);
    background: var(--accent-soft);
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

.tag-cloud-card__footer {
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
}

.tag-cloud-card__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--surface-1);
  border: 1px solid var(--border);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;

  @media (pointer: coarse) {
    min-height: 38px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--accent-soft);
    border-color: var(--border-hover);
  }
}

.tag-cloud-card__empty {
  font-size: 0.875rem;
  color: var(--text-soft);
}
</style>
