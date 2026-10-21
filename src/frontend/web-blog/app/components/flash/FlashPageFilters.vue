<!--
  @file FlashPageFilters.vue
  @description 闪念页面类型切换 Tab、访客登录提示横幅与当前筛选生效条
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div>
    <!-- 类型 tab：全部 / 灵感 / 待办 / 随记 -->
    <div class="flash-page__type-tabs" role="group" :aria-label="$t('flash-moment.flash.typeGroup')">
      <button
        type="button"
        class="flash-page__type-tab"
        :class="{ 'is-active': typeFilter === null }"
        :aria-pressed="typeFilter === null"
        @click="$emit('update:typeFilter', null)"
      >
        {{ $t('flash-moment.flash.all') }}
      </button>
      <button
        v-for="tab in typeTabs"
        :key="tab.id"
        type="button"
        class="flash-page__type-tab"
        :class="{ 'is-active': typeFilter === tab.id }"
        :data-type="tab.id"
        :aria-pressed="typeFilter === tab.id"
        @click="$emit('update:typeFilter', tab.id)"
      >
        <Icon :name="tab.icon" size="12" />
        {{ tab.label }}
      </button>
    </div>

    <button v-if="!isLoggedIn" type="button" class="flash-page__guest-banner" @click="$emit('login')">
      <Icon name="lucide:eye" size="14" class="flash-page__guest-banner-icon" />
      <span class="flash-page__guest-banner-text"> {{ $t('flash-moment.flash.guestBanner') }} </span>
      <span class="flash-page__guest-banner-cta">
        {{ $t('flash-moment.flash.loginNow') }}
        <Icon name="lucide:arrow-right" size="12" />
      </span>
    </button>

    <!-- 标签与组合筛选条 -->
    <div v-if="activeTag || selectedDate || debouncedQuery || typeFilter" class="flash-page__filter-bar">
      <span class="flash-page__filter-label" role="status">
        {{ $t('flash-moment.flash.filterCurrent', { summary: filterSummary }) }}
        · {{ $t('flash-moment.flash.resultCount', { count: resultCount }, resultCount) }}
      </span>
      <button type="button" class="flash-page__filter-clear" @click="$emit('clear-filters')">
        <Icon name="lucide:x" size="12" />
        {{ $t('flash-moment.flash.clearFilters') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlashType } from '~/features/flash/types'

defineProps<{
  isLoggedIn: boolean
  typeFilter: FlashType | null
  typeTabs: { id: FlashType; icon: string; label: string }[]
  activeTag: string | null
  selectedDate: string | null
  debouncedQuery: string
  filterSummary: string
  resultCount: number
}>()

defineEmits<{
  'update:typeFilter': [val: FlashType | null]
  login: []
  'clear-filters': []
}>()
</script>

<style lang="scss" scoped>
.flash-page__type-tabs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 1.125rem;
}

.flash-page__type-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: $radius-full;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &.is-active {
    color: #fff;
    background: var(--accent-action);
  }

  &[data-type='idea'].is-active {
    background: #a15104;
  }

  &[data-type='todo'].is-active {
    background: #2563eb;
  }
}

.flash-page__filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--accent-soft);
  border: 1px dashed var(--accent);
  border-radius: $radius-card;
  font-size: 0.75rem;
  color: var(--text-soft);
  animation: flash-search-in 0.18s ease;
  margin-bottom: 1.125rem;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.flash-page__filter-label {
  flex: 1;

  strong {
    color: var(--accent-text);
  }
}

.flash-page__filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  transition: opacity 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.85;
  }
}

.flash-page__guest-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-card;
  background: var(--accent-soft);
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  width: 100%;
  margin-bottom: 1.125rem;

  &:hover {
    border-style: solid;
    transform: translateY(-1px);
  }
}

.flash-page__guest-banner-icon {
  flex-shrink: 0;
  color: var(--accent-text);
}

.flash-page__guest-banner-text {
  flex: 1;
  color: var(--text-soft);
}

.flash-page__guest-banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--accent-text);
}

@keyframes flash-search-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
