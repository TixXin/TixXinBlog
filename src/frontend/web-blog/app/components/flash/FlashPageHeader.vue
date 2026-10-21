<!--
  @file FlashPageHeader.vue
  @description 闪念页面头部操作区：标题、RSS 订阅、归档箱切换与展开式搜索框
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="main-content__header">
    <div class="page-title">
      <div class="page-title__icon-wrap" aria-hidden="true">
        <Icon name="lucide:zap" size="18" />
      </div>
      <div class="page-title__text">
        <h1 class="page-title__heading">{{ $t('flash-moment.flash.title') }}</h1>
        <p class="page-title__sub">
          {{ isLoggedIn ? $t('flash-moment.flash.subOwner') : $t('flash-moment.flash.subGuest') }}
        </p>
      </div>
    </div>

    <!-- 右侧操作区：RSS 订阅、归档箱与搜索切换 -->
    <div class="page-actions">
      <BlogRssLink href="/flash.xml" :label="$t('article.rss.flash')" compact />
      <button
        v-if="isLoggedIn"
        type="button"
        class="flash-page__search-toggle"
        :class="{ 'is-active': showArchive }"
        :aria-label="showArchive ? $t('flash-moment.flash.backToMain') : $t('flash-moment.flash.openArchive')"
        @click="$emit('toggle-archive')"
      >
        <Icon :name="showArchive ? 'lucide:archive-restore' : 'lucide:archive'" size="16" />
        <span>{{ showArchive ? $t('flash-moment.flash.backToMain') : $t('flash-moment.flash.archive') }}</span>
      </button>
      <button
        ref="searchButtonRef"
        type="button"
        class="flash-page__search-toggle"
        :class="{ 'is-active': searchExpanded }"
        :aria-label="$t('flash-moment.flash.searchToggle')"
        :aria-expanded="searchExpanded"
        aria-controls="flash-search"
        @click="$emit('update:searchExpanded', !searchExpanded)"
      >
        <Icon name="lucide:search" size="16" />
        <span>{{ $t('flash-moment.flash.search') }}</span>
      </button>
    </div>

    <!-- 搜索栏：展开后显示，占满 header 整行 -->
    <div v-if="searchExpanded" class="flash-page__search-bar">
      <Icon name="lucide:search" size="13" class="flash-page__search-icon" />
      <input
        id="flash-search"
        ref="searchInputRef"
        :value="searchQuery"
        :aria-label="$t('flash-moment.flash.searchInput')"
        type="text"
        class="flash-page__search-input"
        :placeholder="$t('flash-moment.flash.searchPlaceholder')"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        @keydown.escape="onCloseSearch"
      />
      <span v-if="debouncedQuery" class="flash-page__search-count">
        {{ $t('flash-moment.flash.resultCount', { count: resultCount }, resultCount) }}
      </span>
      <button
        type="button"
        class="flash-page__filter-clear"
        :aria-label="$t('flash-moment.flash.closeSearch')"
        @click="onCloseSearch"
      >
        <Icon name="lucide:x" size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  isLoggedIn: boolean
  showArchive: boolean
  searchExpanded: boolean
  searchQuery: string
  debouncedQuery: string
  resultCount: number
}>()

const emit = defineEmits<{
  'toggle-archive': []
  'update:searchExpanded': [val: boolean]
  'update:searchQuery': [val: string]
  'close-search': []
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchButtonRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.searchExpanded,
  (expanded) => {
    if (expanded) nextTick(() => searchInputRef.value?.focus())
  },
)

function onCloseSearch() {
  emit('close-search')
  nextTick(() => searchButtonRef.value?.focus())
}
</script>

<style lang="scss" scoped>
.flash-page__search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--border-hover);
    background: var(--surface-3);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &.is-active {
    color: var(--accent-text);
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

.flash-page__search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  animation: flash-search-in 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-within {
    border-color: var(--accent);
  }
}

.flash-page__search-icon {
  flex-shrink: 0;
  color: var(--text-faint);
}

.flash-page__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8125rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.flash-page__search-count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
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
</style>
