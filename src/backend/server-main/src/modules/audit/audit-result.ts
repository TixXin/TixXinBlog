/**
 * @file audit-result.ts
 * @description 根据请求正文与响应构造审计摘要对象
 */
import { isUUID } from 'class-validator'
import type { AuditSummary } from '../../entities/audit-entry.entity'
import { zh } from '../../common/i18n'
import { fields } from './audit-fields'

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function auditResult(
  body: unknown,
  response: unknown,
): { summary: AuditSummary; resourceId?: string; partial: boolean; failed: boolean } {
  const input = object(body)
  const envelope = object(response)
  const value = 'code' in envelope && 'data' in envelope ? object(envelope.data) : envelope
  const summary: AuditSummary = {
    fields: Object.keys(input)
      .filter((key) => Object.hasOwn(fields, key))
      .map((key) => zh(fields[key]!))
      .slice(0, 24),
  }
  if (Number.isSafeInteger(input.revision) && Number(input.revision) >= 0)
    summary.submittedVersion = Number(input.revision)
  if (Number.isSafeInteger(value.revision) && Number(value.revision) >= 0)
    summary.currentVersion = Number(value.revision)
  const counts: Record<string, number> = {}
  for (const key of [
    'successCount',
    'failedCount',
    'pendingCount',
    'allowedCount',
    'deleted',
    'revoked',
    'byteSize',
    'width',
    'height',
    'exportedPosts',
    'exportedFlashes',
    'exportedMoments',
    'exportedGuestbook',
    'exportedGallery',
    'exportedProjects',
    'exportedSubscriptions',
    'exportedLinks',
    'exportedPrompts',
    'exportedMedia',
    'importedPosts',
    'importedFlashes',
    'importedMoments',
    'importedGuestbook',
    'importedGallery',
    'importedProjects',
    'importedSubscriptions',
    'importedLinks',
    'importedPrompts',
    'importedComments',
    'importedMedia',
  ])
    if (Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) counts[key] = Number(value[key])
  if (Object.keys(counts).length) summary.counts = counts
  if (
    typeof value.status === 'string' &&
    ['draft', 'published', 'archived', 'pending', 'hidden', 'spam', 'withdrawn'].includes(value.status)
  )
    summary.targetState = value.status
  if (typeof value.requireApproval === 'boolean')
    summary.targetState = value.requireApproval ? 'review-required' : 'direct-publication'
  const id = value.ticket ?? value.id
  const resourceId =
    typeof id === 'number' && Number.isSafeInteger(id)
      ? String(id)
      : typeof id === 'string' && isUUID(id)
        ? id.toLowerCase()
        : undefined
  return {
    summary,
    resourceId,
    partial: Number(value.failedCount) > 0 && Number(value.successCount) > 0,
    failed: Number(value.failedCount) > 0 && Number(value.successCount) === 0,
  }
}
