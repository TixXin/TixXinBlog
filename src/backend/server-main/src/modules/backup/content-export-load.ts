/**
 * @file content-export-load.ts
 * @description 导出快照的行数限额与实体读取；读取严格按原顺序逐个执行，限额检查先于后续读取。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { PayloadTooLargeException } from '@nestjs/common'
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
import { SITE_OWNER_ID } from '../../common/constants/site'
import { MAX_PACKAGE_BYTES } from './content-package'
import type { ExportEntities } from './content-export-transform'

type ExportCounts = {
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
}

export type ExportRows = Omit<ExportEntities, 'folders' | 'tags' | 'site' | 'policy'>

const COUNT_SQL = `select (select count(*)::int from post) as posts, (select count(*)::int from flash_note) as flashes, (select count(*)::int from moment) as moments, (select count(*)::int from guestbook_message) as guestbook, (select count(*)::int from gallery_photo) as gallery, (select count(*)::int from project) as projects, (select count(*)::int from friend_link) as links, (select count(*)::int from image_prompt) as prompts, (select count(*)::int from subscription) as subscriptions, ((select count(*) from comment)+(select count(*) from flash_comment)+(select count(*) from moment_comment))::int as comments, (select count(*)::int from media_asset) as media, (select coalesce(sum(octet_length(coalesce(content_raw,content_sections::text,''))),0)::text from post) as bytes`

/** 读取实体前先用计数拒绝超限内容，避免把超大数据载入内存。 */
export async function assertExportCounts(em: EntityManager): Promise<void> {
  const [counts] = await em.execute<ExportCounts[]>(COUNT_SQL)
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
}

export async function loadExportRows(em: EntityManager): Promise<ExportRows> {
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
  return {
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
  }
}

/** 计数与读取之间可能有新写入，按实际读到的行再核对一次；包含媒体时另限总像素。 */
export function assertExportRows(rows: ExportRows, mediaIncluded: boolean): void {
  const { comments, flashComments, momentComments, assets } = rows
  if (
    rows.posts.length > 1000 ||
    rows.flashes.length > 2000 ||
    rows.moments.length > 2000 ||
    rows.guestbook.length > 2000 ||
    rows.gallery.length > 3000 ||
    rows.projects.length > 2000 ||
    rows.links.length > 2000 ||
    rows.prompts.length > 3000 ||
    rows.subscriptions.length > 3000 ||
    comments.length + flashComments.length + momentComments.length > 10000 ||
    assets.length > 300
  )
    throw new PayloadTooLargeException(msg('backup.exportTooLarge'))

  if (mediaIncluded && assets.reduce((sum, asset) => sum + asset.width * asset.height, 0) > 100000000)
    throw new PayloadTooLargeException(msg('backup.exportMediaTooLarge'))
}

export async function loadExportTaxonomy(
  em: EntityManager,
): Promise<Pick<ExportEntities, 'folders' | 'tags' | 'site' | 'policy'>> {
  const folders = await em.find(PostFolder, {}, { orderBy: { label: 'asc' } })
  const tags = await em.find(PostTag, {}, { orderBy: { label: 'asc' } })
  const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
  const policy = await em.findOneOrFail(CommentPolicy, { id: 'default' })
  return { folders, tags, site, policy }
}
