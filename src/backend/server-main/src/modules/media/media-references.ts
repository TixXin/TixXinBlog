/**
 * @file media-references.ts
 * @description 媒体与内容写入共用锁，删除检查包含文章历史快照和全部私有状态。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import type { Post } from '../../entities/post.entity'
import type { FlashNote } from '../../entities/flash-note.entity'
import type { Comment } from '../../entities/comment.entity'
import type { FlashComment } from '../../entities/flash-comment.entity'
import type { Moment } from '../../entities/moment.entity'
import type { MomentComment } from '../../entities/moment-comment.entity'
import type { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { GalleryPhoto } from '../../entities/gallery-photo.entity'
import type { Project } from '../../entities/project.entity'

export function mediaUrl(id: string) {
  return `/api/v1/media/${id}.webp`
}
export async function lockMedia(em: EntityManager) {
  await em.execute('select pg_advisory_xact_lock(742912)')
}
export function managedMediaIds(values: unknown[]) {
  let text = JSON.stringify(values).replace(/\\+\//g, '/')
  for (let i = 0; i < 2; i += 1)
    text = text.replace(/%([0-9a-f]{2})/gi, (_value, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
  return [
    ...new Set(
      [
        ...text.matchAll(
          /\/api\/v1\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp/gi,
        ),
      ].map((match) => match[1]!.toLowerCase()),
    ),
  ]
}
export async function synchronizeMediaReferences(
  em: EntityManager,
  sourceKey: string,
  kind: MediaReference['kind'],
  values: unknown[],
  owner: {
    post?: Post
    flashNote?: FlashNote
    comment?: Comment
    flashComment?: FlashComment
    revision?: number
    moment?: Moment
    momentComment?: MomentComment
    guestbookMessage?: GuestbookMessage
    galleryPhoto?: GalleryPhoto
    project?: Project
  },
) {
  const ids = managedMediaIds(values)
  if (ids.length && (await em.count(MediaAsset, { id: { $in: ids }, deletedAt: null })) !== ids.length)
    throw new ConflictException('内容引用的媒体已移除或不存在，请重新选择图片')
  await em.nativeDelete(MediaReference, { sourceKey })
  for (const id of ids) em.create(MediaReference, { asset: em.getReference(MediaAsset, id), sourceKey, kind, ...owner })
}
