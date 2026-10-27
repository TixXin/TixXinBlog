/** @file editorSave.ts @description 文章编辑的服务器读写：首次读取与筛选项、保存与新建跳转、历史修订恢复，版本冲突时读取最新版本供比较 */
import type { AdminPostDraft } from './adminTypes'
import { splitPostTags, type PostEditorSession } from './editorSession'

const statusOf = (cause: unknown) => (cause as { statusCode?: number }).statusCode ?? 0

/** 读取服务器最新版本，修订号与当前草稿不同才登记冲突 */
async function readLatest(s: PostEditorSession, postId: number) {
  const latest = await s.api<AdminPostDraft>(`/admin/posts/${postId}`)
  if (latest.revision !== s.draft.value.revision) s.conflict.value = latest
}

export async function loadPost(s: PostEditorSession) {
  if (!(await s.auth.restore())) {
    await navigateTo({ path: '/admin/login', query: { next: s.route.path } })
    return
  }
  s.pending.value = true
  try {
    if (s.id) s.draft.value = await s.api<AdminPostDraft>(`/admin/posts/${s.id}`)
    if (s.draft.value.deletedAt) {
      s.error.value = s.t('admin-content.postSave.inTrash')
      return
    }
    s.tags.value = s.draft.value.tags.join(', ')
    s.baseline.value = s.snapshot.value
    s.ready.value = true
    if (s.auth.currentUser.value) s.recovery.initialize(s.auth.currentUser.value.id)
    s.autoSavePaused.value = s.recovery.recoveries.value.length > 0
    try {
      s.options.value = await s.api('/admin/posts/filters')
    } catch {
      s.error.value = s.t('admin-content.postSave.optionsFailed')
    }
  } catch {
    s.error.value = s.t('admin-content.postSave.loadFailed')
  } finally {
    s.pending.value = false
  }
}

/** 保存成功：更新基线、清理本次恢复副本与公开缓存，新文章跳到编辑地址 */
async function savedPost(
  s: PostEditorSession,
  value: AdminPostDraft,
  status: AdminPostDraft['status'],
  automatic: boolean,
) {
  s.acceptSaved(value)
  s.conflict.value = null
  s.autoSavePaused.value = false
  s.recovery.clearSaved(s.session.recoveredSourceKey)
  s.session.recoveredSourceKey = undefined
  if (!automatic) s.success(s.t(`admin-content.postSave.saved.${status}`))
  clearNuxtData(
    (key) =>
      key.startsWith('article-') || key === 'post-list' || key.startsWith('post-list:') || key === 'post-metadata',
  )
  if (!s.id) await navigateTo(`/admin/posts/${s.draft.value.id}`, { replace: true })
}

export async function savePost(s: PostEditorSession, status: AdminPostDraft['status'], automatic = false) {
  if (s.pending.value || !s.ready.value) return
  if (s.dirty.value) s.recovery.persist(s.localForCompare.value)
  s.pending.value = true
  s.automaticSaving.value = automatic
  s.error.value = ''
  const { id: savedId, savedAt: _savedAt, deletedAt: _deletedAt, ...body } = s.draft.value
  try {
    const value = await s.api<AdminPostDraft>(savedId ? `/admin/posts/${savedId}` : '/admin/posts', {
      method: savedId ? 'PATCH' : 'POST',
      body: { ...body, status, tags: splitPostTags(s.tags.value) },
    })
    await savedPost(s, value, status, automatic)
  } catch (cause) {
    s.autoSavePaused.value = true
    s.error.value = apiErrorMessage(cause, 'admin-content.postSave.saveFailed', { t: s.t })
    if (savedId && [409, 428].includes(statusOf(cause))) {
      await readLatest(s, savedId).catch(() => {
        s.error.value = s.t('admin-content.postSave.serverReadFailed', { message: s.error.value })
      })
    }
  } finally {
    s.pending.value = false
    s.automaticSaving.value = false
  }
}

export async function restoreHistorical(s: PostEditorSession, historical: number) {
  if (s.pending.value || !s.draft.value.id) return
  if (!window.confirm(s.t('admin-content.postSave.restoreRevisionConfirm'))) return
  if (s.dirty.value && !s.recovery.preserve(s.localForCompare.value)) return
  s.pending.value = true
  s.error.value = ''
  try {
    s.acceptSaved(
      await s.api<AdminPostDraft>(`/admin/posts/${s.draft.value.id}/revisions/${historical}/restore`, {
        method: 'POST',
        body: { revision: s.draft.value.revision },
      }),
    )
    s.conflict.value = null
    s.autoSavePaused.value = false
    s.recovery.clearSaved()
    clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
    s.success(s.t('admin-content.postSave.revisionRestored'))
  } catch (cause) {
    s.autoSavePaused.value = true
    s.error.value = apiErrorMessage(cause, 'admin-content.postSave.revisionRestoreFailed', { t: s.t })
    if (statusOf(cause) === 409)
      await readLatest(s, s.draft.value.id!).catch(() => {
        /* 保留恢复失败提示及当前输入。 */
      })
  } finally {
    s.pending.value = false
  }
}
