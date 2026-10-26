/** @file useAdminPostStatusChange.ts @description 后台文章列表的单篇归档与恢复：确认、提交、清理公开缓存与结果提示 */
import type { Ref } from 'vue'
import type { AdminPostListRow } from './types'

export interface AdminPostStatusChangeOptions {
  api: ReturnType<typeof useAdminApi>
  /** 列表的错误提示，与读取失败共用 */
  error: Ref<string>
  isDisabled: () => boolean
  onChanged: (post: AdminPostListRow) => Promise<void>
}

export function useAdminPostStatusChange(options: AdminPostStatusChangeOptions) {
  const { api, error } = options
  const { t } = useI18n()
  const { success } = useToast()
  const working = ref(false)

  async function changeStatus(post: AdminPostListRow, restoreArchived: boolean) {
    if (options.isDisabled()) return
    const question = restoreArchived
      ? t('admin-content.postList.restoreConfirm', { title: post.title })
      : t('admin-content.postList.archiveConfirm', { title: post.title })
    if (!window.confirm(question)) return
    working.value = true
    error.value = ''
    try {
      await api(`/admin/posts/${post.id}${restoreArchived ? '/restore' : ''}`, {
        method: restoreArchived ? 'POST' : 'DELETE',
        query: { revision: post.revision },
      })
      clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
      success(restoreArchived ? t('admin-content.postList.restored') : t('admin-content.postList.archived'))
      await options.onChanged(post)
    } catch {
      error.value = restoreArchived
        ? t('admin-content.postList.restoreFailed')
        : t('admin-content.postList.archiveFailed')
    } finally {
      working.value = false
    }
  }
  const archive = (post: AdminPostListRow) => void changeStatus(post, false)
  const restorePost = (post: AdminPostListRow) => void changeStatus(post, true)
  return { working, archive, restorePost }
}
