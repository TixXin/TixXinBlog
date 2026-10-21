/**
 * @file content-import-dto.ts
 * @description 迁入任务状态与计划的响应格式化及多语言呈现。
 */
import type { ContentImport, ContentImportPlan } from '../../entities/content-import.entity'
import { packageHash } from './content-package'
import { DEFAULT_API_LOCALE, translateStored, type ApiLocale } from '../../common/i18n'

type PlanView = Omit<ContentImportPlan, 'basis'>

const PLAN_ROWS = [
  'posts',
  'flashes',
  'moments',
  'guestbook',
  'gallery',
  'projects',
  'links',
  'prompts',
  'subscriptions',
] as const

/** 计划中的原因与错误以中文持久化并参与确认哈希；只在返回副本里按请求语言翻译，不改动实体 */
export function localizedPlan(plan: PlanView, locale: ApiLocale): PlanView {
  if (locale === DEFAULT_API_LOCALE) return plan
  const view: PlanView = { ...plan, errors: plan.errors.map((text) => translateStored(locale, text)) }
  for (const name of PLAN_ROWS) {
    const rows = plan[name] as { reason: string }[] | undefined
    if (rows)
      (view as Record<string, unknown>)[name] = rows.map((row) => ({
        ...row,
        reason: translateStored(locale, row.reason),
      }))
  }
  return view
}

export function formatImportJobDto(job: ContentImport, locale: ApiLocale = DEFAULT_API_LOCALE) {
  const { basis: ignoredBasis, ...stored } = job.plan
  void ignoredBasis
  const plan = localizedPlan(stored, locale)
  return {
    ticket: job.id,
    // 确认哈希始终基于持久化的中文计划，与请求语言无关。
    confirmation: packageHash(job.plan),
    settingsPreview: job.includeSettings ? job.payload?.site : undefined,
    gallerySettingsPreview: job.includeSettings ? job.payload?.gallerySettings : undefined,
    linkSettingsPreview: job.includeSettings ? job.payload?.linkSettings : undefined,
    strategy: job.strategy,
    includeSettings: job.includeSettings,
    plan,
    createdAt: job.createdAt.toISOString(),
    expiresAt: job.expiresAt.toISOString(),
    started: !!job.startedAt,
    completed: !!job.completedAt,
    expired: !job.completedAt && job.expiresAt <= new Date(),
    result: job.result,
    error: job.lastError ? translateStored(locale, job.lastError) : job.lastError,
  }
}
