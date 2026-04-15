<!--
  @file TabSearchBar.vue
  @description 标签页顶部搜索框：支持外部引擎（可配置）+ 本地书签/分类模糊搜索下拉
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tab-search">
    <form class="tab-search__form" @submit.prevent="onSubmit">
      <div class="tab-search__inner">
        <Icon name="lucide:search" size="18" class="tab-search__icon" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="tab-search__input"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          @focus="focused = true"
          @blur="onBlur"
          @keydown.down.prevent="focusFirstHit"
        >
        <button v-if="query" type="button" class="tab-search__clear" aria-label="清空" @click="query = ''">
          <Icon name="lucide:x" size="14" />
        </button>
        <button type="submit" class="tab-search__submit" :disabled="!query.trim()" aria-label="搜索">
          <Icon name="lucide:arrow-right" size="16" />
        </button>
      </div>
      <div class="tab-search__hint">
        <span>按 Enter 在 {{ engineLabel }} 中搜索</span>
        <span v-if="localHits.length > 0" class="tab-search__hint-sep">·</span>
        <span v-if="localHits.length > 0">↓ 选择本地结果</span>
      </div>
    </form>

    <!-- 本地搜索下拉 -->
    <Transition name="tab-search-dropdown">
      <div v-if="showDropdown" class="tab-search__dropdown">
        <button
          v-for="(hit, idx) in localHits"
          :key="hit.id"
          ref="hitRefs"
          type="button"
          class="tab-search__hit"
          :class="{ 'tab-search__hit--focus': focusedIdx === idx }"
          @mouseenter="focusedIdx = idx"
          @click="openHit(hit)"
          @keydown.down.prevent="focusHit(idx + 1)"
          @keydown.up.prevent="focusHit(idx - 1)"
          @keydown.enter.prevent="openHit(hit)"
          @keydown.escape.prevent="query = ''"
        >
          <span class="tab-search__hit-icon">
            <Icon v-if="hit.icon?.startsWith('lucide:')" :name="hit.icon" size="14" />
            <span v-else>{{ hit.icon || hit.title[0] }}</span>
          </span>
          <div class="tab-search__hit-text">
            <div class="tab-search__hit-title">{{ hit.title }}</div>
            <div v-if="hit.sub" class="tab-search__hit-sub">{{ hit.sub }}</div>
          </div>
          <span class="tab-search__hit-type">{{ hit.typeLabel }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'

const { settings } = useTabSettings()
const { bookmarks, categories, selectCategory } = useTabBookmarks()

const query = ref('')
const placeholder = '搜索任何东西，或输入网址…'
const focused = ref(false)
const focusedIdx = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const hitRefs = ref<HTMLButtonElement[]>([])

interface LocalHit {
  id: string
  title: string
  sub?: string
  icon?: string
  typeLabel: string
  source: 'bookmark' | 'category'
  payload: { url?: string; id?: string }
}

const allHits = computed<LocalHit[]>(() => {
  const bmList: LocalHit[] = bookmarks.value.map((b) => ({
    id: `bm-${b.id}`,
    title: b.name,
    sub: b.url,
    icon: b.icon,
    typeLabel: '书签',
    source: 'bookmark',
    payload: { url: b.url },
  }))
  const catList: LocalHit[] = categories.value.map((c) => ({
    id: `cat-${c.id}`,
    title: c.name,
    sub: '分类',
    icon: c.icon,
    typeLabel: '分类',
    source: 'category',
    payload: { id: c.id },
  }))
  return [...bmList, ...catList]
})

const fuse = computed(
  () =>
    new Fuse(allHits.value, {
      keys: ['title', 'sub'],
      threshold: 0.4,
      ignoreLocation: true,
    }),
)

const localHits = computed<LocalHit[]>(() => {
  const q = query.value.trim()
  if (!q) return []
  return fuse.value.search(q).slice(0, 5).map((r) => r.item)
})

const showDropdown = computed(() => focused.value && localHits.value.length > 0)

const engineLabel = computed(() => {
  switch (settings.value.searchEngine) {
    case 'bing':
      return 'Bing'
    case 'duckduckgo':
      return 'DuckDuckGo'
    case 'baidu':
      return '百度'
    case 'custom':
      return '自定义搜索'
    case 'google':
    default:
      return 'Google'
  }
})

function buildSearchUrl(q: string): string {
  const s = settings.value
  switch (s.searchEngine) {
    case 'bing':
      return `https://www.bing.com/search?q=${encodeURIComponent(q)}`
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
    case 'baidu':
      return `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
    case 'custom':
      if (s.searchEngineCustomUrl.includes('%s')) {
        return s.searchEngineCustomUrl.replace('%s', encodeURIComponent(q))
      }
      return `${s.searchEngineCustomUrl}${encodeURIComponent(q)}`
    case 'google':
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`
  }
}

function onSubmit() {
  const q = query.value.trim()
  if (!q) return
  if (/^https?:\/\//i.test(q)) {
    window.open(q, '_blank', 'noopener')
    return
  }
  window.open(buildSearchUrl(q), '_blank', 'noopener')
}

function onBlur() {
  // 延迟以允许点击下拉项
  setTimeout(() => {
    focused.value = false
    focusedIdx.value = -1
  }, 180)
}

function focusFirstHit() {
  if (localHits.value.length === 0) return
  focusedIdx.value = 0
  nextTick(() => hitRefs.value[0]?.focus())
}

function focusHit(idx: number) {
  const n = localHits.value.length
  if (n === 0) return
  const next = ((idx % n) + n) % n
  focusedIdx.value = next
  nextTick(() => hitRefs.value[next]?.focus())
}

function openHit(hit: LocalHit) {
  if (hit.source === 'bookmark' && hit.payload.url) {
    window.open(hit.payload.url, '_blank', 'noopener')
  } else if (hit.source === 'category' && hit.payload.id) {
    selectCategory(hit.payload.id)
  }
  query.value = ''
  focused.value = false
}
</script>

<style lang="scss" scoped>
.tab-search {
  position: relative;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.tab-search__form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
}

.tab-search__inner {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 3.25rem;
  padding: 0 0.75rem 0 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-full;
  box-shadow: var(--shadow-card);
  transition: all 0.2s;

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
}

.tab-search__icon {
  flex-shrink: 0;
  color: var(--text-soft);
  margin-right: 0.75rem;
}

.tab-search__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.tab-search__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.tab-search__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: 0.5rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.88;
  }
}

.tab-search__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
}

.tab-search__hint-sep {
  opacity: 0.5;
}

/* ---- 本地搜索下拉 ---- */
.tab-search__dropdown {
  position: absolute;
  top: calc(3.25rem + 0.5rem);
  left: 0;
  right: 0;
  z-index: 20;
  padding: 0.375rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
  max-height: 320px;
  overflow-y: auto;
}

.tab-search-dropdown-enter-active,
.tab-search-dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tab-search-dropdown-enter-from,
.tab-search-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.tab-search__hit {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  border-radius: $radius-sm;
  transition: background 0.15s;

  &:hover,
  &--focus,
  &:focus-visible {
    background: var(--accent-soft);
    color: var(--accent);
    outline: none;
  }
}

.tab-search__hit-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.875rem;
  font-weight: 600;
}

.tab-search__hit--focus .tab-search__hit-icon,
.tab-search__hit:hover .tab-search__hit-icon {
  background: var(--accent);
  color: #fff;
}

.tab-search__hit-text {
  flex: 1;
  min-width: 0;
}

.tab-search__hit-title {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-search__hit-sub {
  font-size: 0.6875rem;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-search__hit--focus .tab-search__hit-sub,
.tab-search__hit:hover .tab-search__hit-sub {
  color: inherit;
  opacity: 0.75;
}

.tab-search__hit-type {
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-faint);
  font-size: 0.625rem;
  font-weight: 500;
}
</style>
