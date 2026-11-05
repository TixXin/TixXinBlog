/** @file moment-interaction.service.ts @description 服务端确定评论身份与点赞计数，写入串行、重试去重和评论审核 */
import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common'
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
import { MomentReaction } from '../../entities/moment-reaction.entity'
import type { SetMomentReactionDto } from './moment.dto'
import { formatReactions, type ReactionRow } from './moment-query'
import { momentCommentDto } from './moment-read.service'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { recordOwnerEvent } from '../operations/owner-events'
import { msg } from '../../common/i18n'

/** 只能回复同一动态下已公开的评论；待审、隐藏或删除的评论不能作为回复目标 */
async function replyTarget(em: EntityManager, note: Moment, replyToId: string | undefined) {
  if (!replyToId) return null
  const target = await em.findOne(MomentComment, { id: replyToId, moment: note, status: 'published', deletedAt: null })
  if (!target) throw new BadRequestException(msg('moment.replyTargetUnavailable'))
  return target
}

@Injectable()
export class MomentInteractionService {
  constructor(private readonly em: EntityManager) {}
  async setLike(id: string, visitor: string, desired: boolean) {
    return this.em.transactional(async (em) => {
      const note = await em.findOne(Moment, { id, ...publicMoments }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException(msg('moment.notFoundOrPrivate'))
      const existing = await em.findOne(MomentLike, { moment: note, visitorIdHash: visitor })
      if (desired && !existing) em.create(MomentLike, { moment: note, visitorIdHash: visitor })
      if (!desired && existing) em.remove(existing)
      await em.flush()
      note.likes = await em.count(MomentLike, { moment: note })
      await em.flush()
      return { isLiked: desired, likes: note.likes }
    })
  }
  /** 设置目标回应状态（重复请求幂等），返回该动态按固定顺序排列的回应计数与本人状态 */
  async react(id: string, visitor: string, body: SetMomentReactionDto) {
    return this.em.transactional(async (em) => {
      const note = await em.findOne(Moment, { id, ...publicMoments }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException(msg('moment.notFoundOrPrivate'))
      const existing = await em.findOne(MomentReaction, { moment: note, visitorIdHash: visitor, emoji: body.emoji })
      if (body.reacted && !existing)
        em.create(MomentReaction, { moment: note, visitorIdHash: visitor, emoji: body.emoji })
      if (!body.reacted && existing) em.remove(existing)
      await em.flush()
      const rows = await em.execute<ReactionRow[]>(
        'select moment_id,emoji,count(*)::int as count,bool_or(visitor_id_hash=?) as reacted from moment_reaction where moment_id=? group by moment_id,emoji',
        [visitor, note.id],
      )
      return { id: note.id, reactions: formatReactions(rows, note.id) }
    })
  }
  async comment(id: string, body: CreateMomentCommentDto | MomentCommentBody, visitor: string, adminId?: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(Moment, { id, ...publicMoments }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException(msg('moment.notFoundOrPrivate'))
      const identity = adminId ? `admin:${adminId}` : visitor
      const hash = submissionHash(body)
      const existing = await em.findOne(
        MomentComment,
        { moment: note, visitorIdHash: identity, requestId: body.requestId },
        { populate: ['replyTo'] },
      )
      if (existing) {
        if (existing.deletedAt || existing.requestHash !== hash || (!adminId && existing.status === 'hidden'))
          throw new ConflictException(msg('moment.commentSubmissionHandled'))
        return {
          ...momentCommentDto(existing),
          commentCount: await em.count(MomentComment, { moment: note, status: 'published', deletedAt: null }),
        }
      }
      const replyTo = await replyTarget(em, note, body.replyToId)
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
        replyTo,
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
      if (!note) throw new NotFoundException(msg('moment.notFound'))
      const comment = await em.findOne(MomentComment, { id: commentId, moment: note, deletedAt: null })
      if (!comment) throw new NotFoundException(msg('moment.commentNotFound'))
      if (comment.status !== expectedStatus && comment.status !== status)
        throw new ConflictException(msg('moment.commentStatusChanged'))
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
      if (!note) throw new NotFoundException(msg('moment.notFound'))
      const comment = await em.findOne(MomentComment, { id: commentId, moment: note })
      if (!comment) throw new NotFoundException(msg('moment.commentNotFound'))
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
