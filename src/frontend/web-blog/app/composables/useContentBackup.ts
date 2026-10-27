/**
 * @file useContentBackup.ts
 * @description 内容包下载与幂等导入绑定发起账号、内容库和提交快照；身份变化后保留原文件与票据。按会话、传输、导入与生命周期组装。
 */
import { createBackupSession, type BackupOwner } from '~/features/backup/backupSession'
import { choose, exportPackage, loadRecentFor } from '~/features/backup/backupTransfer'
import { execute, preview, read, repreview } from '~/features/backup/backupImport'
import { useBackupLifecycle } from '~/features/backup/backupLifecycle'

export function useContentBackup() {
  const s = createBackupSession()
  const readTicket = (ticket = s.job.value?.ticket || s.requestId.value) => read(s, ticket)
  useBackupLifecycle(s, { loadRecentFor: (owner: BackupOwner) => loadRecentFor(s, owner), read: readTicket })
  return {
    pending: s.pending,
    error: s.error,
    mediaIncluded: s.mediaIncluded,
    file: s.file,
    strategy: s.strategy,
    includeSettings: s.includeSettings,
    requestId: s.requestId,
    job: s.job,
    acknowledgement: s.acknowledgement,
    recent: s.recent,
    recentError: s.recentError,
    exportPackage: () => exportPackage(s),
    choose: (selected: File | null) => choose(s, selected),
    preview: () => preview(s),
    read: readTicket,
    repreview: () => repreview(s),
    execute: () => execute(s),
    loadRecent: () => loadRecentFor(s, s.captureOwner()),
  }
}
