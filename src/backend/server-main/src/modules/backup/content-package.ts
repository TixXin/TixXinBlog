/**
 * @file content-package.ts
 * @description 内容迁入包的固定版本与严格校验；完整数据库恢复由独立维护命令负责。
 */
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { isISO8601, isUUID, validateSync } from 'class-validator'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { SavePostDto } from '../post/dto/save-post.dto'
import { SaveFlashDto } from '../flash/admin-flash.controller'
import { SaveMomentDto } from '../moment/moment.dto'
import { momentUrl, momentValues } from '../moment/moment-values'
import { MOMENT_COMMENT_STATUSES } from '../../entities/moment-comment.entity'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'
import { FLASH_COMMENT_STATUSES } from '../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { SaveSiteSettingsDto } from '../site/site-settings.dto'
import { normalizeSiteExtrasInput, SiteExtrasError } from '../site/site-navigation'
/** v12 引入的站点字段 */
const SITE_EXTRA_KEYS = ['navigation', 'footerLinks', 'quotes', 'icpNumber', 'icpUrl', 'copyright']
import { COMMENT_STATUSES } from '../../entities/comment.entity'
import type { CommentStatus } from '../../entities/comment.entity'
import { POST_TAG_COLORS } from '../../entities/post-tag.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import { GALLERY_STATUSES } from '../../entities/gallery-photo.entity'
import type { GalleryStatus } from '../../entities/gallery-photo.entity'
import { galleryExternalUrl } from '../gallery/gallery-values'
import { projectUrl } from '../project/project-values'
import { linkLogoUrl, linkUrl } from '../link/link-values'
import { SavePromptDto } from '../prompts/prompts.dto'
import { promptValues } from '../prompts/prompts-values'
import { parsePackageSubscriptions } from './content-package-subscriptions'
import type { PackageSubscription } from './content-package-subscriptions'
export type { PackageSubscription } from './content-package-subscriptions'
import type { ContentRelation } from '../../common/types/content-relation'
import { msg, type MessageKey } from '../../common/i18n'
export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024
export interface PackageComment {
  sourceId: number
  parentId: number | null
  author: string
  avatar: string
  content: string
  isOwner: boolean
  status: CommentStatus
  createdAt: string
}
export interface PackagePost {
  sourceId: number
  createdAt: string
  publishedAt: string
  deleted: boolean
  values: Omit<SavePostDto, 'revision'>
  comments: PackageComment[]
}
export interface PackageFlash {
  sourceId: string
  createdAt: string
  values: SaveFlashDto
  /** status 自 v13 起必填；v1–v12 不得携带，读取时按已发布处理 */
  comments: { author: string; avatar: string; content: string; status: FlashCommentStatus; createdAt: string }[]
}
export interface PackageMedia {
  description: string
  id: string
  name: string
  alt: string
  sha256: string
  byteSize: number
  width: number
  height: number
  createdAt: string
  deleted: boolean
  base64?: string
}
export interface PackageMoment {
  sourceId: string
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: Omit<SaveMomentDto, 'requestId' | 'revision'>
  comments: {
    sourceId: string
    author: string
    avatar: string
    content: string
    isOwner: boolean
    status: MomentCommentStatus
    deleted: boolean
    createdAt: string
  }[]
}
export interface PackageGuestbook {
  sourceId: number
  createdAt: string
  deleted: boolean
  author: string
  avatar: string
  content: string
  isOwner: boolean
  status: GuestbookStatus
  isPinned: boolean
  replyToId: number | null
  /** v11 起可选：提交时记录的浏览器与地区展示文案 */
  browser?: string
  region?: string
}
export interface ContentPackage {
  format: 'tixxin-content'
  version: 14
  omittedRelations: number
  exportedAt: string
  mediaIncluded: boolean
  posts: PackagePost[]
  flashes: PackageFlash[]
  moments: PackageMoment[]
  guestbook: PackageGuestbook[]
  gallery: PackageGalleryPhoto[]
  projects: PackageProject[]
  links: PackageLink[]
  prompts: PackageImagePrompt[]
  subscriptions: PackageSubscription[]
  linkSettings: { rules: string[] } | null
  gallerySettings: {
    gear: { icon: 'lucide:camera' | 'lucide:circle' | 'lucide:smartphone'; name: string; description: string }[]
  } | null
  folders: string[]
  tags: { label: string; color: PostTagColor }[]
  site: Omit<SaveSiteSettingsDto, 'revision'>
  requireCommentApproval: boolean
  media: PackageMedia[]
}
export interface PackageGalleryPhoto {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: {
    relatedContent: ContentRelation[]
    mediaId: string | null
    externalUrl: string | null
    title: string
    description: string
    category: string
    takenOn: string | null
    location: string
    device: string
    status: GalleryStatus
    sortOrder: number
  }
}
export interface PackageProject {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: {
    relatedContent: ContentRelation[]
    title: string
    description: string
    coverMediaId: string | null
    tags: { label: string; color: 'emerald' | 'blue' | 'amber' | 'sky' | 'rose' | 'slate' }[]
    links: { kind: 'source' | 'demo' | 'docs' | 'download'; href: string }[]
    progress: 'active' | 'dev' | 'archived'
    status: 'draft' | 'published' | 'withdrawn'
    sortOrder: number
  }
}
export interface PackageImagePrompt {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  values: {
    title: string
    description: string
    prompt: string
    negativePrompt: string
    model: string
    tags: string[]
    mediaId: string | null
    externalImageUrl: string | null
    imageAlt: string
    sourceUrl: string
    status: 'draft' | 'published'
  }
}
interface PackageLink {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: {
    name: string
    description: string
    url: string
    logoMediaId: string | null
    logoUrl: string | null
    status: 'draft' | 'published' | 'withdrawn'
    isFeatured: boolean
    sortOrder: number
  }
}
export function packageHash(value: unknown): string {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item: unknown) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      ),
    )
    .digest('hex')
}
/** 中文字段名各自登记为字典条目，只有英文字段路径作为 {path} 参数 */
type PackageFieldKey = Extract<MessageKey, `package.field${string}`>
function fail(path: string | PackageFieldKey): never {
  throw new BadRequestException(
    path.startsWith('package.field') ? msg(path as PackageFieldKey) : msg('package.invalidField', { path }),
  )
}
function text(value: unknown, path: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || (min > 0 && !value.trim()))
    return fail(path)
  return value
}
function number(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483647) return fail(path)
  return Number(value)
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path)
  return value
}
function date(value: unknown, path: string): string {
  const result = text(value, path, 40, 1)
  if (!isISO8601(result, { strict: true }) || !Number.isFinite(Date.parse(result))) return fail(path)
  return new Date(result).toISOString()
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(path)
  return value
}
function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !keys.includes(key))) return fail(path)
  return result
}
function packageImageUrl(value: string): boolean {
  if (!value || /^\/(?!\/)[^\\\s]*$/.test(value)) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
function dto<T extends object>(type: new () => T, value: unknown, path: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const result = plainToInstance(type, value)
  if (validateSync(result, { whitelist: true, forbidNonWhitelisted: true }).length) return fail(path)
  return result
}
export async function parseContentPackage(buffer: Buffer): Promise<ContentPackage> {
  if (!buffer.length || buffer.length > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException(msg('package.tooLarge'))
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch {
    throw new BadRequestException(msg('package.invalidJson'))
  }
  let nodes = 0
  const checkKeys = (value: unknown, depth = 0) => {
    if (++nodes > 1000000 || depth > 32) fail('package.fieldNestingOrCount')
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('package.fieldUnsupportedKey')
        checkKeys(child, depth + 1)
      }
  }
  checkKeys(input)
  const source = record(input, 'package.fieldRoot', [
    'format',
    'version',
    'exportedAt',
    'mediaIncluded',
    'posts',
    'flashes',
    'moments',
    'guestbook',
    'gallery',
    'projects',
    'links',
    'prompts',
    'subscriptions',
    'linkSettings',
    'gallerySettings',
    'folders',
    'tags',
    'site',
    'requireCommentApproval',
    'media',
    'omittedRelations',
  ])
  if (
    source.format !== 'tixxin-content' ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(Number(source.version)) ||
    typeof source.version !== 'number'
  )
    throw new BadRequestException(msg('package.unsupportedVersion'))
  if (Number(source.version) < 9 && source.omittedRelations !== undefined) fail('package.fieldLegacyOmittedRelations')
  const omittedRelations = Number(source.version) >= 9 ? (source.omittedRelations as number) : 0
  if (!Number.isSafeInteger(omittedRelations) || omittedRelations < 0 || omittedRelations > 72000)
    fail('package.fieldOmittedRelations')
  const relations = (value: unknown, path: string, type: ContentRelation['type'], id: number): ContentRelation[] => {
    if (Number(source.version) < 9) {
      if (value !== undefined) fail('package.fieldLegacyRelations')
      return []
    }
    const seen = new Set<string>()
    return array(value, path, 12).map((item) => {
      const row = record(item, path, ['type', 'id'])
      if (!['post', 'project', 'gallery'].includes(String(row.type))) fail('package.fieldRelationType')
      const targetId = number(row.id, path + '.id')
      const key = `${row.type}:${targetId}`
      if (seen.has(key) || (row.type === type && targetId === id)) fail('package.fieldRelationDuplicateOrSelf')
      seen.add(key)
      return { type: row.type as ContentRelation['type'], id: targetId }
    })
  }
  if (source.version === 1 && source.moments !== undefined) fail('package.fieldV1Moments')
  if (Number(source.version) < 3 && source.guestbook !== undefined) fail('package.fieldV2Guestbook')
  if (Number(source.version) < 4 && (source.gallery !== undefined || source.gallerySettings !== undefined))
    fail('package.fieldV3Gallery')
  if (Number(source.version) < 5 && source.projects !== undefined) fail('package.fieldV4Projects')
  if (Number(source.version) < 6 && (source.links !== undefined || source.linkSettings !== undefined))
    fail('package.fieldV5Links')
  if (Number(source.version) < 10 && source.prompts !== undefined) fail('package.fieldV9Prompts')
  if (Number(source.version) < 11 && source.subscriptions !== undefined) fail('package.fieldV10Subscriptions')
  const subscriptions = parsePackageSubscriptions(Number(source.version) >= 11 ? source.subscriptions : [])
  const mediaIncluded = boolean(source.mediaIncluded, 'mediaIncluded')
  let commentsTotal = 0
  const posts = array(source.posts, 'posts', 1000).map((value, index): PackagePost => {
    const path = `posts[${index}]`
    const item = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values', 'comments'])
    const values = dto(SavePostDto, item.values, `${path}.values`)
    values.relatedContent = relations(
      (item.values as Record<string, unknown>).relatedContent,
      `${path}.relatedContent`,
      'post',
      number(item.sourceId, `${path}.sourceId`),
    )
    if (
      'revision' in (item.values as object) ||
      (values.cover && !packageImageUrl(values.cover)) ||
      values.tags.some((tag) => !tag.trim())
    )
      fail(`${path}.values`)
    const comments = array(item.comments, `${path}.comments`, 10000).map((value): PackageComment => {
      const row = record(value, `${path}.comments`, [
        'sourceId',
        'parentId',
        'author',
        'avatar',
        'content',
        'isOwner',
        'status',
        'createdAt',
      ])
      const avatar = text(row.avatar, 'package.fieldCommentAvatar', 2048)
      if (!packageImageUrl(avatar) || !COMMENT_STATUSES.includes(row.status as CommentStatus))
        fail('package.fieldCommentStatusOrAvatar')
      return {
        sourceId: number(row.sourceId, 'package.fieldCommentId'),
        parentId: row.parentId === null ? null : number(row.parentId, 'package.fieldCommentParentId'),
        author: text(row.author, 'package.fieldCommentAuthor', 80, 1),
        avatar,
        content: text(row.content, 'package.fieldCommentContent', 1000, 1),
        isOwner: boolean(row.isOwner, 'package.fieldCommentIsOwner'),
        status: row.status as CommentStatus,
        createdAt: date(row.createdAt, 'package.fieldCommentCreatedAt'),
      }
    })
    commentsTotal += comments.length
    const map = new Map(comments.map((comment) => [comment.sourceId, comment]))
    if (map.size !== comments.length) fail('package.fieldCommentIdDuplicate')
    for (const comment of comments) {
      let cursor = comment
      let depth = 0
      while (cursor.parentId !== null) {
        const parent = map.get(cursor.parentId)
        if (!parent || ++depth > 2) fail('package.fieldCommentNesting')
        cursor = parent
      }
    }
    return {
      sourceId: number(item.sourceId, `${path}.sourceId`),
      createdAt: date(item.createdAt, `${path}.createdAt`),
      publishedAt: date(item.publishedAt, `${path}.publishedAt`),
      deleted: boolean(item.deleted, `${path}.deleted`),
      values,
      comments,
    }
  })
  if (new Set(posts.map((post) => post.sourceId)).size !== posts.length) fail('package.fieldPostIdDuplicate')
  const flashes = array(source.flashes, 'flashes', 2000).map((value, index): PackageFlash => {
    const row = record(value, `flashes[${index}]`, ['sourceId', 'createdAt', 'values', 'comments'])
    const values = dto(SaveFlashDto, row.values, 'package.fieldFlashValues')
    if (
      !values.content?.trim() ||
      (values.images ?? []).some((url) => !packageImageUrl(url)) ||
      (values.tags ?? []).some((tag) => !tag.trim())
    )
      fail('package.fieldFlashContent')
    // v13 才引入闪念评论审核状态：旧包按未知字段拒绝夹带，读取时一律视为已发布。
    const withStatus = Number(source.version) >= 13
    const comments = array(row.comments, 'package.fieldFlashComment', 10000).map((value) => {
      const comment = record(value, 'package.fieldFlashComment', [
        'author',
        'avatar',
        'content',
        'createdAt',
        ...(withStatus ? ['status'] : []),
      ])
      const avatar = text(comment.avatar, 'package.fieldFlashCommentAvatar', 2048)
      if (!packageImageUrl(avatar)) fail('package.fieldFlashCommentAvatar')
      if (withStatus && !FLASH_COMMENT_STATUSES.includes(comment.status as FlashCommentStatus))
        fail('package.fieldFlashCommentStatus')
      return {
        author: text(comment.author, 'package.fieldFlashCommentAuthor', 80, 1),
        avatar,
        content: text(comment.content, 'package.fieldFlashCommentContent', 1000, 1),
        status: withStatus ? (comment.status as FlashCommentStatus) : 'published',
        createdAt: date(comment.createdAt, 'package.fieldFlashCommentCreatedAt'),
      }
    })
    commentsTotal += comments.length
    return {
      sourceId: text(row.sourceId, 'package.fieldFlashId', 120, 1),
      createdAt: date(row.createdAt, 'package.fieldFlashCreatedAt'),
      values,
      comments,
    }
  })
  const moments = array(source.version === 1 ? [] : source.moments, 'moments', 2000).map(
    (value, index): PackageMoment => {
      const path = `moments[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values', 'comments'])
      const rawValues = dto(SaveMomentDto, row.values, `${path}.values`)
      if ('requestId' in (row.values as object) || 'revision' in (row.values as object) || !rawValues.content?.trim())
        fail(`${path}.values`)
      const values = momentValues(rawValues)
      if (values.linkedArticleId && !posts.some((post) => post.sourceId === values.linkedArticleId))
        fail('package.fieldMomentArticleMissing')
      const comments = array(row.comments, `${path}.comments`, 10000).map(
        (value): PackageMoment['comments'][number] => {
          const comment = record(value, 'package.fieldMomentComment', [
            'sourceId',
            'author',
            'avatar',
            'content',
            'isOwner',
            'status',
            'deleted',
            'createdAt',
          ])
          if (!MOMENT_COMMENT_STATUSES.includes(comment.status as MomentCommentStatus))
            fail('package.fieldMomentCommentStatus')
          return {
            sourceId: text(comment.sourceId, 'package.fieldMomentCommentId', 120, 1),
            author: text(comment.author, 'package.fieldMomentCommentAuthor', 80, 1),
            avatar: momentUrl(text(comment.avatar, 'package.fieldMomentCommentAvatar', 2048), true, true),
            content: text(comment.content, 'package.fieldMomentCommentContent', 1000, 1),
            isOwner: boolean(comment.isOwner, 'package.fieldMomentCommentIsOwner'),
            status: comment.status as MomentCommentStatus,
            deleted: boolean(comment.deleted, 'package.fieldMomentCommentDeleted'),
            createdAt: date(comment.createdAt, 'package.fieldMomentCommentCreatedAt'),
          }
        },
      )
      if (new Set(comments.map((comment) => comment.sourceId)).size !== comments.length)
        fail('package.fieldMomentCommentIdDuplicate')
      commentsTotal += comments.length
      return {
        sourceId: text(row.sourceId, 'package.fieldMomentId', 120, 1),
        createdAt: date(row.createdAt, 'package.fieldMomentCreatedAt'),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, 'package.fieldMomentPublishedAt'),
        deleted: boolean(row.deleted, 'package.fieldMomentDeleted'),
        values,
        comments,
      }
    },
  )
  if (new Set(moments.map((note) => note.sourceId)).size !== moments.length) fail('package.fieldMomentIdDuplicate')
  const guestbook = array(Number(source.version) >= 3 ? source.guestbook : [], 'guestbook', 2000).map(
    (value, index): PackageGuestbook => {
      const path = `guestbook[${index}]`
      const row = record(value, path, [
        'sourceId',
        'createdAt',
        'deleted',
        'author',
        'avatar',
        'content',
        'isOwner',
        'status',
        'isPinned',
        'replyToId',
        // v11 起可选携带提交时的浏览器与地区；旧版本出现即按未知字段拒绝。
        ...(Number(source.version) >= 11 ? ['browser', 'region'] : []),
      ])
      const avatar = text(row.avatar, `${path}.avatar`, 2048)
      if (!packageImageUrl(avatar) || !GUESTBOOK_STATUSES.includes(row.status as GuestbookStatus)) fail(path)
      return {
        sourceId: number(row.sourceId, `${path}.sourceId`),
        createdAt: date(row.createdAt, `${path}.createdAt`),
        deleted: boolean(row.deleted, `${path}.deleted`),
        author: text(row.author, `${path}.author`, 80, 1),
        avatar,
        content: text(row.content, `${path}.content`, 500, 1),
        isOwner: boolean(row.isOwner, `${path}.isOwner`),
        status: row.status as GuestbookStatus,
        isPinned: boolean(row.isPinned, `${path}.isPinned`),
        replyToId: row.replyToId === null ? null : number(row.replyToId, `${path}.replyToId`),
        ...(row.browser !== undefined ? { browser: text(row.browser, `${path}.browser`, 40) } : {}),
        ...(row.region !== undefined ? { region: text(row.region, `${path}.region`, 40) } : {}),
      }
    },
  )
  const gallery = array(Number(source.version) >= 4 ? source.gallery : [], 'gallery', 3000).map(
    (value, index): PackageGalleryPhoto => {
      const path = `gallery[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
      const values = record(row.values, `${path}.values`, [
        'mediaId',
        ...(Number(source.version) >= 9 ? ['relatedContent'] : []),
        ...(Number(source.version) >= 7 ? ['externalUrl'] : []),
        'title',
        'description',
        'category',
        'takenOn',
        'location',
        'device',
        'status',
        'sortOrder',
      ])
      const mediaId =
        Number(source.version) >= 7 && values.mediaId === null ? null : text(values.mediaId, `${path}.mediaId`, 36, 1)
      const externalUrl =
        Number(source.version) >= 7 && values.externalUrl !== null
          ? galleryExternalUrl(text(values.externalUrl, `${path}.externalUrl`, 2048, 1))
          : null
      if (
        (mediaId !== null && !isUUID(mediaId, '4')) ||
        Boolean(mediaId) === Boolean(externalUrl) ||
        !GALLERY_STATUSES.includes(values.status as GalleryStatus)
      )
        fail(path)
      const takenOn = values.takenOn === null ? null : text(values.takenOn, `${path}.takenOn`, 10, 10)
      if (takenOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || !isISO8601(takenOn, { strict: true })))
        fail(`${path}.takenOn`)
      if (
        !Number.isInteger(values.sortOrder) ||
        Number(values.sortOrder) < -1000000 ||
        Number(values.sortOrder) > 1000000
      )
        fail(`${path}.sortOrder`)
      return {
        sourceId: number(row.sourceId, `${path}.sourceId`),
        createdAt: date(row.createdAt, `${path}.createdAt`),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
        deleted: boolean(row.deleted, `${path}.deleted`),
        values: {
          mediaId: mediaId?.toLowerCase() ?? null,
          relatedContent: relations(
            values.relatedContent,
            `${path}.relatedContent`,
            'gallery',
            number(row.sourceId, `${path}.sourceId`),
          ),
          externalUrl,
          title: text(values.title, `${path}.title`, 160, 1).trim(),
          description: text(values.description, `${path}.description`, 5000).trim(),
          category: text(values.category, `${path}.category`, 40).trim(),
          takenOn,
          location: text(values.location, `${path}.location`, 160).trim(),
          device: text(values.device, `${path}.device`, 160).trim(),
          status: values.status as GalleryStatus,
          sortOrder: Number(values.sortOrder),
        },
      }
    },
  )
  if (new Set(gallery.map((photo) => photo.sourceId)).size !== gallery.length) fail('package.fieldGalleryIdDuplicate')
  let gallerySettings: ContentPackage['gallerySettings'] = null
  if (Number(source.version) >= 4) {
    const settings = record(source.gallerySettings, 'gallerySettings', ['gear'])
    gallerySettings = {
      gear: array(settings.gear, 'gallerySettings.gear', 12).map((value) => {
        const row = record(value, 'package.fieldGalleryGear', ['icon', 'name', 'description'])
        if (typeof row.icon !== 'string' || !['lucide:camera', 'lucide:circle', 'lucide:smartphone'].includes(row.icon))
          fail('package.fieldGalleryGearIcon')
        return {
          icon: row.icon as 'lucide:camera' | 'lucide:circle' | 'lucide:smartphone',
          name: text(row.name, 'package.fieldGalleryGearName', 80, 1).trim(),
          description: text(row.description, 'package.fieldGalleryGearDescription', 300).trim(),
        }
      }),
    }
  }
  const projects = array(Number(source.version) >= 5 ? source.projects : [], 'projects', 2000).map(
    (value, index): PackageProject => {
      const path = `projects[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
      const values = record(row.values, `${path}.values`, [
        'title',
        ...(Number(source.version) >= 9 ? ['relatedContent'] : []),
        'description',
        'coverMediaId',
        'tags',
        'links',
        'progress',
        'status',
        'sortOrder',
      ])
      const coverMediaId =
        values.coverMediaId === null ? null : text(values.coverMediaId, `${path}.coverMediaId`, 36, 1)
      if (coverMediaId !== null && !isUUID(coverMediaId, '4')) fail(`${path}.coverMediaId`)
      if (
        typeof values.progress !== 'string' ||
        !['active', 'dev', 'archived'].includes(values.progress) ||
        typeof values.status !== 'string' ||
        !['draft', 'published', 'withdrawn'].includes(values.status)
      )
        fail(`${path}.progress/status`)
      if (
        !Number.isInteger(values.sortOrder) ||
        Number(values.sortOrder) < -1000000 ||
        Number(values.sortOrder) > 1000000
      )
        fail(`${path}.sortOrder`)
      const tagLabels = new Set<string>()
      const tags = array(values.tags, `${path}.tags`, 20)
        .map((value): PackageProject['values']['tags'][number] => {
          const tag = record(value, `${path}.tags`, ['label', 'color'])
          if (
            typeof tag.color !== 'string' ||
            !['emerald', 'blue', 'amber', 'sky', 'rose', 'slate'].includes(tag.color)
          )
            fail(`${path}.tags.color`)
          return {
            label: text(tag.label, `${path}.tags.label`, 40, 1).trim(),
            color: tag.color as PackageProject['values']['tags'][number]['color'],
          }
        })
        .filter((tag) => {
          const key = tag.label.toLowerCase()
          if (tagLabels.has(key)) return false
          tagLabels.add(key)
          return true
        })
      const kinds = new Set<string>()
      const links = array(values.links, `${path}.links`, 4).map((value): PackageProject['values']['links'][number] => {
        const link = record(value, `${path}.links`, ['kind', 'href'])
        const kind = text(link.kind, `${path}.links.kind`, 20, 1)
        if (!['source', 'demo', 'docs', 'download'].includes(kind) || kinds.has(kind)) fail(`${path}.links.kind`)
        kinds.add(kind)
        const href = text(link.href, `${path}.links.href`, 2048, 1).trim()
        if (!/^https?:\/\//i.test(href)) fail(`${path}.links.href`)
        try {
          return { kind: kind as PackageProject['values']['links'][number]['kind'], href: projectUrl(href) }
        } catch {
          return fail(`${path}.links.href`)
        }
      })
      return {
        sourceId: number(row.sourceId, `${path}.sourceId`),
        createdAt: date(row.createdAt, `${path}.createdAt`),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
        deleted: boolean(row.deleted, `${path}.deleted`),
        values: {
          title: text(values.title, `${path}.title`, 160, 1).trim(),
          relatedContent: relations(
            values.relatedContent,
            `${path}.relatedContent`,
            'project',
            number(row.sourceId, `${path}.sourceId`),
          ),
          description: text(values.description, `${path}.description`, 5000).trim(),
          coverMediaId: coverMediaId?.toLowerCase() ?? null,
          tags,
          links,
          progress: values.progress as PackageProject['values']['progress'],
          status: values.status as PackageProject['values']['status'],
          sortOrder: Number(values.sortOrder),
        },
      }
    },
  )
  if (new Set(projects.map((project) => project.sourceId)).size !== projects.length)
    fail('package.fieldProjectIdDuplicate')
  const links = array(Number(source.version) >= 6 ? source.links : [], 'links', 2000).map(
    (value, index): PackageLink => {
      const path = `links[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
      const values = record(row.values, `${path}.values`, [
        'name',
        'description',
        'url',
        'logoMediaId',
        'logoUrl',
        'status',
        'isFeatured',
        'sortOrder',
      ])
      const logoMediaId = values.logoMediaId === null ? null : text(values.logoMediaId, `${path}.logoMediaId`, 36, 1)
      if (logoMediaId !== null && !isUUID(logoMediaId, '4')) fail(`${path}.logoMediaId`)
      if (logoMediaId !== null && values.logoUrl !== null)
        throw new BadRequestException(msg('package.imageSourceConflict', { path }))
      if (typeof values.status !== 'string' || !['draft', 'published', 'withdrawn'].includes(values.status))
        fail(`${path}.status`)
      if (
        !Number.isInteger(values.sortOrder) ||
        Number(values.sortOrder) < -1000000 ||
        Number(values.sortOrder) > 1000000
      )
        fail(`${path}.sortOrder`)
      return {
        sourceId: number(row.sourceId, `${path}.sourceId`),
        createdAt: date(row.createdAt, `${path}.createdAt`),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
        deleted: boolean(row.deleted, `${path}.deleted`),
        values: {
          name: text(values.name, `${path}.name`, 80, 1).trim(),
          description: text(values.description, `${path}.description`, 300).trim(),
          url: linkUrl(text(values.url, `${path}.url`, 2048, 1)),
          logoMediaId: logoMediaId?.toLowerCase() ?? null,
          logoUrl: values.logoUrl === null ? null : linkLogoUrl(text(values.logoUrl, `${path}.logoUrl`, 2048, 1)),
          status: values.status as PackageLink['values']['status'],
          isFeatured: boolean(values.isFeatured, `${path}.isFeatured`),
          sortOrder: Number(values.sortOrder),
        },
      }
    },
  )
  if (new Set(links.map((link) => link.sourceId)).size !== links.length) fail('package.fieldLinkIdDuplicate')
  const prompts = array(Number(source.version) >= 10 ? source.prompts : [], 'prompts', 3000).map(
    (value, index): PackageImagePrompt => {
      const path = `prompts[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'values'])
      const keys = [
        'title',
        'description',
        'prompt',
        'negativePrompt',
        'model',
        'tags',
        'mediaId',
        'externalImageUrl',
        'imageAlt',
        'sourceUrl',
        'status',
      ]
      const raw = record(row.values, `${path}.values`, keys)
      if (keys.some((key) => raw[key] === undefined)) fail(`${path}.values`)
      const values = promptValues(dto(SavePromptDto, raw, `${path}.values`)) as PackageImagePrompt['values']
      if (Boolean(values.mediaId) === Boolean(values.externalImageUrl))
        throw new BadRequestException(msg('package.imageSourceConflict', { path }))
      values.mediaId = values.mediaId?.toLowerCase() ?? null
      return {
        sourceId: number(row.sourceId, `${path}.sourceId`),
        createdAt: date(row.createdAt, `${path}.createdAt`),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
        values,
      }
    },
  )
  if (new Set(prompts.map((prompt) => prompt.sourceId)).size !== prompts.length) fail('package.fieldPromptIdDuplicate')
  let linkSettings: ContentPackage['linkSettings'] = null
  if (Number(source.version) >= 6) {
    const settings = record(source.linkSettings, 'linkSettings', ['rules'])
    linkSettings = {
      rules: array(settings.rules, 'linkSettings.rules', 12).map((value) =>
        text(value, 'package.fieldLinkRule', 300, 1).trim(),
      ),
    }
  }
  const guestbookById = new Map(guestbook.map((message) => [message.sourceId, message]))
  if (guestbookById.size !== guestbook.length) fail('package.fieldGuestbookIdDuplicate')
  const checked = new Set<number>()
  for (const message of guestbook) {
    const path = new Set<number>()
    let id: number | null = message.sourceId
    while (id !== null && !checked.has(id)) {
      const current = guestbookById.get(id)
      if (!current || path.has(id)) fail('package.fieldGuestbookReplyLoop')
      path.add(id)
      id = current.replyToId
    }
    for (const id of path) checked.add(id)
  }
  if (commentsTotal > 10000 || new Set(flashes.map((flash) => flash.sourceId)).size !== flashes.length)
    fail('package.fieldCommentsTotalOrFlashIdDuplicate')
  const folders = array(source.folders, 'folders', 1000).map((value) =>
    text(value, 'package.fieldFolderName', 64, 1).trim(),
  )
  const tags = array(source.tags, 'tags', 3000).map((value) => {
    const tag = record(value, 'package.fieldTag', ['label', 'color'])
    if (!POST_TAG_COLORS.includes(tag.color as PostTagColor)) fail('package.fieldTagColor')
    return { label: text(tag.label, 'package.fieldTagLabel', 64, 1).trim(), color: tag.color as PostTagColor }
  })
  if (
    folders.some((value) => !value) ||
    tags.some((tag) => !tag.label) ||
    new Set(folders).size !== folders.length ||
    new Set(tags.map((tag) => tag.label)).size !== tags.length
  )
    fail('package.fieldFolderOrTagDuplicate')
  const siteData = dto(
    SaveSiteSettingsDto,
    {
      ...record(source.site, 'site', [
        'name',
        'description',
        'ownerName',
        'ownerTitle',
        'avatar',
        'avatarAlt',
        'seoTitle',
        'seoDescription',
        'announcement',
        'socials',
        ...(Number(source.version) >= 8 ? ['about'] : []),
        // v11 起可选携带在线状态、签名、状态类型与上线日期；旧版本出现即按未知字段拒绝。
        ...(Number(source.version) >= 11 ? ['presenceLabel', 'presenceSignature', 'presenceStatus', 'launchedAt'] : []),
        // v12 起可选携带导航、页脚链接、每日一言、备案号与版权文案；v1–v11 出现即按未知字段拒绝。
        ...(Number(source.version) >= 12 ? SITE_EXTRA_KEYS : []),
        // v14 起可选携带搜索引擎收录开关；v1–v13 出现即按未知字段拒绝。
        ...(Number(source.version) >= 14 ? ['searchIndexing'] : []),
      ]),
      revision: 0,
    },
    'package.fieldSite',
  )
  const { revision: ignoredRevision, ...site } = siteData
  // 不带收录开关的包来自尚无此设置的站点，那时站点一直允许收录；按 true 补齐，迁入后与来源站点行为一致。
  site.searchIndexing ??= true
  try {
    Object.assign(site, normalizeSiteExtrasInput(site))
  } catch (error) {
    if (error instanceof SiteExtrasError) fail('package.fieldSiteNavigation')
    throw error
  }
  if (site.about && new Set(site.about.sections.map((section) => section.kind)).size !== site.about.sections.length)
    fail('package.fieldAboutSectionDuplicate')
  if (ignoredRevision !== 0 || !packageImageUrl(site.avatar)) fail('package.fieldSiteAvatar')
  for (const social of site.socials) {
    let valid = /^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/.test(social.href)
    try {
      const url = new URL(social.href)
      valid ||= ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      /* 后续统一拒绝非法链接。 */
    }
    if (!valid) fail('package.fieldSiteSocial')
  }
  const media: PackageMedia[] = []
  let decodedPixels = 0
  for (const value of array(source.media, 'media', 300)) {
    const item = record(value, 'package.fieldMedia', [
      'id',
      ...(Number(source.version) >= 9 ? ['description'] : []),
      'name',
      'alt',
      'sha256',
      'byteSize',
      'width',
      'height',
      'createdAt',
      'deleted',
      'base64',
    ])
    const id = text(item.id, 'package.fieldMediaId', 36)
    const name = text(item.name, 'package.fieldMediaName', 240, 1)
    const sha256 = text(item.sha256, 'package.fieldMediaSha256', 64)
    const byteSize = number(item.byteSize, 'package.fieldMediaByteSize')
    const width = number(item.width, 'package.fieldMediaWidth'),
      height = number(item.height, 'package.fieldMediaHeight')
    if (
      !isUUID(id, '4') ||
      !/^[0-9a-f]{64}$/.test(sha256) ||
      /[\\/\u202a-\u202e\u2066-\u2069]/.test(name) ||
      [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      !/\.(?:jpe?g|png|webp)$/i.test(name) ||
      byteSize > 32 * 1024 * 1024 ||
      width > 4096 ||
      height > 4096
    )
      fail('package.fieldMediaAttributes')
    const base64 =
      item.base64 === undefined ? undefined : text(item.base64, 'package.fieldMediaBase64', MAX_PACKAGE_BYTES)
    if (mediaIncluded !== (base64 !== undefined)) fail('package.fieldMediaIncludedMismatch')
    if (base64 !== undefined) {
      decodedPixels += width * height
      if (decodedPixels > 100000000) throw new PayloadTooLargeException(msg('package.pixelsTooLarge'))
      if (base64.length % 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(base64)) fail('package.fieldMediaEncoding')
      const bytes = Buffer.from(base64, 'base64')
      if (
        bytes.length !== byteSize ||
        createHash('sha256').update(bytes).digest('hex') !== sha256 ||
        bytes.length < 12 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        bytes.readUInt32LE(4) + 8 !== bytes.length
      )
        fail('package.fieldMediaIntegrity')
      try {
        const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: 'warning' })
        const info = await image.metadata()
        if (
          info.format !== 'webp' ||
          info.width !== width ||
          info.height !== height ||
          (info.pages ?? 1) > 1 ||
          info.exif ||
          info.xmp ||
          info.iptc
        )
          fail('package.fieldMediaMetadata')
        await image.timeout({ seconds: 8 }).stats()
      } catch {
        fail('package.fieldMediaDecode')
      }
    }
    media.push({
      id: id.toLowerCase(),
      description: Number(source.version) >= 9 ? text(item.description, 'package.fieldMediaDescription', 1000) : '',
      name,
      alt: text(item.alt, 'package.fieldMediaAlt', 300),
      sha256,
      byteSize,
      width,
      height,
      createdAt: date(item.createdAt, 'package.fieldMediaCreatedAt'),
      deleted: boolean(item.deleted, 'package.fieldMediaDeleted'),
      ...(base64 === undefined ? {} : { base64 }),
    })
  }
  if (new Set(media.map((item) => item.id)).size !== media.length) fail('package.fieldMediaIdDuplicate')
  const targets = new Set([
    ...posts.map((row) => `post:${row.sourceId}`),
    ...projects.map((row) => `project:${row.sourceId}`),
    ...gallery.map((row) => `gallery:${row.sourceId}`),
  ])
  for (const row of [...posts, ...projects, ...gallery])
    for (const relation of row.values.relatedContent ?? [])
      if (!targets.has(`${relation.type}:${relation.id}`)) fail('package.fieldRelationTargetMissing')
  return {
    format: 'tixxin-content',
    version: 14,
    omittedRelations,
    exportedAt: date(source.exportedAt, 'package.fieldExportedAt'),
    mediaIncluded,
    posts,
    flashes,
    moments,
    guestbook,
    gallery,
    projects,
    links,
    prompts,
    subscriptions,
    linkSettings,
    gallerySettings,
    folders,
    tags,
    site,
    requireCommentApproval: boolean(source.requireCommentApproval, 'package.fieldRequireCommentApproval'),
    media,
  }
}
