/** @file backupTransfer.ts @description 内容包下载、导入文件选择与最近导入记录；选择变化即换新上传标识并清空旧票据 */
import type { BackupOwner, BackupRecentItem, BackupSession } from './backupSession'
import { authenticated, begin, fail, finish } from './backupRequest'

/** 清空当前票据与确认输入，下一次预览重新核对 */
export function resetJob(s: BackupSession) {
  s.job.value = null
  s.session.jobOwner = null
  s.acknowledgement.value = ''
}

export async function exportPackage(s: BackupSession) {
  if (s.pending.value) return
  const { owner, version } = begin(s)
  const body = { mediaIncluded: s.mediaIncluded.value }
  try {
    const response = await authenticated(s, owner, (headers) =>
      $fetch.raw<Blob>('/api/v1/admin/backup/export', {
        method: 'POST',
        body,
        headers,
        credentials: 'include',
        responseType: 'blob',
        retry: 0,
        timeout: 120000,
      }),
    )
    s.assertOwner(owner)
    if (!response._data) throw new Error('下载内容为空')
    const url = URL.createObjectURL(response._data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download =
      /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'blog-content.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    s.toast.success(s.t('admin-system.backup.downloadStarted'))
  } catch (cause) {
    await fail(s, cause, 'admin-system.backup.exportFailed', { owner, version })
  } finally {
    finish(s, version)
  }
}

export function choose(s: BackupSession, selected: File | null) {
  if (s.pending.value) return
  if (selected && (selected.size > 50 * 1024 * 1024 || !selected.name.toLowerCase().endsWith('.json'))) {
    s.error.value = s.t('admin-system.backup.fileInvalid')
    return
  }
  s.file.value = selected
  s.session.selectionActor = s.auth.currentUser.value?.id
  s.requestId.value = selected ? crypto.randomUUID() : ''
  resetJob(s)
  s.error.value = ''
}

export async function loadRecentFor(s: BackupSession, owner: BackupOwner) {
  const version = ++s.session.recentVersion
  s.recentError.value = ''
  try {
    const values = await authenticated(s, owner, () => s.api<BackupRecentItem[]>('/admin/backup/imports'), false)
    if (version === s.session.recentVersion && s.owns(owner)) s.recent.value = values
  } catch {
    if (s.session.alive && version === s.session.recentVersion && s.owns(owner))
      s.recentError.value = s.t('admin-system.backup.recentFailed')
  }
}
