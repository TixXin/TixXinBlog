/** @file backupImport.ts @description 内容包导入票据：生成预览、查询、重新预览与确认执行；只接受仍属于发起账号与内容库的结果 */
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { importAcknowledgement, type ContentImportView } from './types'
import type { BackupOwner, BackupSession } from './backupSession'
import { authenticated, begin, fail, finish } from './backupRequest'
import { loadRecentFor } from './backupTransfer'

async function accept(s: BackupSession, value: ContentImportView, owner: BackupOwner) {
  s.assertOwner(owner)
  // 执行响应丢失后查询同一票据，也必须撤销导入前的公开数据。
  if (value.completed) invalidatePublicReads(s.app)
  s.job.value = value
  s.session.jobOwner = { ...owner }
  if (value.completed && value.result?.settings) {
    await s.site.refresh()
    s.assertOwner(owner)
  }
  await loadRecentFor(s, owner)
  s.assertOwner(owner)
}

export async function preview(s: BackupSession) {
  if (s.pending.value || !s.file.value) return
  const { owner, version } = begin(s)
  const selected = s.file.value,
    ticket = s.requestId.value,
    selectedStrategy = s.strategy.value,
    settings = s.includeSettings.value
  // File/Blob 保持原对象，FormData 在发起时组装一次；重试不再读取正在变化的表单。
  const form = new FormData()
  form.append('file', selected, selected.name)
  form.append('requestId', ticket)
  form.append('strategy', selectedStrategy)
  form.append('includeSettings', String(settings))
  try {
    const value = await authenticated(s, owner, (headers) =>
      $fetch<{ data: ContentImportView }>('/api/v1/admin/backup/imports/preview', {
        method: 'POST',
        body: form,
        headers,
        credentials: 'include',
        retry: 0,
        timeout: 120000,
      }),
    )
    s.assertOwner(owner)
    if (s.requestId.value !== ticket || s.file.value !== selected)
      throw new Error('导入选项已变化，请查询原票据后重新核对')
    s.acknowledgement.value = ''
    await accept(s, value.data, owner)
  } catch (cause) {
    await fail(s, cause, 'admin-system.backup.previewFailed', { owner, version })
  } finally {
    finish(s, version)
  }
}

export async function read(s: BackupSession, ticket: string) {
  if (!ticket || s.pending.value) return
  const { owner, version } = begin(s, false)
  try {
    await accept(
      s,
      await authenticated(s, owner, () => s.api<ContentImportView>(`/admin/backup/imports/${ticket}`), false),
      owner,
    )
  } catch (cause) {
    await fail(s, cause, 'admin-system.backup.readFailed', { owner, version })
  } finally {
    finish(s, version)
  }
}

interface TicketSubmission {
  expected: BackupOwner
  path: string
  body?: Record<string, unknown>
  /** 重新预览会让旧的确认输入失效；执行沿用用户刚输入的确认 */
  clearAcknowledgement: boolean
  fallbackKey: string
  after?: (owner: BackupOwner) => void
}

/** 对已有票据发起带副作用的请求：校验票据归属后接受结果 */
async function submitTicket(s: BackupSession, request: TicketSubmission) {
  const { owner, version } = begin(s)
  if (request.clearAcknowledgement) s.acknowledgement.value = ''
  const options = request.body ? { method: 'POST' as const, body: request.body } : { method: 'POST' as const }
  try {
    s.assertOwner(request.expected)
    await accept(
      s,
      await authenticated(
        s,
        owner,
        () => s.api<ContentImportView>(request.path, { ...options, timeout: 120000 }),
        false,
      ),
      owner,
    )
    request.after?.(owner)
  } catch (cause) {
    await fail(s, cause, request.fallbackKey, { owner, version })
  } finally {
    finish(s, version)
  }
}

export async function repreview(s: BackupSession) {
  if (!s.job.value || s.pending.value || !s.session.jobOwner) return
  await submitTicket(s, {
    expected: s.session.jobOwner,
    path: `/admin/backup/imports/${s.job.value.ticket}/repreview`,
    clearAcknowledgement: true,
    fallbackKey: 'admin-system.backup.repreviewFailed',
  })
}

export async function execute(s: BackupSession) {
  // 用户输入当前界面语言的短语，提交时换回后端认可的原值。
  const confirmed = importAcknowledgement(s.acknowledgement.value, s.translate)
  if (!s.job.value || s.pending.value || !s.session.jobOwner || !confirmed) return
  await submitTicket(s, {
    expected: s.session.jobOwner,
    path: `/admin/backup/imports/${s.job.value.ticket}/execute`,
    body: { acknowledgement: confirmed, confirmation: s.job.value.confirmation },
    clearAcknowledgement: false,
    fallbackKey: 'admin-system.backup.executeFailed',
    after: (owner) => {
      s.assertOwner(owner)
      if (s.job.value?.completed) {
        s.toast.success(s.t('admin-system.backup.executeSucceeded'))
        clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
      }
    },
  })
}
