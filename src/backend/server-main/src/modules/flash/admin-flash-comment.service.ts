/**
 * @file admin-flash-comment.service.ts
 * @description 博主闪念评论审核：跨闪念列表、单条通过/隐藏与当前页批量审核/删除；
 *   以提交时看到的状态做冲突保护（与朋友圈评论一致），批量在单事务内逐条返回结果。
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { FilterQuery, LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { SITE_OWNER_ID } from '../../common/constants/site'
import { lockMedia } from '../media/media-references'
import { FlashService } from './flash.service'
import type { FlashCommentDto } from './flash.service'
import type { QueryAdminFlashCommentsDto } from './dto/moderate-flash-comment.dto'
import { msg } from '../../common/i18n'

/** 单条结果：not_found 表示评论或所属闪念已不存在，conflict 表示状态已被其他操作改变 */
export interface FlashCommentBatchItemResult {
  id: string
  ok: boolean
  reason?: 'not_found' | 'conflict'
  moderationStatus?: FlashCommentStatus
}
interface FlashCommentSelection {
  id: string
  expectedStatus: FlashCommentStatus
}
export interface ManagedFlashComment extends FlashCommentDto {
  flashId: string
  flashContent: string
  flashStatus: 'draft' | 'published' | 'archived'
}

/** 摘录长度与朋友圈评论后台一致 */
const EXCERPT = 160

@Injectable()
export class AdminFlashCommentService {
  constructor(
    private readonly em: EntityManager,
    private readonly flashes: FlashService,
  ) {}

  private managed(comment: FlashComment): ManagedFlashComment {
    const note = comment.flashNote
    return {
      ...this.flashes.commentDto(comment),
      flashId: note.id,
      flashContent: note.content.slice(0, EXCERPT),
      flashStatus: note.isArchived ? 'archived' : note.isDraft ? 'draft' : 'published',
    }
  }

  /** 跨闪念按状态分页，最新提交在前；commentId 用于通知跳转定位单条 */
  async list(query: QueryAdminFlashCommentsDto) {
    const where: FilterQuery<FlashComment> = { flashNote: { userId: SITE_OWNER_ID } }
    if (query.status !== 'all') where.status = query.status
    if (query.commentId) where.id = query.commentId
    const [items, total] = await this.em.findAndCount(FlashComment, where, {
      populate: ['flashNote'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: items.map((item) => this.managed(item)), total, page: query.page, pageSize: query.pageSize }
  }

  /** 锁定选中评论并只保留属于本站闪念的行；不在本站的编号按不存在处理 */
  private async lockRows(em: EntityManager, ids: string[]) {
    const rows = await em.find(
      FlashComment,
      { id: { $in: ids } },
      { lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'asc' }, refresh: true },
    )
    const owned = rows.length
      ? await em.find(FlashNote, { id: { $in: rows.map((row) => row.flashNote.id) }, userId: SITE_OWNER_ID })
      : []
    const notes = new Set(owned.map((note) => note.id))
    return new Map(rows.filter((row) => notes.has(row.flashNote.id)).map((row) => [row.id, row]))
  }

  private summary(results: FlashCommentBatchItemResult[]) {
    const successCount = results.filter((item) => item.ok).length
    return { successCount, failedCount: results.length - successCount, results }
  }

  async moderate(flashId: string, commentId: string, status: FlashCommentStatus, expectedStatus: FlashCommentStatus) {
    return this.em.transactional(async (em) => {
      const rows = await this.lockRows(em, [commentId])
      const comment = rows.get(commentId)
      if (!comment || comment.flashNote.id !== flashId) throw new NotFoundException(msg('comment.notFound'))
      // 已是目标状态视为成功，便于重试；其余状态变化要求重新加载后再操作。
      if (comment.status !== expectedStatus && comment.status !== status)
        throw new ConflictException(msg('flash.commentStatusChanged'))
      comment.status = status
      await em.flush()
      await em.populate(comment, ['flashNote'])
      return { ...this.managed(comment), status }
    })
  }

  async batchModerate(status: FlashCommentStatus, items: FlashCommentSelection[]) {
    return this.em.transactional(async (em) => {
      const rows = await this.lockRows(
        em,
        items.map((item) => item.id),
      )
      const results = items.map((item): FlashCommentBatchItemResult => {
        const comment = rows.get(item.id)
        if (!comment) return { id: item.id, ok: false, reason: 'not_found' }
        if (comment.status !== item.expectedStatus && comment.status !== status)
          return { id: item.id, ok: false, reason: 'conflict', moderationStatus: comment.status }
        comment.status = status
        return { id: item.id, ok: true, moderationStatus: status }
      })
      await em.flush()
      return { ok: true, status, ...this.summary(results) }
    })
  }

  /** 与单条删除一致为物理删除，媒体引用随外键级联清理；已不存在的评论返回 not_found */
  async batchRemove(items: FlashCommentSelection[]) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const rows = await this.lockRows(
        em,
        items.map((item) => item.id),
      )
      const removed: string[] = []
      const results = items.map((item): FlashCommentBatchItemResult => {
        const comment = rows.get(item.id)
        if (!comment) return { id: item.id, ok: false, reason: 'not_found' }
        if (comment.status !== item.expectedStatus)
          return { id: item.id, ok: false, reason: 'conflict', moderationStatus: comment.status }
        removed.push(comment.id)
        return { id: item.id, ok: true }
      })
      if (removed.length) await em.nativeDelete(FlashComment, { id: { $in: removed } })
      return { ok: true, deleted: removed.length, ...this.summary(results) }
    })
  }
}
