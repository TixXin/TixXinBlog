/**
 * @file content-export.service.ts
 * @description 在一致快照中导出当前内容与公开配置，可选择包含受管媒体；不复制账号和访客凭据。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { IsolationLevel } from '@mikro-orm/core'
import { Injectable, PayloadTooLargeException } from '@nestjs/common'
import { msg } from '../../common/i18n'
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
import { Subscription } from '../../entities/subscription.entity'
import { ImagePrompt } from '../../entities/image-prompt.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { MediaStorage } from '../media/media-storage'
import { SITE_OWNER_ID } from '../../common/constants/site'
import { MAX_PACKAGE_BYTES } from './content-package'
import type { ContentPackage } from './content-package'
import { buildExportPackage } from './content-export-transform'
import { packExportMedia } from './content-export-media'

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
          prompts: number
          subscriptions: number
          comments: number
          media: number
          bytes: string
        }[]
      >(
        `select (select count(*)::int from post) as posts, (select count(*)::int from flash_note) as flashes, (select count(*)::int from moment) as moments, (select count(*)::int from guestbook_message) as guestbook, (select count(*)::int from gallery_photo) as gallery, (select count(*)::int from project) as projects, (select count(*)::int from friend_link) as links, (select count(*)::int from image_prompt) as prompts, (select count(*)::int from subscription) as subscriptions, ((select count(*) from comment)+(select count(*) from flash_comment)+(select count(*) from moment_comment))::int as comments, (select count(*)::int from media_asset) as media, (select coalesce(sum(octet_length(coalesce(content_raw,content_sections::text,''))),0)::text from post) as bytes`,
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
        counts.prompts > 3000 ||
        counts.subscriptions > 3000 ||
        counts.comments > 10000 ||
        counts.media > 300 ||
        Number(counts.bytes) > MAX_PACKAGE_BYTES
      )
        throw new PayloadTooLargeException(msg('backup.exportTooLarge'))

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
      const prompts = await em.find(ImagePrompt, {}, { orderBy: { id: 'asc' } })
      const subscriptions = await em.find(Subscription, {}, { orderBy: { id: 'asc' } })
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
        prompts.length > 3000 ||
        subscriptions.length > 3000 ||
        comments.length + flashComments.length + momentComments.length > 10000 ||
        assets.length > 300
      )
        throw new PayloadTooLargeException(msg('backup.exportTooLarge'))

      if (mediaIncluded && assets.reduce((sum, asset) => sum + asset.width * asset.height, 0) > 100000000)
        throw new PayloadTooLargeException(msg('backup.exportMediaTooLarge'))

      const folders = await em.find(PostFolder, {}, { orderBy: { label: 'asc' } })
      const tags = await em.find(PostTag, {}, { orderBy: { label: 'asc' } })
      const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
      const policy = await em.findOneOrFail(CommentPolicy, { id: 'default' })

      const result = buildExportPackage(
        {
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
        },
        mediaIncluded,
      )

      const size = Buffer.byteLength(JSON.stringify(result))
      if (size > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException(msg('backup.packageOver50mb'))

      if (mediaIncluded) {
        await packExportMedia(this.storage, result.media, size)
      }
      return result
    }

    return manager
      ? capture(manager)
      : this.em.transactional(capture, { isolationLevel: IsolationLevel.REPEATABLE_READ })
  }
}
