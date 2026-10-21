/**
 * @file useFlashFilterState.ts
 * @description 闪念页面类型、标签、日历日期与关键词搜索筛选状态管理与条件聚合
 * @author TixXin
 * @since 2026-10-21
 */

import type { ComputedRef, Ref } from 'vue'
import type { FlashNote, FlashType } from '~/features/flash/types'
import type { FlashPublicFilter } from '~/features/flash/publicFilter'

export interface FlashFilterStateOptions {
  notes: Ref<FlashNote[]>
  archivedNotes: Ref<FlashNote[]>
  showArchive: Ref<boolean>
  pagedPublic: ComputedRef<boolean>
  total: Ref<number>
  setPublicFilter: (next: FlashPublicFilter) => void
}

export function useFlashFilterState(options: FlashFilterStateOptions) {
  const { notes, archivedNotes, showArchive, pagedPublic, total, setPublicFilter } = options
  const { t } = useI18n()

  const activeTag = ref<string | null>(null)
  const selectedDate = ref<string | null>(null)
  const typeFilter = ref<FlashType | null>(null)
  const searchExpanded = ref(false)
  const searchQuery = ref('')
  const debouncedQuery = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  watch(searchQuery, (v) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      debouncedQuery.value = v.trim()
    }, 300)
  })

  const typeTabs = computed<{ id: FlashType; icon: string; label: string }[]>(() => [
    { id: 'idea', icon: 'lucide:lightbulb', label: t('flash-moment.flashType.idea') },
    { id: 'todo', icon: 'lucide:check-square', label: t('flash-moment.flashType.todo') },
    { id: 'memo', icon: 'lucide:file-text', label: t('flash-moment.flashType.memo') },
  ])

  /** 筛选条摘要：类型 · 标签 · 日期 · 关键词 */
  const filterSummary = computed(() =>
    [
      typeTabs.value.find((tab) => tab.id === typeFilter.value)?.label,
      activeTag.value ? '#' + activeTag.value : '',
      selectedDate.value,
      debouncedQuery.value ? t('flash-moment.flash.filterKeyword', { keyword: debouncedQuery.value }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  )

  /** 在已取得的集合上叠加 type/标签/日期/搜索关键词（私有视图与归档箱使用；日期按 UTC 日） */
  function filterLocal(source: FlashNote[]) {
    let result = source
    if (typeFilter.value) {
      result = result.filter((n) => n.type === typeFilter.value)
    }
    if (activeTag.value) {
      result = result.filter((n) => n.tags.includes(activeTag.value!))
    }
    if (selectedDate.value) {
      result = result.filter((n) => n.createdAt.slice(0, 10) === selectedDate.value)
    }
    if (debouncedQuery.value) {
      const q = debouncedQuery.value.toLowerCase()
      result = result.filter(
        (n) => n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    return result
  }

  /** 公开视图的筛选全部交给后端分页：类型、标签、UTC 日期与关键词可任意组合 */
  watch([pagedPublic, typeFilter, activeTag, selectedDate, debouncedQuery], () => {
    if (!pagedPublic.value) return
    setPublicFilter({ tag: activeTag.value, q: debouncedQuery.value, type: typeFilter.value, date: selectedDate.value })
  })

  const matchedNotes = computed(() => {
    if (showArchive.value) return filterLocal(archivedNotes.value)
    if (!pagedPublic.value) return filterLocal(notes.value)
    return notes.value
  })

  const resultCount = computed(() =>
    pagedPublic.value && !showArchive.value ? total.value : matchedNotes.value.length,
  )

  const emptyMessage = computed(() => {
    if (activeTag.value || selectedDate.value || debouncedQuery.value || typeFilter.value)
      return t('flash-moment.flash.emptyNoMatch')
    return showArchive.value ? t('flash-moment.flash.emptyArchive') : undefined
  })

  function onTagFilter(tag: string) {
    activeTag.value = activeTag.value === tag ? null : tag
  }

  function onSelectDate(date: string | null) {
    selectedDate.value = date
  }

  function closeSearch() {
    searchExpanded.value = false
  }

  function clearFilters() {
    activeTag.value = null
    selectedDate.value = null
    typeFilter.value = null
    searchQuery.value = ''
    debouncedQuery.value = ''
    if (searchTimer) clearTimeout(searchTimer)
  }

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer)
  })

  return {
    activeTag,
    selectedDate,
    typeFilter,
    typeTabs,
    searchExpanded,
    searchQuery,
    debouncedQuery,
    filterSummary,
    matchedNotes,
    resultCount,
    emptyMessage,
    onTagFilter,
    onSelectDate,
    closeSearch,
    clearFilters,
  }
}
