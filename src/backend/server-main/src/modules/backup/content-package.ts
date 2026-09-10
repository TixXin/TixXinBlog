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
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { SaveSiteSettingsDto } from '../site/site-settings.dto'
import { COMMENT_STATUSES } from '../../entities/comment.entity'
import type { CommentStatus } from '../../entities/comment.entity'
import { POST_TAG_COLORS } from '../../entities/post-tag.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import { GALLERY_STATUSES } from '../../entities/gallery-photo.entity'
import type { GalleryStatus } from '../../entities/gallery-photo.entity'
import { projectUrl } from '../project/project-values'
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
  comments: { author: string; avatar: string; content: string; createdAt: string }[]
}
export interface PackageMedia {
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
}
export interface ContentPackage {
  format: 'tixxin-content'
  version: 5
  exportedAt: string
  mediaIncluded: boolean
  posts: PackagePost[]
  flashes: PackageFlash[]
  moments: PackageMoment[]
  guestbook: PackageGuestbook[]
  gallery: PackageGalleryPhoto[]
  projects: PackageProject[]
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
    mediaId: string
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
function fail(path: string): never {
  throw new BadRequestException(`内容包字段不合法：${path}`)
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
export function packageImageUrl(value: string): boolean {
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
  if (!buffer.length || buffer.length > MAX_PACKAGE_BYTES)
    throw new PayloadTooLargeException('内容包不能超过 50MB；较大站点请使用完整维护备份')
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch {
    throw new BadRequestException('请选择有效的 UTF-8 JSON 内容包')
  }
  let nodes = 0
  const checkKeys = (value: unknown, depth = 0) => {
    if (++nodes > 1000000 || depth > 32) fail('数据层级或数量')
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('不支持的字段')
        checkKeys(child, depth + 1)
      }
  }
  checkKeys(input)
  const source = record(input, '根对象', [
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
    'gallerySettings',
    'folders',
    'tags',
    'site',
    'requireCommentApproval',
    'media',
  ])
  if (
    source.format !== 'tixxin-content' ||
    ![1, 2, 3, 4, 5].includes(Number(source.version)) ||
    typeof source.version !== 'number'
  )
    throw new BadRequestException('不支持的内容包格式或版本')
  if (source.version === 1 && source.moments !== undefined) fail('v1 不支持朋友圈字段')
  if (Number(source.version) < 3 && source.guestbook !== undefined) fail('v1/v2 不支持留言字段')
  if (Number(source.version) < 4 && (source.gallery !== undefined || source.gallerySettings !== undefined))
    fail('v1/v2/v3 不支持图库字段或器材配置')
  if (source.version !== 5 && source.projects !== undefined) fail('v1/v2/v3/v4 不支持项目字段')
  const mediaIncluded = boolean(source.mediaIncluded, 'mediaIncluded')
  let commentsTotal = 0
  const posts = array(source.posts, 'posts', 1000).map((value, index): PackagePost => {
    const path = `posts[${index}]`
    const item = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values', 'comments'])
    const values = dto(SavePostDto, item.values, `${path}.values`)
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
      const avatar = text(row.avatar, '评论头像', 2048)
      if (!packageImageUrl(avatar) || !COMMENT_STATUSES.includes(row.status as CommentStatus)) fail('评论状态或头像')
      return {
        sourceId: number(row.sourceId, '评论编号'),
        parentId: row.parentId === null ? null : number(row.parentId, '父评论编号'),
        author: text(row.author, '评论作者', 80, 1),
        avatar,
        content: text(row.content, '评论内容', 1000, 1),
        isOwner: boolean(row.isOwner, '博主标记'),
        status: row.status as CommentStatus,
        createdAt: date(row.createdAt, '评论时间'),
      }
    })
    commentsTotal += comments.length
    const map = new Map(comments.map((comment) => [comment.sourceId, comment]))
    if (map.size !== comments.length) fail('重复评论编号')
    for (const comment of comments) {
      let cursor = comment
      let depth = 0
      while (cursor.parentId !== null) {
        const parent = map.get(cursor.parentId)
        if (!parent || ++depth > 2) fail('评论层级或跨文章引用')
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
  if (new Set(posts.map((post) => post.sourceId)).size !== posts.length) fail('重复文章编号')
  const flashes = array(source.flashes, 'flashes', 2000).map((value, index): PackageFlash => {
    const row = record(value, `flashes[${index}]`, ['sourceId', 'createdAt', 'values', 'comments'])
    const values = dto(SaveFlashDto, row.values, '闪念字段')
    if (
      !values.content?.trim() ||
      (values.images ?? []).some((url) => !packageImageUrl(url)) ||
      (values.tags ?? []).some((tag) => !tag.trim())
    )
      fail('闪念内容、标签或图片')
    const comments = array(row.comments, '闪念评论', 10000).map((value) => {
      const comment = record(value, '闪念评论', ['author', 'avatar', 'content', 'createdAt'])
      const avatar = text(comment.avatar, '闪念评论头像', 2048)
      if (!packageImageUrl(avatar)) fail('闪念评论头像')
      return {
        author: text(comment.author, '闪念评论作者', 80, 1),
        avatar,
        content: text(comment.content, '闪念评论内容', 1000, 1),
        createdAt: date(comment.createdAt, '闪念评论时间'),
      }
    })
    commentsTotal += comments.length
    return {
      sourceId: text(row.sourceId, '闪念编号', 120, 1),
      createdAt: date(row.createdAt, '闪念时间'),
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
        fail('动态引用的文章不在内容包中')
      const comments = array(row.comments, `${path}.comments`, 10000).map(
        (value): PackageMoment['comments'][number] => {
          const comment = record(value, '动态评论', [
            'sourceId',
            'author',
            'avatar',
            'content',
            'isOwner',
            'status',
            'deleted',
            'createdAt',
          ])
          if (!MOMENT_COMMENT_STATUSES.includes(comment.status as MomentCommentStatus)) fail('动态评论状态')
          return {
            sourceId: text(comment.sourceId, '动态评论编号', 120, 1),
            author: text(comment.author, '动态评论作者', 80, 1),
            avatar: momentUrl(text(comment.avatar, '动态评论头像', 2048), true, true),
            content: text(comment.content, '动态评论内容', 1000, 1),
            isOwner: boolean(comment.isOwner, '动态博主标记'),
            status: comment.status as MomentCommentStatus,
            deleted: boolean(comment.deleted, '动态评论删除标记'),
            createdAt: date(comment.createdAt, '动态评论时间'),
          }
        },
      )
      if (new Set(comments.map((comment) => comment.sourceId)).size !== comments.length) fail('重复动态评论编号')
      commentsTotal += comments.length
      return {
        sourceId: text(row.sourceId, '动态编号', 120, 1),
        createdAt: date(row.createdAt, '动态创建时间'),
        publishedAt: row.publishedAt === null ? null : date(row.publishedAt, '动态发布时间'),
        deleted: boolean(row.deleted, '动态删除标记'),
        values,
        comments,
      }
    },
  )
  if (new Set(moments.map((note) => note.sourceId)).size !== moments.length) fail('重复动态编号')
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
      }
    },
  )
  const gallery = array(Number(source.version) >= 4 ? source.gallery : [], 'gallery', 3000).map(
    (value, index): PackageGalleryPhoto => {
      const path = `gallery[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
      const values = record(row.values, `${path}.values`, [
        'mediaId',
        'title',
        'description',
        'category',
        'takenOn',
        'location',
        'device',
        'status',
        'sortOrder',
      ])
      const mediaId = text(values.mediaId, `${path}.mediaId`, 36, 1)
      if (!isUUID(mediaId, '4') || !GALLERY_STATUSES.includes(values.status as GalleryStatus)) fail(path)
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
          mediaId: mediaId.toLowerCase(),
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
  if (new Set(gallery.map((photo) => photo.sourceId)).size !== gallery.length) fail('重复图库作品编号')
  let gallerySettings: ContentPackage['gallerySettings'] = null
  if (Number(source.version) >= 4) {
    const settings = record(source.gallerySettings, 'gallerySettings', ['gear'])
    gallerySettings = {
      gear: array(settings.gear, 'gallerySettings.gear', 12).map((value) => {
        const row = record(value, '图库器材', ['icon', 'name', 'description'])
        if (typeof row.icon !== 'string' || !['lucide:camera', 'lucide:circle', 'lucide:smartphone'].includes(row.icon))
          fail('图库器材图标')
        return {
          icon: row.icon as 'lucide:camera' | 'lucide:circle' | 'lucide:smartphone',
          name: text(row.name, '图库器材名称', 80, 1).trim(),
          description: text(row.description, '图库器材介绍', 300).trim(),
        }
      }),
    }
  }
  const projects = array(source.version === 5 ? source.projects : [], 'projects', 2000).map(
    (value, index): PackageProject => {
      const path = `projects[${index}]`
      const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
      const values = record(row.values, `${path}.values`, [
        'title',
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
  if (new Set(projects.map((project) => project.sourceId)).size !== projects.length) fail('重复项目编号')
  const guestbookById = new Map(guestbook.map((message) => [message.sourceId, message]))
  if (guestbookById.size !== guestbook.length) fail('重复留言编号')
  const checked = new Set<number>()
  for (const message of guestbook) {
    const path = new Set<number>()
    let id: number | null = message.sourceId
    while (id !== null && !checked.has(id)) {
      const current = guestbookById.get(id)
      if (!current || path.has(id)) fail('留言引用缺失或循环')
      path.add(id)
      id = current.replyToId
    }
    for (const id of path) checked.add(id)
  }
  if (commentsTotal > 10000 || new Set(flashes.map((flash) => flash.sourceId)).size !== flashes.length)
    fail('评论总量或重复闪念编号')
  const folders = array(source.folders, 'folders', 1000).map((value) => text(value, '专栏名称', 64, 1).trim())
  const tags = array(source.tags, 'tags', 3000).map((value) => {
    const tag = record(value, '标签', ['label', 'color'])
    if (!POST_TAG_COLORS.includes(tag.color as PostTagColor)) fail('标签颜色')
    return { label: text(tag.label, '标签名称', 64, 1).trim(), color: tag.color as PostTagColor }
  })
  if (
    folders.some((value) => !value) ||
    tags.some((tag) => !tag.label) ||
    new Set(folders).size !== folders.length ||
    new Set(tags.map((tag) => tag.label)).size !== tags.length
  )
    fail('目录名称重复或空白')
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
      ]),
      revision: 0,
    },
    '站点资料',
  )
  const { revision: ignoredRevision, ...site } = siteData
  if (ignoredRevision !== 0 || !packageImageUrl(site.avatar)) fail('站点头像')
  for (const social of site.socials) {
    let valid = /^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/.test(social.href)
    try {
      const url = new URL(social.href)
      valid ||= ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      /* 后续统一拒绝非法链接。 */
    }
    if (!valid) fail('社交链接')
  }
  const media: PackageMedia[] = []
  let decodedPixels = 0
  for (const value of array(source.media, 'media', 300)) {
    const item = record(value, '媒体', [
      'id',
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
    const id = text(item.id, '媒体编号', 36)
    const name = text(item.name, '媒体名称', 240, 1)
    const sha256 = text(item.sha256, '媒体摘要', 64)
    const byteSize = number(item.byteSize, '媒体大小')
    const width = number(item.width, '图片宽度'),
      height = number(item.height, '图片高度')
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
      fail('媒体标识、名称、大小或尺寸')
    const base64 = item.base64 === undefined ? undefined : text(item.base64, '媒体字节', MAX_PACKAGE_BYTES)
    if (mediaIncluded !== (base64 !== undefined)) fail('媒体包含标记与字节不一致')
    if (base64 !== undefined) {
      decodedPixels += width * height
      if (decodedPixels > 100000000) throw new PayloadTooLargeException('图片总量过大，请使用完整维护备份')
      if (base64.length % 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(base64)) fail('媒体编码')
      const bytes = Buffer.from(base64, 'base64')
      if (
        bytes.length !== byteSize ||
        createHash('sha256').update(bytes).digest('hex') !== sha256 ||
        bytes.length < 12 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        bytes.readUInt32LE(4) + 8 !== bytes.length
      )
        fail('媒体完整性或真实格式')
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
          fail('媒体元信息')
        await image.timeout({ seconds: 8 }).stats()
      } catch {
        fail('媒体解码')
      }
    }
    media.push({
      id: id.toLowerCase(),
      name,
      alt: text(item.alt, '图片说明', 300),
      sha256,
      byteSize,
      width,
      height,
      createdAt: date(item.createdAt, '媒体时间'),
      deleted: boolean(item.deleted, '媒体回收状态'),
      ...(base64 === undefined ? {} : { base64 }),
    })
  }
  if (new Set(media.map((item) => item.id)).size !== media.length) fail('重复媒体编号')
  return {
    format: 'tixxin-content',
    version: 5,
    exportedAt: date(source.exportedAt, '导出时间'),
    mediaIncluded,
    posts,
    flashes,
    moments,
    guestbook,
    gallery,
    projects,
    gallerySettings,
    folders,
    tags,
    site,
    requireCommentApproval: boolean(source.requireCommentApproval, '评论审核策略'),
    media,
  }
}
