/**
 * @file types.ts
 * @description 内容迁入票据的展示契约，预览不包含正文或图片字节。
 */
import type { SiteSettingsData } from '~/features/site/settings'
import type { GearItem } from '~/features/gallery/types'
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
  plan: {
    ready: boolean
    errors: string[]
    posts: { sourceId: number; title: string; skip: boolean; slug: string; reason: string }[]
    flashes: { sourceId: string; title: string; skip: boolean; reason: string }[]
    moments?: { sourceId: string; title: string; skip: boolean; reason: string }[]
    guestbook?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    gallery?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    projects?: { sourceId: number; title: string; skip: boolean; reason: string }[]
    counts: {
      posts: number
      flashes: number
      moments?: number
      guestbook?: number
      gallery?: number
      projects?: number
      comments: number
      skipped: number
      media: number
      files: number
      settings: boolean
    }
  }
  result?: {
    posts: { sourceId: number; id: number }[]
    flashes: { sourceId: string; id: string }[]
    moments?: { sourceId: string; id: string }[]
    guestbook?: { sourceId: number; id: number }[]
    gallery?: { sourceId: number; id: number }[]
    projects?: { sourceId: number; id: number }[]
    comments: number
    media: number
    files: number
    settings: boolean
  }
}
