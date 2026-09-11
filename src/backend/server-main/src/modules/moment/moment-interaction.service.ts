/** @file moment-interaction.service.ts @description 服务端确定评论身份与点赞计数，写入串行、重试去重和评论审核 */
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Moment } from '../../entities/moment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'
import type { CreateMomentCommentDto, MomentCommentBody } from './moment.dto'
import { momentUrl, publicMoments, submissionHash } from './moment-values'
import { momentCommentDto } from './moment-read.service'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { recordOwnerEvent } from '../operations/owner-events'

@Injectable()
export class MomentInteractionService {
  constructor(private readonly em: EntityManager) {}
  async setLike(id: string, visitor: string, desired: boolean) {
    return this.em.transactional(async (em) => {
      const note = await em.findOne(Moment, { id, ...publicMoments }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('动态不存在或尚未公开')
      const existing = await em.findOne(MomentLike, { moment: note, visitorIdHash: visitor })
      if (desired && !existing) em.create(MomentLike, { moment: note, visitorIdHash: visitor })
      if (!desired && existing) em.remove(existing)
      await em.flush()
      note.likes = await em.count(MomentLike, { moment: note })
      await em.flush()
      return { isLiked: desired, likes: note.likes }
    })
  }
  async comment(id: string, body: CreateMomentCommentDto | MomentCommentBody, visitor: string, adminId?: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(Moment, { id, ...publicMoments }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('动态不存在或尚未公开')
      const identity = adminId ? `admin:${adminId}` : visitor
      const hash = submissionHash(body)
      const existing = await em.findOne(MomentComment, {
        moment: note,
        visitorIdHash: identity,
        requestId: body.requestId,
      })
      if (existing) {
        if (existing.deletedAt || existing.requestHash !== hash || (!adminId && existing.status === 'hidden'))
          throw new ConflictException('此评论提交已处理，请确认原评论')
        return {
          ...momentCommentDto(existing),
          commentCount: await em.count(MomentComment, { moment: note, status: 'published', deletedAt: null }),
        }
      }
      const settings = adminId ? await em.findOneOrFail(SiteSettings, { id: 'default' }) : null
      const policy = await em.findOne(CommentPolicy, { id: 'default' }, { refresh: true })
      const author = settings ? settings.values.ownerName : (body as CreateMomentCommentDto).author
      const avatar = settings
        ? settings.values.avatar
        : momentUrl((body as CreateMomentCommentDto).avatar ?? '', true, true)
      const comment = em.create(MomentComment, {
        moment: note,
        visitorIdHash: identity,
        author,
        avatar,
        content: body.content,
        isOwner: !!adminId,
        status: !adminId && policy?.requireApproval ? 'pending' : 'published',
        requestId: body.requestId,
        requestHash: hash,
      })
      await em.flush()
      await synchronizeMediaReferences(em, `moment-comment:${comment.id}`, 'moment-comment', [avatar], {
        moment: note,
        momentComment: comment,
      })
      await em.flush()
      if (!adminId)
        await recordOwnerEvent(
          em,
          'moment-comment',
          comment.id,
          comment.status === 'pending' ? 'pending_review' : 'new_comment',
        )
      return {
        ...momentCommentDto(comment),
        commentCount: await em.count(MomentComment, { moment: note, status: 'published', deletedAt: null }),
      }
    })
  }
  async moderate(id: string, commentId: string, status: MomentCommentStatus, expectedStatus: MomentCommentStatus) {
    return this.em.transactional(async (em) => {
      const note = await em.findOne(Moment, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('动态不存在')
      const comment = await em.findOne(MomentComment, { id: commentId, moment: note, deletedAt: null })
      if (!comment) throw new NotFoundException('评论不存在')
      if (comment.status !== expectedStatus && comment.status !== status)
        throw new ConflictException('评论状态已改变，请重新加载后再操作')
      comment.status = status
      await em.flush()
      return {
        ...momentCommentDto(comment),
        commentCount: await em.count(MomentComment, { moment: note, status: 'published', deletedAt: null }),
      }
    })
  }
  async removeComment(id: string, commentId: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(Moment, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('动态不存在')
      const comment = await em.findOne(MomentComment, { id: commentId, moment: note })
      if (!comment) throw new NotFoundException('评论不存在')
      comment.deletedAt ??= new Date()
      await em.nativeDelete(MediaReference, { momentComment: comment })
      await em.flush()
      return {
        ok: true,
        commentCount: await em.count(MomentComment, { moment: note, status: 'published', deletedAt: null }),
      }
    })
  }
}
