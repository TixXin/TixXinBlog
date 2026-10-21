/**
 * @file content-package.types.ts
 * @description 内容迁入包的数据契约、各内容域记录结构与文件大小上限。
 */
import type { SavePostDto } from '../post/dto/save-post.dto'
import type { SaveFlashDto } from '../flash/admin-flash.controller'
import type { SaveMomentDto } from '../moment/moment.dto'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import type { SaveSiteSettingsDto } from '../site/site-settings.dto'
import type { CommentStatus } from '../../entities/comment.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import type { GalleryStatus } from '../../entities/gallery-photo.entity'
import type { PackageSubscription } from './content-package-subscriptions'
import type { ContentRelation } from '../../common/types/content-relation'

export type { PackageSubscription } from './content-package-subscriptions'

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

export interface PackageLink {
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
