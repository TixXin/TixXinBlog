<!--
  @file CategoryCard.vue
  @description 专栏独立页入口与首页筛选，展示专栏列表及文章数量
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card category-card">
    <div class="category-card__header">
      <h2 class="category-card__title">
        <Icon name="lucide:folder-open" size="16" /> {{ $t('layout.sidebar.category.title') }}
      </h2>
    </div>
    <ul class="category-card__list">
      <li v-for="cat in categories" :key="cat.name" class="category-card__row">
        <NuxtLink
          :to="postCategoryPath(cat.name)"
          class="category-card__item"
          :class="{ 'is-active': activeCategory === cat.name }"
        >
          <div class="category-card__left">
            <span class="category-card__icon" :style="{ color: cat.iconColor, background: cat.iconBg }">
              <Icon :name="cat.icon" size="16" />
            </span>
            <span class="font-medium text-sm">{{ cat.name }}</span>
          </div>
          <div class="category-card__right">
            <span class="category-card__badge">{{ cat.count }}</span>
            <Icon name="lucide:chevron-right" size="14" class="category-card__arrow" />
          </div>
        </NuxtLink>
        <CommonTooltip :content="$t('layout.sidebar.category.filter', { name: cat.name })">
          <button
            type="button"
            class="category-card__filter"
            :aria-label="$t('layout.sidebar.category.filter', { name: cat.name })"
            :aria-pressed="activeCategory === cat.name"
            @click="$emit('select', cat.name)"
          >
            <Icon name="lucide:list-filter" size="15" aria-hidden="true" />
          </button>
        </CommonTooltip>
      </li>
    </ul>
    <p v-if="!categories.length" class="text-sm text-soft">{{ $t('layout.sidebar.category.empty') }}</p>
  </section>
</template>

<script setup lang="ts">
import type { CategoryItem } from '~/features/stats/types'
import { postCategoryPath } from '~/features/post/taxonomy'

defineProps<{
  categories: CategoryItem[]
  /** 当前选中的分类名 */
  activeCategory?: string | null
}>()

defineEmits<{
  select: [categoryName: string]
}>()
</script>

<style lang="scss" scoped>
.category-card {
  padding: 1.25rem;
}

.category-card__header {
  margin-bottom: 0.75rem;
}

.category-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.category-card__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-card__row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.category-card__item {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  text-align: left;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--accent-soft);
  }

  &.is-active {
    background: var(--accent-soft);
    color: var(--accent-text);

    .category-card__badge {
      background: var(--surface-3);
      color: var(--text-main);
    }

    .category-card__arrow {
      color: var(--accent-text);
    }
  }
}

.category-card__filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  min-height: 44px;
  border-radius: $radius-md;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  @media (pointer: coarse) {
    width: 44px;
  }

  &:hover,
  &[aria-pressed='true'] {
    color: var(--accent-text);
    background: var(--accent-soft);
  }
}

.category-card__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.category-card__icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.category-card__right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.category-card__badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-3);
  padding: 2px 8px;
  border-radius: $radius-full;
  line-height: 1.4;
}

.category-card__arrow {
  font-size: 1rem;
  color: var(--text-soft);
  transition: color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .category-card__item:hover & {
    color: var(--text-main);
  }
}
</style>
