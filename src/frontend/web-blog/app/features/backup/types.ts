/**
 * @file types.ts
 * @description 内容迁入票据的展示契约，预览不包含正文或图片字节。
 */
import type { SiteSettingsData } from '~/features/site/settings'
import type { GearItem } from '~/features/gallery/types'
import type { Translate } from '~/utils/format'
/**
 * 执行导入时提交的确认原值。后端按该中文原文校验（backup.controller 的 IsIn），属于接口协议，不随界面语言变化。
 */
export const IMPORT_ACKNOWLEDGEMENT = '导入为新草稿'
/** 界面要求用户亲手输入的当前语言短语（中文界面与 IMPORT_ACKNOWLEDGEMENT 相同） */
export const IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY = 'admin-system.maintenance.job.acknowledgementPhrase'
/** 输入与当前语言短语完全一致时返回后端认可的原值，否则返回 null，不执行导入 */
export function importAcknowledgement(input: string, t: Translate): string | null {
  return input === t(IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY) ? IMPORT_ACKNOWLEDGEMENT : null
}
export interface ContentImportView {
  ticket: string
  confirmation: string
  strategy: 'skip' | 'copy'
  includeSettings: boolean
  createdAt: string
  expiresAt: string
  started: boolean
  completed: boolean
  expired: boolean
  error?: string
  settingsPreview?: Omit<SiteSettingsData, 'revision' | 'updatedAt' | 'announcementUpdatedAt'>
  gallerySettingsPreview?: { gear: GearItem[] } | null
  linkSettingsPreview?: { rules: string[] } | null
  plan: {
    omittedRelations?: number
    ready: boolean
    errors: string[]
    posts: { sourceId: number; title: string; skip: boolean; slug: string; reason: string }[]
    flashes: { sourceId: string; title: string; skip: boolean; reason: string }[]
    moments?: { sourceId: string; title: string; skip: boolean; reason: string }[]
    guestbook?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    gallery?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    projects?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    links?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    prompts?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    subscriptions?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    counts: {
      posts: number
      flashes: number
      moments?: number
      guestbook?: number
      gallery?: number
      projects?: number
      links?: number
      prompts?: number
      subscriptions?: number
      comments: number
      skipped: number
      media: number
      files: number
      settings: boolean
    }
  }
  result?: {
    relations?: { applied: number; omitted: number }
    posts: { sourceId: number; id: number }[]
    flashes: { sourceId: string; id: string }[]
    moments?: { sourceId: string; id: string }[]
    guestbook?: { sourceId: number; id: number }[]
    gallery?: { sourceId: number; id: number }[]
    projects?: { sourceId: number; id: number }[]
    links?: { sourceId: number; id: number }[]
    prompts?: { sourceId: number; id: number }[]
    subscriptions?: { sourceId: number; id: number }[]
    comments: number
    media: number
    files: number
    settings: boolean
  }
}
