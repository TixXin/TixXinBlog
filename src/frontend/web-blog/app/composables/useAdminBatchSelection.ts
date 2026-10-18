/**
 * @file useAdminBatchSelection.ts
 * @description 后台列表多选：默认只保留当前页，可显式启用跨页快照与选择数量上限。
 *   编号可为数字（文章评论、留言）或字符串（闪念评论）。
 */
import type { Ref } from 'vue'

/** 批量操作栏上的一个动作 */
export interface AdminBatchAction {
  key: string
  label: string
  icon: string
  danger?: boolean
}
/** 批量接口逐条结果的公共形状 */
export interface AdminBatchResult {
  successCount: number
  failedCount: number
  results: { id: number | string; ok: boolean; reason?: 'not_found' | 'conflict' }[]
}

export interface AdminBatchSelectionOptions {
  preserveAcrossPages?: boolean
  limit?: number
}

export function useAdminBatchSelection<T extends { id: number | string }>(
  items: Ref<T[]>,
  options: AdminBatchSelectionOptions = {},
) {
  type Id = T['id']
  const selectedIds = ref([]) as Ref<Id[]>
  const selectedSnapshots = shallowRef(new Map<Id, T>())
  const limit = options.limit ?? Infinity
  const selectedItems = computed(() =>
    options.preserveAcrossPages
      ? selectedIds.value.flatMap((id) => {
          const item = selectedSnapshots.value.get(id)
          return item ? [item] : []
        })
      : items.value.filter((item) => selectedIds.value.includes(item.id)),
  )
  const count = computed(() => selectedItems.value.length)
  const pageSelectedCount = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)).length)
  const allSelected = computed(() => items.value.length > 0 && pageSelectedCount.value === items.value.length)
  const partiallySelected = computed(() => pageSelectedCount.value > 0 && !allSelected.value)
  watch(items, (list) => {
    if (options.preserveAcrossPages) return
    const present = new Set(list.map((item) => item.id))
    selectedIds.value = selectedIds.value.filter((id) => present.has(id))
  })
  function isSelected(id: Id) {
    return selectedIds.value.includes(id)
  }
  function toggle(id: Id, value = !isSelected(id)) {
    if (!value) {
      remove([id])
      return true
    }
    if (isSelected(id)) return true
    if (selectedIds.value.length >= limit) return false
    if (options.preserveAcrossPages) {
      const item = items.value.find((item) => item.id === id)
      if (!item) return false
      // 保存选择时的顶层字段，重新读取列表不能悄悄替换待提交版本。
      selectedSnapshots.value = new Map(selectedSnapshots.value).set(id, { ...item })
    }
    selectedIds.value = [...selectedIds.value, id]
    return true
  }
  function toggleAll(value = !allSelected.value) {
    if (!value) {
      if (options.preserveAcrossPages) remove(items.value.map((item) => item.id))
      else clear()
      return true
    }
    const ids = [
      ...new Set([...(options.preserveAcrossPages ? selectedIds.value : []), ...items.value.map((i) => i.id)]),
    ]
    if (ids.length > limit) return false
    if (options.preserveAcrossPages) {
      const snapshots = new Map(selectedSnapshots.value)
      for (const item of items.value) {
        if (!snapshots.has(item.id)) snapshots.set(item.id, { ...item })
      }
      selectedSnapshots.value = snapshots
    }
    selectedIds.value = ids
    return true
  }
  /** 全部筛选结果读取成功后再一次性替换，超限时保留原选择。 */
  function replaceSelection(rows: T[]) {
    const snapshots = new Map<Id, T>()
    for (const item of rows) {
      if (!snapshots.has(item.id)) snapshots.set(item.id, { ...item })
    }
    if (snapshots.size > limit) return false
    selectedSnapshots.value = options.preserveAcrossPages ? snapshots : new Map()
    selectedIds.value = [...snapshots.keys()]
    return true
  }
  function remove(ids: Id[]) {
    const removed = new Set(ids)
    selectedIds.value = selectedIds.value.filter((id) => !removed.has(id))
    const snapshots = new Map(selectedSnapshots.value)
    for (const id of removed) snapshots.delete(id)
    selectedSnapshots.value = snapshots
  }
  function clear() {
    selectedIds.value = []
    selectedSnapshots.value = new Map()
  }
  return {
    selectedIds,
    selectedItems,
    count,
    allSelected,
    partiallySelected,
    isSelected,
    toggle,
    toggleAll,
    replaceSelection,
    remove,
    clear,
  }
}

/** 汇总批量结果文案：跳过的项说明原因，便于刷新后核对 */
export function describeBatchResult(result: AdminBatchResult, done: string, noun: string) {
  const parts = result.successCount ? [`${done} ${result.successCount} 条${noun}`] : []
  const missing = result.results.filter((item) => item.reason === 'not_found').length
  const conflict = result.results.filter((item) => item.reason === 'conflict').length
  if (missing) parts.push(`${missing} 条已不存在`)
  if (conflict) parts.push(`${conflict} 条已被修改，请刷新后重新选择`)
  return parts.join('；') || `没有${noun}被修改`
}
