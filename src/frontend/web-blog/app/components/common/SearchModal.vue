<!--
  @file SearchModal.vue
  @description 全局搜索弹窗 (Cmd+K)，六域公开检索、分组预览与单类型分页
  @author TixXin
  @since 2026-04-06
-->

<template>
  <Teleport to="body">
    <Transition name="search-modal" @after-leave="focusDestination">
      <div v-if="visible" class="search-modal-overlay" @click.self="close">
        <div
          ref="dialogRef"
          class="search-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('layout.searchModal.dialogLabel')"
          tabindex="-1"
        >
          <div class="search-modal__header">
            <Icon name="lucide:search" size="16" class="search-modal__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="search-modal__input"
              :placeholder="$t('layout.searchModal.placeholder')"
              :aria-label="$t('layout.searchModal.inputLabel')"
              :aria-describedby="keyboardHintId"
              maxlength="200"
              @keydown="onResultKeydown"
            />
            <button
              v-if="query"
              type="button"
              class="search-modal__close"
              :aria-label="$t('layout.searchModal.clear')"
              @click="query = ''"
            >
              <Icon name="lucide:delete" size="16" />
            </button>
            <button
              type="button"
              class="search-modal__close"
              :aria-label="$t('layout.searchModal.close')"
              @click="close"
            >
              <Icon name="lucide:x" size="18" />
            </button>
          </div>
          <nav class="search-modal__filters" :aria-label="$t('layout.searchModal.typesLabel')">
            <button
              v-for="(labelKey, value) in searchTypeLabelKeys"
              :key="value"
              type="button"
              :aria-pressed="type === value"
              @click="type = value"
            >
              {{ $t(labelKey) }}
            </button>
          </nav>
          <div v-if="query.trim()" ref="resultListRef" class="search-modal__body">
            <div v-if="isSearching" class="search-modal__loading">
              <Icon name="lucide:loader-2" size="16" class="search-modal__spinner" />
              {{ $t('layout.searchModal.searching') }}
            </div>
            <CommonRequestFeedback
              v-else-if="error"
              compact
              :title="$t('layout.searchModal.loadFailed')"
              :description="error"
              @retry="search(query)"
            />
            <template v-if="!isSearching">
              <section
                v-for="group in groups"
                :key="group.type"
                class="search-modal__group"
                :data-search-type="group.type"
              >
                <h2>
                  {{ typeLabel(group.type) }}
                  <span v-if="group.total !== null">{{
                    $t('layout.searchModal.groupTotal', { count: group.total })
                  }}</span>
                </h2>
                <p v-if="group.unavailable" class="search-modal__status">{{ $t('layout.searchModal.unavailable') }}</p>
                <p v-else-if="!group.items.length" class="search-modal__status">
                  {{ $t('layout.searchModal.noGroupResults') }}
                </p>
                <ul v-else class="search-modal__list">
                  <li v-for="item in group.items" :key="`${item.type}:${item.id}`">
                    <a
                      :href="item.url"
                      class="search-modal__item"
                      :class="{ 'search-modal__item--active': selectedIndex === results.indexOf(item) }"
                      :data-result-selected="selectedIndex === results.indexOf(item)"
                      :data-result-index="results.indexOf(item)"
                      @click="onResultClick($event, item)"
                      @mouseenter="selectedIndex = results.indexOf(item)"
                      @focus="selectedIndex = results.indexOf(item)"
                      @keydown="onResultKeydown"
                    >
                      <Icon :name="item.icon" size="16" class="search-modal__item-icon" />
                      <div class="search-modal__item-content">
                        <span class="search-modal__item-title">
                          <SearchHighlight :text="item.title" :keyword="query" />
                        </span>
                        <span class="search-modal__item-desc line-clamp-1">
                          <SearchHighlight :text="item.description" :keyword="query" />
                        </span>
                      </div>
                      <span class="search-modal__item-type">{{ typeLabel(item.type) }}</span>
                    </a>
                  </li>
                </ul>
                <button
                  v-if="type === 'all' && group.total !== null && group.total > group.items.length"
                  type="button"
                  class="search-modal__more"
                  @click="type = group.type"
                >
                  {{ $t('layout.searchModal.viewAll', { type: typeLabel(group.type) }) }}
                </button>
              </section>
            </template>
            <div v-if="!isSearching && !error && !results.length" class="search-modal__empty">
              <Icon name="lucide:search-x" size="20" />
              <span>{{ $t('layout.searchModal.empty') }}</span>
            </div>
          </div>
          <p v-if="query.trim()" class="search-modal__status" role="status">
            {{
              isSearching
                ? $t('layout.searchModal.searchingStatus')
                : type === 'all'
                  ? $t('layout.searchModal.allHint')
                  : total === null
                    ? $t('layout.searchModal.pageStatus', { page })
                    : $t('layout.searchModal.pageStatusTotal', { page, total })
            }}
          </p>
          <p :id="keyboardHintId" class="sr-only">{{ $t('layout.searchModal.keyboardHint') }}</p>
          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ selectionAnnouncement }}</p>
          <nav
            v-if="query.trim() && type !== 'all' && total !== null && (total > SEARCH_PAGE_SIZE || page > 1)"
            class="search-modal__filters"
            :aria-label="$t('layout.searchModal.pagination')"
          >
            <button type="button" :disabled="isSearching || page <= 1" @click="page--">
              {{ $t('layout.searchModal.prev') }}
            </button>
            <span>{{ page }} / {{ Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)) }}</span>
            <button type="button" :disabled="isSearching || page * SEARCH_PAGE_SIZE >= total" @click="page++">
              {{ $t('layout.searchModal.next') }}
            </button>
          </nav>
          <a
            v-if="query.trim()"
            :href="resultsPageUrl"
            class="search-modal__more"
            @click="onResultClick($event, { type: 'post', url: resultsPageUrl })"
            >{{ $t('layout.searchModal.openFull') }}</a
          >

          <div v-if="!query.trim()" class="search-modal__hint">
            <span>{{ $t('layout.searchModal.start') }}</span>
            <div class="search-modal__hint-keys">
              <kbd>&uarr;&darr;</kbd> {{ $t('layout.searchModal.keyNavigate') }} <kbd>Enter</kbd>
              {{ $t('layout.searchModal.keyOpen') }} <kbd>ESC</kbd>
              {{ $t('layout.searchModal.keyClose') }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import SearchHighlight from '~/components/common/SearchHighlight.vue'
import type { SearchResultItem } from '~/composables/useSearch'
import { searchTypeLabel, searchTypeLabelKeys, SEARCH_PAGE_SIZE } from '~/features/search/types'
import { searchLocation } from '~/features/search/query'

const visible = defineModel<boolean>('visible', { default: false })
const { t } = useI18n()

const inputRef = ref<HTMLInputElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const resultListRef = ref<HTMLElement | null>(null)
const selectedIndex = ref(-1)
const keyboardHintId = useId()

const { query, type, page, groups, results, total, isSearching, error, search, cancel } = useSearch({ remember: true })
const navigableResults = computed(() => (query.value.trim() && !isSearching.value ? results.value : []))
const selectionAnnouncement = computed(() => {
  const item = navigableResults.value[selectedIndex.value]
  return item
    ? t('layout.searchModal.selection', {
        index: selectedIndex.value + 1,
        total: navigableResults.value.length,
        title: item.title,
      })
    : ''
})
watch([total, isSearching], () => {
  if (isSearching.value || total.value === null || type.value === 'all') return
  const lastPage = Math.max(1, Math.ceil(total.value / SEARCH_PAGE_SIZE))
  if (page.value > lastPage) page.value = lastPage
})
let restoreTrigger = true
let destination: string | null = null
let waitForPageTransition = false
const { contentTransitionDuration } = useAppearanceSettings()
const activePageTransition = useState<false | { duration: number }>('page-transition-current', () => false)
const pageMotionCompleted = useState('page-motion-completed', () => 0)
watch(pageMotionCompleted, () => {
  waitForPageTransition = false
  focusDestination()
})
useModalFocus(visible, dialogRef, {
  close,
  initialFocus: () => inputRef.value,
  restoreFocus: () => restoreTrigger,
})

watch(visible, (v) => {
  if (v) {
    restoreTrigger = true
    destination = null
    waitForPageTransition = false
    selectedIndex.value = -1
    void search(query.value)
    nextTick(() => inputRef.value?.focus())
  } else cancel()
})

watch([query, type, page], ([q, scope, currentPage], [oldQuery, oldType], onCleanup) => {
  cancel()
  if (!visible.value) return
  resetSelection()
  if ((q !== oldQuery || scope !== oldType) && currentPage !== 1) {
    page.value = 1
    return
  }
  // 防抖期间也属于检索中，避免在结果返回前闪出“没有找到”。
  isSearching.value = !!q.trim()
  const timer = setTimeout(() => {
    void search(q, scope, currentPage)
  }, 250)
  onCleanup(() => clearTimeout(timer))
})

function close() {
  visible.value = false
}

function typeLabel(type: string) {
  return searchTypeLabel(type, t)
}

const router = useRouter()
const resultsPageUrl = computed(() => router.resolve(searchLocation(query.value, type.value, page.value)).href)
const currentRoute = useRoute()
const app = useNuxtApp()
const { error: notifyNavigationError } = useToast()

function focusDestination() {
  if (!destination || waitForPageTransition || visible.value || currentRoute.path !== destination) return
  if (document.querySelector('[role="dialog"]')) return
  destination = null
  void nextTick(() => {
    if (visible.value || document.querySelector('[role="dialog"]')) return
    const target =
      document.querySelector<HTMLElement>('main h1, main h2') ?? document.querySelector<HTMLElement>('main')
    if (!target) return
    const previousTabindex = target.getAttribute('tabindex')
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.addEventListener(
      'blur',
      () => {
        if (previousTabindex === null) target.removeAttribute('tabindex')
        else target.setAttribute('tabindex', previousTabindex)
      },
      { once: true },
    )
  })
}
const removePageFinish = app.hook('page:finish', focusDestination)
const removeTransitionFinish = app.hook('page:transition:finish', () => {
  waitForPageTransition = false
  focusDestination()
})
onBeforeUnmount(removePageFinish)
onBeforeUnmount(removeTransitionFinish)
watch(
  () => (activePageTransition.value ? activePageTransition.value.duration : 0),
  (duration) => {
    if (duration === 0) {
      waitForPageTransition = false
      void nextTick(focusDestination)
    }
  },
)

async function navigateTo(item: Pick<SearchResultItem, 'type' | 'url'>) {
  restoreTrigger = item.type === 'link'
  const targetRoute = router.resolve(item.url)
  const samePage = router.currentRoute.value.fullPath === targetRoute.fullPath
  destination = item.type === 'link' ? null : targetRoute.path
  waitForPageTransition =
    item.type !== 'link' && router.currentRoute.value.path !== targetRoute.path && contentTransitionDuration.value > 0
  close()
  if (item.type === 'link') {
    window.open(item.url, '_blank', 'noopener,noreferrer')
  } else {
    try {
      const failure = await router.push(item.url)
      if (failure && !samePage) {
        destination = null
        document.querySelector<HTMLElement>('[data-focus-key="site-search"]')?.focus({ preventScroll: true })
      } else if (samePage) {
        focusDestination()
      }
    } catch {
      destination = null
      notifyNavigationError(t('layout.searchModal.navigationFailed'))
      document.querySelector<HTMLElement>('[data-focus-key="site-search"]')?.focus({ preventScroll: true })
    }
  }
}

function onResultClick(event: MouseEvent, item: Pick<SearchResultItem, 'type' | 'url'>) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigateTo(item)
}

function resetSelection() {
  selectedIndex.value = -1
  // 结果刷新会移除原链接；将焦点交回输入框，避免落到弹窗外。
  if (resultListRef.value?.contains(document.activeElement)) {
    void nextTick(() => inputRef.value?.focus({ preventScroll: true }))
  }
}

watch([results, isSearching], resetSelection)
watch(selectedIndex, () =>
  nextTick(() => {
    resultListRef.value
      ?.querySelector<HTMLElement>('[data-result-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }),
)

function onResultKeydown(event: KeyboardEvent) {
  // 输入法候选项和带修饰键的浏览器快捷键不属于结果导航。
  if (event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    return
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) || !navigableResults.value.length) return
  const target = event.currentTarget
  const fromLink = target instanceof HTMLAnchorElement
  const currentIndex = fromLink ? Number(target.dataset.resultIndex) : selectedIndex.value
  // 关闭弹窗会改变焦点；先取消 Enter 的默认激活，避免重新点击搜索入口。
  event.preventDefault()
  if (event.key === 'Enter') {
    const item = navigableResults.value[Math.max(0, currentIndex)]
    if (item) void navigateTo(item)
    return
  }
  selectedIndex.value =
    currentIndex < 0
      ? event.key === 'ArrowDown'
        ? 0
        : navigableResults.value.length - 1
      : Math.max(0, Math.min(navigableResults.value.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)))
  // 输入框保留编辑焦点并播报选择；从链接导航时同步原生焦点。
  if (fromLink) {
    resultListRef.value
      ?.querySelector<HTMLElement>(`[data-result-index="${selectedIndex.value}"]`)
      ?.focus({ preventScroll: true })
  }
}
</script>

<style lang="scss" scoped>
.search-modal__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  button {
    padding: 0.4rem 0.6rem;
    min-height: 36px;
    border: 1px solid var(--border);
    border-radius: 0.4rem;
    color: var(--text-main);
  }
  [aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent);
  }
  :disabled {
    opacity: 0.5;
  }
}
.search-modal__group h2 {
  padding: 0.65rem 1rem 0.2rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.search-modal__more {
  display: block;
  padding: 0.65rem 1rem;
  color: var(--accent);
  font-size: 0.8rem;
}
.search-modal__close {
  flex: 0 0 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  color: var(--text-soft);
  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}
.search-modal__status {
  padding: 0.5rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.search-modal__item {
  text-decoration: none;
}
.search-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(20vh, 10rem);
}

.search-modal {
  max-height: calc(100dvh - 2rem);
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.search-modal__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.search-modal__icon {
  color: var(--text-soft);
  flex-shrink: 0;
}

.search-modal__input {
  min-width: 0;
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-soft);
  }
}

.search-modal__kbd {
  font-size: 0.625rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-soft);
  font-family: inherit;
  flex-shrink: 0;
}

.search-modal__body {
  min-height: 0;
  max-height: 360px;
  overflow-y: auto;
}
@media (max-height: 700px), (max-width: 400px) {
  .search-modal-overlay {
    padding-top: 1rem;
  }
  .search-modal__hint {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
}

.search-modal__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.search-modal__spinner {
  animation: spin 1s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-modal__list {
  list-style: none;
  margin: 0;
  padding: 0.5rem;
}

.search-modal__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  cursor: var(--interaction-cursor, pointer);
  transition: background 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &--active {
    background: var(--surface-2);
  }
}

.search-modal__item-icon {
  color: var(--text-soft);
  flex-shrink: 0;
}

.search-modal__item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.search-modal__item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-main);
}

.search-modal__item-desc {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.search-modal__item-type {
  font-size: 0.6875rem;
  color: var(--text-faint);
  background: var(--surface-3);
  padding: 0.125rem 0.5rem;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.search-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.search-modal__hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.search-modal__hint-keys {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-faint);

  kbd {
    font-size: 0.625rem;
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-family: inherit;
  }
}

/* 弹窗进出动效 */
.search-modal-enter-active,
.search-modal-leave-active {
  transition: opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.search-modal-enter-active .search-modal,
.search-modal-leave-active .search-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;
}

.search-modal-enter-from .search-modal {
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
}

.search-modal-leave-to .search-modal {
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
}
</style>
