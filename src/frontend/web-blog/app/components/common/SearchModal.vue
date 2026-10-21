<!-- @file SearchModal.vue @description 全局搜索弹窗 (Cmd+K)，六域公开检索、分组预览与单类型分页 -->

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
              <CommonSearchModalGroup
                v-for="group in groups"
                :key="group.type"
                :group="group"
                :query="query"
                :active-type="type"
                :results="results"
                :selected-index="selectedIndex"
                @select-type="type = $event"
                @click-result="onResultClick"
                @hover-result="selectedIndex = $event"
                @keydown="onResultKeydown"
              />
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

          <CommonSearchModalHint v-if="!query.trim()" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { searchTypeLabelKeys, SEARCH_PAGE_SIZE } from '~/features/search/types'
import { searchLocation } from '~/features/search/query'
import { useSearchModalNavigation } from '~/features/search/useSearchModalNavigation'
import { useSearchModalKeyboard } from '~/features/search/useSearchModalKeyboard'

const visible = defineModel<boolean>('visible', { default: false })

const inputRef = ref<HTMLInputElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const resultListRef = ref<HTMLElement | null>(null)
const selectedIndex = ref(-1)
const keyboardHintId = useId()

const { query, type, page, groups, results, total, isSearching, error, search, cancel } = useSearch({ remember: true })
const navigableResults = computed(() => (query.value.trim() && !isSearching.value ? results.value : []))

function close() {
  visible.value = false
}

const { restoreTrigger, focusDestination, resetNavigationState, navigateTo, onResultClick } = useSearchModalNavigation({
  visible,
  close,
})

const { selectionAnnouncement, resetSelection, onResultKeydown } = useSearchModalKeyboard({
  navigableResults,
  selectedIndex,
  resultListRef,
  inputRef,
  navigateTo,
})

watch([total, isSearching], () => {
  if (isSearching.value || total.value === null || type.value === 'all') return
  const lastPage = Math.max(1, Math.ceil(total.value / SEARCH_PAGE_SIZE))
  if (page.value > lastPage) page.value = lastPage
})

useModalFocus(visible, dialogRef, {
  close,
  initialFocus: () => inputRef.value,
  restoreFocus: restoreTrigger,
})

watch(visible, (v) => {
  if (v) {
    resetNavigationState()
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

const router = useRouter()
const resultsPageUrl = computed(() => router.resolve(searchLocation(query.value, type.value, page.value)).href)

watch([results, isSearching], resetSelection)
watch(selectedIndex, () =>
  nextTick(() => {
    resultListRef.value
      ?.querySelector<HTMLElement>('[data-result-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }),
)
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

.search-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-soft);
  font-size: 0.875rem;
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
