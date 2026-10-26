/** @file useAdminPostSelectAll.ts @description 后台文章“全选筛选结果”：读取进度、取消与失败提示 */
import type { AdminPostAppliedQuery } from './adminListQuery'
import { ADMIN_POST_FILTER_PAGE_SIZE } from './adminListQuery'
import { FilterChangedError, readAllFilteredPosts } from './adminSelectAll'
import type { AdminPostListRow } from './types'

export interface AdminPostSelectAllOptions {
  api: ReturnType<typeof useAdminApi>
  replaceSelection: (rows: AdminPostListRow[]) => void
}

export function useAdminPostSelectAll(options: AdminPostSelectAllOptions) {
  const { api } = options
  const { t } = useI18n()
  const selectingAll = ref(false),
    selectionError = ref('')
  let version = 0

  /** 让进行中的全选失效，结果与失败都不再写回 */
  const invalidate = () => (version += 1)
  function cancel() {
    version++
    selectingAll.value = false
  }
  async function selectAll(query: AdminPostAppliedQuery, expectedTotal: number) {
    const current = ++version
    selectingAll.value = true
    selectionError.value = ''
    // 全部读取成功后一次替换；失败、取消或筛选变化时不留下半份全选结果。
    try {
      const rows = await readAllFilteredPosts({
        read: (page) =>
          api<{ items: AdminPostListRow[]; total: number }>('/admin/posts', {
            query: { ...query, page, pageSize: ADMIN_POST_FILTER_PAGE_SIZE },
          }),
        expectedTotal,
        pageSize: ADMIN_POST_FILTER_PAGE_SIZE,
        isCurrent: () => current === version,
        messages: {
          changed: () => t('admin-content.postList.filterChanged'),
          reordered: () => t('admin-content.postList.filterReordered'),
        },
      })
      if (rows) options.replaceSelection(rows)
    } catch (cause) {
      if (current === version)
        selectionError.value =
          cause instanceof FilterChangedError ? cause.message : t('admin-content.postList.selectAllFailed')
    } finally {
      if (current === version) selectingAll.value = false
    }
  }
  return { selectingAll, selectionError, invalidate, cancel, selectAll }
}
