/**
 * @file content-export.service.ts
 * @description 在一致快照中导出当前内容与公开配置，可选择包含受管媒体；不复制账号和访客凭据。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { IsolationLevel } from '@mikro-orm/core'
import { Injectable, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { Post } from '../../entities/post.entity'
import { Comment } from '../../entities/comment.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { FlashComment } from '../../entities/flash-comment.entity'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { Project } from '../../entities/project.entity'
import { FriendLink } from '../../entities/friend-link.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { MediaStorage } from '../media/media-storage'
import { postSnapshot } from '../post/post-snapshot'
import { SITE_OWNER_ID } from '../../common/constants/site'
import { MAX_PACKAGE_BYTES } from './content-package'
import type { ContentPackage, PackageComment } from './content-package'
@Injectable()
export class ContentExportService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: MediaStorage,
  ) {}
  async snapshot(mediaIncluded: boolean, manager?: EntityManager): Promise<ContentPackage> {
    const capture = async (em: EntityManager): Promise<ContentPackage> => {
      const [counts] = await em.execute<
        {
          posts: number
          flashes: number
          moments: number
          guestbook: number
          gallery: number
          projects: number
          links: number
          comments: number
          media: number
          bytes: string
        }[]
      >(
        `select (select count(*)::int from post) as posts, (select count(*)::int from flash_note) as flashes, (select count(*)::int from moment) as moments, (select count(*)::int from guestbook_message) as guestbook, (select count(*)::int from gallery_photo) as gallery, (select count(*)::int from project) as projects, (select count(*)::int from friend_link) as links, ((select count(*) from comment)+(select count(*) from flash_comment)+(select count(*) from moment_comment))::int as comments, (select count(*)::int from media_asset) as media, (select coalesce(sum(octet_length(coalesce(content_raw,content_sections::text,''))),0)::text from post) as bytes`,
      )
      if (
        !counts ||
        counts.posts > 1000 ||
        counts.flashes > 2000 ||
        counts.moments > 2000 ||
        counts.guestbook > 2000 ||
        counts.gallery > 3000 ||
        counts.projects > 2000 ||
        counts.links > 2000 ||
        counts.comments > 10000 ||
        counts.media > 300 ||
        Number(counts.bytes) > MAX_PACKAGE_BYTES
      )
        throw new PayloadTooLargeException('内容规模超过浏览器包限制，请使用完整维护备份')
      const posts = await em.find(Post, {}, { populate: ['tags'], orderBy: { id: 'asc' } })
      const comments = await em.find(Comment, {}, { orderBy: { id: 'asc' } })
      const flashes = await em.find(FlashNote, { userId: SITE_OWNER_ID }, { orderBy: { id: 'asc' } })
      const flashComments = await em.find(
        FlashComment,
        { flashNote: { userId: SITE_OWNER_ID } },
        { orderBy: { createdAt: 'asc', id: 'asc' } },
      )
      const assets = await em.find(MediaAsset, {}, { orderBy: { id: 'asc' } })
      const moments = await em.find(Moment, {}, { orderBy: { id: 'asc' } })
      const guestbook = await em.find(GuestbookMessage, {}, { orderBy: { id: 'asc' } })
      const gallery = await em.find(GalleryPhoto, {}, { orderBy: { id: 'asc' } })
      const projects = await em.find(Project, {}, { orderBy: { id: 'asc' } })
      const links = await em.find(FriendLink, {}, { orderBy: { id: 'asc' } })
      const linkSettings = await em.findOneOrFail(LinkSettings, { id: 'default' })
      const gallerySettings = await em.findOneOrFail(GallerySettings, { id: 'default' })
      const momentComments = await em.find(MomentComment, {}, { orderBy: { createdAt: 'asc', id: 'asc' } })
      if (
        posts.length > 1000 ||
        flashes.length > 2000 ||
        moments.length > 2000 ||
        guestbook.length > 2000 ||
        gallery.length > 3000 ||
        projects.length > 2000 ||
        links.length > 2000 ||
        comments.length + flashComments.length + momentComments.length > 10000 ||
        assets.length > 300
      )
        throw new PayloadTooLargeException('内容规模超过浏览器包限制，请使用完整维护备份')
      if (mediaIncluded && assets.reduce((sum, asset) => sum + asset.width * asset.height, 0) > 100000000)
        throw new PayloadTooLargeException('图片总量过大，可导出媒体清单或使用完整维护备份')
      const folders = await em.find(PostFolder, {}, { orderBy: { label: 'asc' } })
      const tags = await em.find(PostTag, {}, { orderBy: { label: 'asc' } })
      const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
      const policy = await em.findOneOrFail(CommentPolicy, { id: 'default' })
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
          createdAt: comment.createdAt.toISOString(),
        })
        byFlash.set(comment.flashNote.id, group)
      }
      const { announcementUpdatedAt, ...siteValues } = site.values
      // 公告时间随完整数据库备份保留；内容迁入会按新配置保存时刻生成。
      void announcementUpdatedAt
      const result: ContentPackage = {
        format: 'tixxin-content',
        version: 8,
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
        })),
        gallery: gallery.map((photo) => ({
          sourceId: photo.id,
          createdAt: photo.createdAt.toISOString(),
          publishedAt: photo.publishedAt?.toISOString() ?? null,
          deleted: !!photo.deletedAt,
          values: {
            mediaId: photo.media?.id ?? null,
            externalUrl: photo.externalUrl ?? null,
            title: photo.title,
            description: photo.description,
            category: photo.category,
            takenOn: photo.takenOn ?? null,
            location: photo.location,
            device: photo.device,
            status: photo.status,
            sortOrder: photo.sortOrder,
          },
        })),
        gallerySettings: { gear: gallerySettings.gear },
        projects: projects.map((project) => ({
          sourceId: project.id,
          createdAt: project.createdAt.toISOString(),
          publishedAt: project.publishedAt?.toISOString() ?? null,
          deleted: !!project.deletedAt,
          values: {
            title: project.title,
            description: project.description,
            coverMediaId: project.coverMedia?.id ?? null,
            tags: project.tags,
            links: project.links,
            progress: project.progress,
            status: project.status,
            sortOrder: project.sortOrder,
          },
        })),
        links: links.map((link) => ({
          sourceId: link.id,
          createdAt: link.createdAt.toISOString(),
          publishedAt: link.publishedAt?.toISOString() ?? null,
          deleted: !!link.deletedAt,
          values: {
            name: link.name,
            description: link.description,
            url: link.url,
            logoMediaId: link.logoMedia?.id ?? null,
            logoUrl: link.logoUrl ?? null,
            status: link.status,
            isFeatured: link.isFeatured,
            sortOrder: link.sortOrder,
          },
        })),
        linkSettings: { rules: linkSettings.rules },
        folders: folders.map((folder) => folder.label),
        tags: tags.map((tag) => ({ label: tag.label, color: tag.color })),
        site: siteValues,
        requireCommentApproval: policy.requireApproval,
        media: assets.map((asset) => ({
          id: asset.id,
          name: asset.originalName,
          alt: asset.alt,
          sha256: asset.sha256,
          byteSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
          createdAt: asset.createdAt.toISOString(),
          deleted: !!asset.deletedAt,
        })),
      }
      let size = Buffer.byteLength(JSON.stringify(result))
      if (size > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException('内容包超过 50MB，请使用完整维护备份')
      if (mediaIncluded)
        for (const asset of result.media) {
          size += Math.ceil(asset.byteSize / 3) * 4 + 16
          if (size > MAX_PACKAGE_BYTES)
            throw new PayloadTooLargeException('包含图片后的内容包超过 50MB，可导出媒体清单或使用完整维护备份')
          let bytes: Buffer
          try {
            bytes = await this.storage.get(`${asset.id}.webp`)
          } catch {
            throw new ServiceUnavailableException(`媒体 ${asset.id} 文件不可读，无法生成完整内容包`)
          }
          if (bytes.length !== asset.byteSize || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
            throw new ServiceUnavailableException(`媒体 ${asset.id} 完整性校验失败`)
          asset.base64 = bytes.toString('base64')
        }
      return result
    }
    return manager
      ? capture(manager)
      : this.em.transactional(capture, { isolationLevel: IsolationLevel.REPEATABLE_READ })
  }
}
