/** @file content-import-guestbook.ts @description 留言以非公开状态迁入，先分配新编号，再重建跨页回复和媒体引用 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { ConflictException } from '@nestjs/common'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importGuestbook(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  const map = new Map<number, number>(),
    created = new Map<number, GuestbookMessage>()
  const plans = new Map((plan.guestbook ?? []).map((item) => [item.sourceId, item]))
  for (const source of payload.guestbook ?? []) {
    const target = plans.get(source.sourceId)
    if (!target) throw new ConflictException('留言导入计划缺失，请重新预览')
    if (target.skip) {
      if (target.targetId !== undefined) map.set(source.sourceId, target.targetId)
      continue
    }
    const note = em.create(GuestbookMessage, {
      author: source.author,
      avatar: source.avatar,
      content: source.content,
      isOwner: source.isOwner,
      status: source.status === 'hidden' ? 'hidden' : 'pending',
      isPinned: false,
      createdAt: new Date(source.createdAt),
      deletedAt: source.deleted ? new Date() : null,
      visitorIdHash: createHash('sha256').update(randomUUID()).digest('hex'),
    })
    created.set(source.sourceId, note)
  }
  await em.flush()
  for (const [sourceId, note] of created) {
    map.set(sourceId, note.id)
    result.guestbook.push({ sourceId, id: note.id })
  }
  for (const target of plans.values()) {
    if (target.duplicateOf !== undefined) {
      const id = map.get(target.duplicateOf)
      if (!id) throw new ConflictException('相同留言未能映射，迁入已回滚')
      map.set(target.sourceId, id)
    }
  }
  for (const source of payload.guestbook ?? []) {
    const note = created.get(source.sourceId)
    if (!note) continue
    if (source.replyToId !== null) {
      const parent = map.get(source.replyToId)
      if (!parent) throw new ConflictException('留言引用未能映射，迁入已回滚')
      note.replyTo = em.getReference(GuestbookMessage, parent)
    }
    if (!note.deletedAt)
      await synchronizeMediaReferences(em, `guestbook:${note.id}`, 'guestbook', [note.avatar], {
        guestbookMessage: note,
      })
  }
  await em.flush()
}
