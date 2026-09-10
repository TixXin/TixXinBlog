/**
 * @file content-import.entity.ts
 * @description 有期限的内容包预览与幂等导入结果，原始内容仅限上传账号读取。
 */
import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import type { ContentPackage } from '../modules/backup/content-package'
export interface ContentImportPlan {
  basis: string
  ready: boolean
  errors: string[]
  posts: { sourceId: number; title: string; skip: boolean; slug: string; reason: string }[]
  flashes: { sourceId: string; title: string; skip: boolean; reason: string }[]
  moments: { sourceId: string; title: string; skip: boolean; reason: string; linkedArticleId: number | null }[]
  guestbook: {
    sourceId: number
    title: string
    skip: boolean
    reason: string
    targetId?: number
    duplicateOf?: number
  }[]
  gallery: { sourceId: number; title: string; skip: boolean; reason: string }[]
  media: { id: string; create: boolean; writeFile: boolean; skip: boolean }[]
  counts: {
    posts: number
    flashes: number
    moments: number
    guestbook: number
    gallery: number
    comments: number
    skipped: number
    media: number
    files: number
    settings: boolean
  }
  siteRevision: number
  policyRevision: number
  gallerySettingsRevision: number
}
export interface ContentImportResult {
  posts: { sourceId: number; id: number }[]
  flashes: { sourceId: string; id: string }[]
  moments: { sourceId: string; id: string }[]
  guestbook: { sourceId: number; id: number }[]
  gallery: { sourceId: number; id: number }[]
  comments: number
  media: number
  files: number
  settings: boolean
}
@Entity({ tableName: 'content_import' })
export class ContentImport {
  [OptionalProps]?: 'createdAt'
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'uuid' }) @Index() actorId!: string
  @Property({ type: 'integer' }) sessionVersion!: number
  @Property({ type: 'text' }) strategy!: 'skip' | 'copy'
  @Property({ type: 'boolean' }) includeSettings!: boolean
  @Property({ type: 'text' }) fileHash!: string
  @Property({ type: 'json', nullable: true }) payload?: ContentPackage
  @Property({ type: 'json' }) plan!: ContentImportPlan
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime' }) @Index() expiresAt!: Date
  @Property({ type: 'datetime', nullable: true }) startedAt?: Date
  @Property({ type: 'datetime', nullable: true }) completedAt?: Date
  @Property({ type: 'json', nullable: true }) result?: ContentImportResult
  @Property({ type: 'text', nullable: true }) lastError?: string
}
