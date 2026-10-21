<!--
  @file FlashPageSidebar.vue
  @description 闪念页面右侧栏：AI 搜索入口、发布统计、日历、时间胶囊与标签云卡片组
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="sidebar-list-group">
    <!-- AI 搜索入口 -->
    <button type="button" class="flash-ai-card" @click="$emit('ai-click')">
      <Icon name="lucide:sparkles" size="18" class="flash-ai-card__icon" />
      <div class="flash-ai-card__body">
        <span class="flash-ai-card__title">{{ $t('flash-moment.flash.aiTitle') }}</span>
        <span class="flash-ai-card__desc">{{
          isLoggedIn ? $t('flash-moment.flash.aiDescOwner') : $t('flash-moment.flash.aiDescGuest')
        }}</span>
      </div>
      <Icon name="lucide:chevron-right" size="14" class="flash-ai-card__arrow" />
    </button>

    <!-- 统计卡片 -->
    <div class="flash-stat-card">
      <div class="flash-stat-card__row">
        <span class="flash-stat-card__label">{{
          isLoggedIn ? $t('flash-moment.flash.statTotal') : $t('flash-moment.flash.statOwnerTotal')
        }}</span>
        <span class="flash-stat-card__value">{{ totalCount ?? '—' }}</span>
      </div>
      <div class="flash-stat-card__divider" />
      <div class="flash-stat-card__row">
        <span class="flash-stat-card__label">{{ $t('flash-moment.flash.statMonthly') }}</span>
        <span class="flash-stat-card__value">{{ aggregatesReady ? monthlyCount : '—' }}</span>
      </div>
    </div>

    <!-- 发布日历 -->
    <SidebarFlashCalendarCard
      v-if="aggregatesReady && overview"
      :dates="overview.dates"
      :selected-date="selectedDate"
      @select-date="$emit('select-date', $event)"
    />

    <!-- 时间胶囊：去年今日 + 随机回顾 -->
    <SidebarFlashTimeCapsuleCard
      v-if="aggregatesReady && overview"
      :on-this-day="overview.onThisDay"
      :recollections="overview.recollections"
    />

    <!-- 标签云 -->
    <div v-if="tagCloud.length > 0" class="flash-tag-cloud">
      <div class="flash-tag-cloud__header">
        <Icon name="lucide:tags" size="14" />
        <span>{{ $t('flash-moment.flash.tagCloud') }}</span>
      </div>
      <div class="flash-tag-cloud__list">
        <button
          v-for="item in tagCloud"
          :key="item.name"
          type="button"
          :aria-pressed="activeTag === item.name"
          class="flash-tag-cloud__item"
          :class="{ 'flash-tag-cloud__item--active': activeTag === item.name }"
          :style="{ fontSize: tagFontSize(item.count) }"
          @click="$emit('tag-filter', item.name)"
        >
          #{{ item.name }}
          <span class="flash-tag-cloud__count">{{ item.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlashOverview } from '~/features/flash/types'

const props = defineProps<{
  isLoggedIn: boolean
  totalCount: number | null
  monthlyCount: number
  aggregatesReady: boolean
  overview: FlashOverview | null
  selectedDate: string | null
  tagCloud: { name: string; count: number }[]
  activeTag: string | null
}>()

defineEmits<{
  'ai-click': []
  'select-date': [date: string | null]
  'tag-filter': [tag: string]
}>()

/** 标签云字号：count 越大字号越大，0.7 ~ 1.2rem */
function tagFontSize(count: number): string {
  const max = Math.max(...props.tagCloud.map((t) => t.count), 1)
  const ratio = 0.7 + (count / max) * 0.5
  return `${ratio}rem`
}
</script>

<style lang="scss" scoped>
.sidebar-list-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.flash-ai-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  background: linear-gradient(135deg, var(--accent-soft), var(--surface-1));
  color: var(--text-main);
  text-align: left;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  width: 100%;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
}

.flash-ai-card__icon {
  flex-shrink: 0;
  color: var(--accent-text);
}

.flash-ai-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.flash-ai-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
}

.flash-ai-card__desc {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.flash-ai-card__arrow {
  flex-shrink: 0;
  color: var(--text-faint);
}

.flash-stat-card {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-stat-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.flash-stat-card__label {
  color: var(--text-soft);
}

.flash-stat-card__value {
  font-weight: 700;
  color: var(--accent-text);
  font-variant-numeric: tabular-nums;
  font-size: 1.0625rem;
}

.flash-stat-card__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.625rem 0;
}

.flash-tag-cloud {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-tag-cloud__header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.flash-tag-cloud__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.625rem;
  align-items: baseline;
}

.flash-tag-cloud__item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent-text);
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  padding: 0.125rem 0.375rem;
  border-radius: $radius-full;
  transition:
    opacity 0.2s,
    background 0.2s,
    color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.7;
  }

  &--active {
    background: var(--accent-action);
    color: #fff;
    opacity: 1;

    .flash-tag-cloud__count {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.flash-tag-cloud__count {
  font-size: 0.625rem;
  color: var(--text-faint);
}
</style>
