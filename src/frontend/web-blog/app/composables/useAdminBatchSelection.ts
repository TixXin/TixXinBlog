/**
 * @file useAdminBatchSelection.ts
 * @description 后台列表当前页多选：单选、当前页全选与半选状态；列表刷新或翻页后只保留仍在当前页的选中项。
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
  results: { id: number; ok: boolean; reason?: 'not_found' | 'conflict' }[]
}

export function useAdminBatchSelection<T extends { id: number }>(items: Ref<T[]>) {
  const selectedIds = ref<number[]>([])
  const selectedItems = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)))
  const count = computed(() => selectedItems.value.length)
  const allSelected = computed(() => items.value.length > 0 && count.value === items.value.length)
  const partiallySelected = computed(() => count.value > 0 && !allSelected.value)
  watch(items, (list) => {
    const present = new Set(list.map((item) => item.id))
    selectedIds.value = selectedIds.value.filter((id) => present.has(id))
  })
  function isSelected(id: number) {
    return selectedIds.value.includes(id)
  }
  function toggle(id: number, value = !isSelected(id)) {
    selectedIds.value = value
      ? [...new Set([...selectedIds.value, id])]
      : selectedIds.value.filter((current) => current !== id)
  }
  function toggleAll(value = !allSelected.value) {
    selectedIds.value = value ? items.value.map((item) => item.id) : []
  }
  function clear() {
    selectedIds.value = []
  }
  return { selectedIds, selectedItems, count, allSelected, partiallySelected, isSelected, toggle, toggleAll, clear }
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
