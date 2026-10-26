/** @file useAdminPostListData.ts @description 后台文章列表的分页读取、筛选候选项读取与过期请求丢弃 */
import type { Ref } from 'vue'
import type { AdminPostAppliedQuery } from './adminListQuery'
import { ADMIN_POST_PAGE_SIZE } from './adminListQuery'
import type { AdminPostListRow } from './types'

export interface AdminPostListDataOptions {
  api: ReturnType<typeof useAdminApi>
  page: Ref<number>
  applied: () => AdminPostAppliedQuery
  /** 当前页超出最后一页时改写到最后一页 */
  replacePage: (lastPage: number) => Promise<unknown>
}

export function useAdminPostListData(options: AdminPostListDataOptions) {
  const { api, page } = options
  const { t } = useI18n()
  const items = ref<AdminPostListRow[]>([]),
    total = ref(0),
    pending = ref(false),
    error = ref('')
  const filters = ref<{ folders: string[]; tags: string[] }>({ folders: [], tags: [] }),
    filterError = ref(false)
  let requestVersion = 0

  async function loadFilters() {
    filterError.value = false
    try {
      filters.value = await api('/admin/posts/filters')
    } catch {
      filterError.value = true
    }
  }
  async function load() {
    const version = ++requestVersion
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: AdminPostListRow[]; total: number }>('/admin/posts', {
        query: { page: page.value, pageSize: ADMIN_POST_PAGE_SIZE, ...options.applied() },
      })
      if (version !== requestVersion) return
      items.value = result.items
      total.value = result.total
      const lastPage = Math.max(1, Math.ceil(result.total / ADMIN_POST_PAGE_SIZE))
      if (page.value > lastPage) await options.replacePage(lastPage)
    } catch {
      if (version === requestVersion) {
        items.value = []
        error.value = t('admin-content.postList.loadFailed')
      }
    } finally {
      if (version === requestVersion) pending.value = false
    }
  }
  /** 账号或内容上下文切换：丢弃进行中的请求并清空列表 */
  function reset() {
    requestVersion++
    items.value = []
    total.value = 0
    pending.value = false
  }
  const cancel = () => (requestVersion += 1)
  return { items, total, pending, error, filters, filterError, loadFilters, load, reset, cancel }
}
