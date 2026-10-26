/** @file useAdminPostListSelection.ts @description 后台文章列表的跨页选择：单篇与整页勾选、全选筛选结果与批量成功后的移除 */
import type { Ref } from 'vue'
import type { AdminPostAppliedQuery } from './adminListQuery'
import { POST_SELECTION_LIMIT } from './batchTypes'
import type { PostBatchResult } from './batchTypes'
import type { AdminPostListRow } from './types'
import { useAdminPostSelectAll } from './useAdminPostSelectAll'

export interface AdminPostListSelectionOptions {
  items: Ref<AdminPostListRow[]>
  api: ReturnType<typeof useAdminApi>
  isDisabled: () => boolean
}

export function useAdminPostListSelection(options: AdminPostListSelectionOptions) {
  const { isDisabled } = options
  const { t } = useI18n()
  const selection = useAdminBatchSelection(options.items, { preserveAcrossPages: true, limit: POST_SELECTION_LIMIT })
  const selectAll = useAdminPostSelectAll({ api: options.api, replaceSelection: selection.replaceSelection })
  const { selectionError } = selectAll

  function clearSelection() {
    selectAll.cancel()
    selectionError.value = ''
    selection.clear()
  }
  function togglePost(id: number, event: Event) {
    if (isDisabled()) return
    const input = event.target as HTMLInputElement
    selectionError.value = selection.toggle(id, input.checked)
      ? ''
      : t('admin-content.postList.selectionLimit', { limit: POST_SELECTION_LIMIT })
    input.checked = selection.isSelected(id)
  }
  function togglePage(event: Event) {
    if (isDisabled()) return
    const input = event.target as HTMLInputElement
    selectionError.value = selection.toggleAll(input.checked)
      ? ''
      : t('admin-content.postList.pageSelectionLimit', { limit: POST_SELECTION_LIMIT })
    input.checked = selection.allSelected.value
    input.indeterminate = selection.partiallySelected.value
  }
  async function selectAllFiltered(query: AdminPostAppliedQuery, total: number) {
    if (isDisabled() || !total || total > POST_SELECTION_LIMIT) return
    await selectAll.selectAll(query, total)
  }
  /** 批量执行成功且修订号未变的文章移出选择，失败或已被他处修改的保留 */
  function removeSucceeded(result: PostBatchResult) {
    const revisions = new Map(result.preview.items.map(({ id, revision }) => [id, revision]))
    const succeeded = new Set(result.results.filter((item) => item.success).map((item) => item.id))
    selection.remove(
      selection.selectedItems.value
        .filter((item) => succeeded.has(item.id) && revisions.get(item.id) === item.revision)
        .map((item) => item.id),
    )
  }
  return { ...selectAll, selection, clearSelection, togglePost, togglePage, selectAllFiltered, removeSucceeded }
}
