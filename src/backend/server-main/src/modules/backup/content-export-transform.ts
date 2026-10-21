/**
 * @file content-export-transform.ts
 * @description 导出实体的纯数据清洗、关系修剪与内容包数据结构组装。
 */
import { postSnapshot } from '../post/post-snapshot'
import { withPresenceDefaults } from '../site/site-settings.service'
import type { Post } from '../../entities/post.entity'
import type { Comment } from '../../entities/comment.entity'
import type { FlashNote } from '../../entities/flash-note.entity'
import type { FlashComment } from '../../entities/flash-comment.entity'
import type { Moment } from '../../entities/moment.entity'
import type { MomentComment } from '../../entities/moment-comment.entity'
import type { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { GalleryPhoto } from '../../entities/gallery-photo.entity'
import type { GallerySettings } from '../../entities/gallery-settings.entity'
import type { Project } from '../../entities/project.entity'
import type { FriendLink } from '../../entities/friend-link.entity'
import type { ImagePrompt } from '../../entities/image-prompt.entity'
import type { Subscription } from '../../entities/subscription.entity'
import type { LinkSettings } from '../../entities/link-settings.entity'
import type { PostFolder } from '../../entities/post-folder.entity'
import type { PostTag } from '../../entities/post-tag.entity'
import type { MediaAsset } from '../../entities/media-asset.entity'
import type { SiteSettings } from '../../entities/site-settings.entity'
import type { CommentPolicy } from '../../entities/comment-policy.entity'
import type { ContentPackage, PackageComment } from './content-package'
import {
  exportGalleryItems,
  exportLinkItems,
  exportProjectItems,
  exportPromptItems,
  exportSubscriptionItems,
} from './content-export-items'

export interface ExportEntities {
  posts: Post[]
  comments: Comment[]
  flashes: FlashNote[]
  flashComments: FlashComment[]
  assets: MediaAsset[]
  moments: Moment[]
  guestbook: GuestbookMessage[]
  gallery: GalleryPhoto[]
  projects: Project[]
  links: FriendLink[]
  prompts: ImagePrompt[]
  subscriptions: Subscription[]
  linkSettings: LinkSettings
  gallerySettings: GallerySettings
  momentComments: MomentComment[]
  folders: PostFolder[]
  tags: PostTag[]
  site: SiteSettings
  policy: CommentPolicy
}

export function buildExportPackage(data: ExportEntities, mediaIncluded: boolean): ContentPackage {
  const {
    posts,
    comments,
    flashes,
    flashComments,
    assets,
    moments,
    guestbook,
    gallery,
    projects,
    links,
    prompts,
    subscriptions,
    linkSettings,
    gallerySettings,
    momentComments,
    folders,
    tags,
    site,
    policy,
  } = data

  const byPost = new Map<number, PackageComment[]>()
  for (const comment of comments) {
    const group = byPost.get(comment.post.id) ?? []
    group.push({
      sourceId: comment.id,
      parentId: comment.parent?.id ?? null,
      author: comment.authorSnapshot.name,
      avatar: comment.authorSnapshot.avatar,
      content: comment.content,
      isOwner: comment.isOwner,
      status: comment.status,
      createdAt: comment.createdAt.toISOString(),
    })
    byPost.set(comment.post.id, group)
  }

  const byFlash = new Map<string, ContentPackage['flashes'][number]['comments']>()
  for (const comment of flashComments) {
    const group = byFlash.get(comment.flashNote.id) ?? []
    group.push({
      author: comment.authorName,
      avatar: comment.authorAvatar,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt.toISOString(),
    })
    byFlash.set(comment.flashNote.id, group)
  }

  // 导出前补齐后加字段，v12 起总是携带完整的导航、页脚与备案配置；v13 另带闪念评论审核状态；v14 另带搜索引擎收录开关。
  const { announcementUpdatedAt, ...siteValues } = withPresenceDefaults(site.values)
  // 公告时间随完整数据库备份保留；内容迁入会按新配置保存时刻生成。
  void announcementUpdatedAt

  const { gallery: exportedGallery, gallerySettings: exportedGallerySettings } = exportGalleryItems(
    gallery,
    gallerySettings,
  )
  const { links: exportedLinks, linkSettings: exportedLinkSettings } = exportLinkItems(links, linkSettings)

  const result: ContentPackage = {
    format: 'tixxin-content',
    version: 14,
    omittedRelations: 0,
    exportedAt: new Date().toISOString(),
    mediaIncluded,
    posts: posts.map((post) => {
      const values = postSnapshot(post)
      delete values.contentSections
      return {
        sourceId: post.id,
        createdAt: post.createdAt.toISOString(),
        publishedAt: post.publishedAt.toISOString(),
        deleted: !!post.deletedAt,
        values,
        comments: byPost.get(post.id) ?? [],
      }
    }),
    flashes: flashes.map((note) => ({
      sourceId: note.id,
      createdAt: note.createdAt.toISOString(),
      values: {
        content: note.content,
        tags: note.tags,
        images: note.images,
        type: note.type,
        isPinned: note.isPinned,
        isDraft: note.isDraft,
        isArchived: note.isArchived,
      },
      comments: byFlash.get(note.id) ?? [],
    })),
    moments: moments.map((note) => ({
      sourceId: note.id,
      createdAt: note.createdAt.toISOString(),
      publishedAt: note.publishedAt?.toISOString() ?? null,
      deleted: !!note.deletedAt,
      values: {
        content: note.content,
        topics: note.topics,
        images: note.images,
        location: note.location ?? null,
        device: note.device ?? null,
        mood: note.mood ?? null,
        linkedArticleId: note.linkedArticle?.id ?? null,
        linkedLink: note.linkedLink ?? null,
        status: note.status,
        isPinned: note.isPinned,
      },
      comments: momentComments
        .filter((comment) => comment.moment.id === note.id)
        .map((comment) => ({
          sourceId: comment.id,
          author: comment.author,
          avatar: comment.avatar,
          content: comment.content,
          isOwner: comment.isOwner,
          status: comment.status,
          deleted: !!comment.deletedAt,
          createdAt: comment.createdAt.toISOString(),
        })),
    })),
    guestbook: guestbook.map((message) => ({
      sourceId: message.id,
      createdAt: message.createdAt.toISOString(),
      deleted: !!message.deletedAt,
      author: message.author,
      avatar: message.avatar,
      content: message.content,
      isOwner: message.isOwner,
      status: message.status,
      isPinned: message.isPinned,
      replyToId: message.replyTo?.id ?? null,
      ...(message.browser ? { browser: message.browser } : {}),
      ...(message.region ? { region: message.region } : {}),
    })),
    gallery: exportedGallery,
    gallerySettings: exportedGallerySettings,
    projects: exportProjectItems(projects),
    links: exportedLinks,
    linkSettings: exportedLinkSettings,
    prompts: exportPromptItems(prompts),
    subscriptions: exportSubscriptionItems(subscriptions),
    folders: folders.map((folder) => folder.label),
    tags: tags.map((tag) => ({ label: tag.label, color: tag.color })),
    site: siteValues,
    requireCommentApproval: policy.requireApproval,
    media: assets.map((asset) => ({
      id: asset.id,
      name: asset.originalName,
      alt: asset.alt,
      description: asset.description,
      sha256: asset.sha256,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString(),
      deleted: !!asset.deletedAt,
    })),
  }

  // 迁入只保留可映射的内容关系；已删除/缺失目标不猜测编号，完整备份仍保留原关系。
  const targets = new Set([
    ...result.posts.filter((row) => !row.deleted).map((row) => `post:${row.sourceId}`),
    ...result.projects.filter((row) => !row.deleted).map((row) => `project:${row.sourceId}`),
    ...result.gallery.filter((row) => !row.deleted).map((row) => `gallery:${row.sourceId}`),
  ])
  for (const row of [...result.posts, ...result.projects, ...result.gallery]) {
    const original = row.values.relatedContent ?? []
    row.values.relatedContent = original.filter((relation) => targets.has(`${relation.type}:${relation.id}`))
    result.omittedRelations += original.length - row.values.relatedContent.length
  }

  return result
}
