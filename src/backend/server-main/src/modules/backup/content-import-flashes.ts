/**
 * @file content-import-flashes.ts
 * @description 迁入事务中的闪念草稿及其评论写入与媒体引用同步。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { FlashNote } from '../../entities/flash-note.entity'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { AdminFlashService } from '../flash/admin-flash.service'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importFlashes(
  em: EntityManager,
  flashes: AdminFlashService,
  current: ContentImportPlan,
  payload: ContentPackage,
  result: ContentImportResult,
): Promise<void> {
  for (const source of payload.flashes) {
    if (current.flashes.find((flash) => flash.sourceId === source.sourceId)!.skip) continue
    const saved = await flashes.save(null, { ...source.values, isDraft: true, isArchived: false })
    const note = await em.findOneOrFail(FlashNote, { id: saved.id })
    note.createdAt = new Date(source.createdAt)
    for (const comment of source.comments) {
      const created = em.create(FlashComment, {
        flashNote: note,
        authorId: createHash('sha256').update(randomUUID()).digest('hex'),
        authorName: comment.author,
        authorAvatar: comment.avatar || '/avatar.svg',
        content: comment.content,
        // 闪念迁入为草稿，评论保留原审核状态；旧包（含升级前生成的预览票据）按已发布处理。
        status: comment.status ?? 'published',
        createdAt: new Date(comment.createdAt),
      })
      await em.flush()
      await synchronizeMediaReferences(em, `flash-comment:${created.id}`, 'flash-comment', [created.authorAvatar], {
        flashNote: note,
        flashComment: created,
      })
      result.comments += 1
    }
    result.flashes.push({ sourceId: source.sourceId, id: saved.id })
  }
}
