/** @file types.ts @description 博主通知与任务状态的前端公开管理投影，不含密钥与存储路径 */
export interface OwnerNotification {
  id: string
  kind: 'comment' | 'guestbook' | 'moment-comment' | 'task'
  reason: string
  readAt: string | null
  createdAt: string
  state: 'pending_review' | 'awaiting_reply' | 'available' | 'handled' | 'unavailable' | 'failed'
  url: string | null
}
export interface NotificationList {
  items: OwnerNotification[]
  total: number
  unread: number
  page: number
  pageSize: number
}
export interface OperationTask {
  id: string
  kind: 'mail' | 'backup'
  state: string
  attempts: number
  maxAttempts: number
  createdAt: string
  availableAt: string
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  outcome: {
    accepted: boolean
    suppressed: boolean
    integrityVerified: boolean
    transferVerified: boolean
    transferConfigured: boolean
    recoveryVerified: boolean
  } | null
}
export interface OperationStatus {
  configured: {
    email: { enabled: boolean; configured: boolean }
    backup: { enabled: boolean; configured: boolean; transferConfigured: boolean }
    workerEnabled: boolean
  }
  databaseAvailable: boolean
  runtime: {
    control: { externalPaused: boolean; backupPaused: boolean; revision: number; reason: string }
    tasks: OperationTask[]
    total: number
    failures: number
    lastVerifiedBackup: string | null
    lastRecovery: string | null
  } | null
  storage: { availableBytes: number; totalBytes: number; low: boolean } | null
  backupOverdue: boolean
  page: number
  pageSize: number
  generatedAt: string
}
