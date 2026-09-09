/** @file guestbook-write.service.ts @description 留言写入与管理事务；身份、审核、唯一置顶、回应与引用由服务端处理 */
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GuestbookReaction } from '../../entities/guestbook-reaction.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { momentUrl, submissionHash } from '../moment/moment-values'
import { GuestbookReadService } from './guestbook-read.service'
import { guestbookId, PUBLIC_GUESTBOOK } from './guestbook-values'
import type { CreateGuestbookDto, GuestbookBodyDto, UpdateGuestbookDto, SetGuestbookReactionDto } from './guestbook.dto'

export async function lockGuestbook(em: EntityManager) {
  await em.execute('select pg_advisory_xact_lock(742920)')
}
@Injectable()
export class GuestbookWriteService {
  constructor(
    private readonly em: EntityManager,
    private readonly read: GuestbookReadService,
  ) {}
  async create(body: CreateGuestbookDto | GuestbookBodyDto, visitor: string, adminId?: string) {
    const identity = adminId ? `admin:${adminId}` : visitor
    const hash = submissionHash({ ...body, replyToId: body.replyToId ?? null })
    const id = await this.em.transactional(async (em) => {
      await lockMedia(em)
      await lockGuestbook(em)
      const existing = await em.findOne(GuestbookMessage, { visitorIdHash: identity, requestId: body.requestId })
      if (existing) {
        if (existing.deletedAt || existing.requestHash !== hash || (!adminId && existing.status === 'hidden'))
          throw new ConflictException('此留言提交已处理，请确认原留言')
        return existing.id
      }
      const parent = body.replyToId
        ? await em.findOne(GuestbookMessage, { id: guestbookId(body.replyToId), ...PUBLIC_GUESTBOOK })
        : null
      if (body.replyToId && !parent) throw new NotFoundException('引用的留言不存在或尚未公开，请保留正文并重新选择回复')
      const site = adminId ? await em.findOneOrFail(SiteSettings, { id: 'default' }) : null
      const policy = await em.findOneOrFail(CommentPolicy, { id: 'default' }, { refresh: true })
      const avatar = site ? site.values.avatar : momentUrl((body as CreateGuestbookDto).avatar ?? '', true, true)
      const note = em.create(GuestbookMessage, {
        content: body.content,
        author: site ? site.values.ownerName : (body as CreateGuestbookDto).author,
        avatar,
        visitorIdHash: identity,
        isOwner: !!adminId,
        status: !adminId && policy.requireApproval ? 'pending' : 'published',
        replyTo: parent,
        requestId: body.requestId,
        requestHash: hash,
      })
      await em.flush()
      await synchronizeMediaReferences(em, `guestbook:${note.id}`, 'guestbook', [avatar], { guestbookMessage: note })
      await em.flush()
      return note.id
    })
    return this.read.detail(id, visitor, !!adminId)
  }
  async update(id: number, body: UpdateGuestbookDto) {
    guestbookId(id)
    if (body.status === undefined && body.isPinned === undefined)
      throw new BadRequestException('请选择需要修改的审核或置顶状态')
    await this.em.transactional(async (em) => {
      await lockGuestbook(em)
      const note = await em.findOne(GuestbookMessage, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('留言不存在或已删除')
      if (note.revision !== body.revision) throw new ConflictException('留言状态已变化，请重新读取后再操作')
      const status = body.status ?? note.status
      if (body.isPinned && status !== 'published') throw new BadRequestException('只能置顶已公开留言')
      const pinned = status === 'published' && (body.isPinned ?? note.isPinned)
      if (pinned) {
        // 先释放唯一索引，再写入新的置顶项；其他窗口的旧版本会收到冲突。
        await em.execute(
          'update guestbook_message set is_pinned=false,revision=revision+1,updated_at=now() where id<>? and is_pinned=true',
          [id],
        )
      }
      note.status = status
      note.isPinned = pinned
      note.revision++
      await em.flush()
    })
    return this.read.detail(id, '', true)
  }
  async remove(id: number, revision: number) {
    guestbookId(id)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      await lockGuestbook(em)
      const note = await em.findOne(GuestbookMessage, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('留言不存在')
      if (note.deletedAt) return { ok: true }
      if (note.revision !== revision) throw new ConflictException('留言已变化，请重新读取后确认删除')
      note.deletedAt = new Date()
      note.isPinned = false
      note.revision++
      await em.nativeDelete(GuestbookReaction, { message: note })
      await em.nativeDelete(MediaReference, { guestbookMessage: note })
      await em.flush()
      return { ok: true }
    })
  }
  async react(id: number, visitor: string, body: SetGuestbookReactionDto) {
    guestbookId(id)
    return this.em.transactional(async (em) => {
      await lockGuestbook(em)
      const note = await em.findOne(
        GuestbookMessage,
        { id, ...PUBLIC_GUESTBOOK },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!note) throw new NotFoundException('留言不存在或尚未公开')
      const existing = await em.findOne(GuestbookReaction, { message: note, visitorIdHash: visitor, emoji: body.emoji })
      if (body.reacted && !existing)
        em.create(GuestbookReaction, { message: note, visitorIdHash: visitor, emoji: body.emoji })
      if (!body.reacted && existing) em.remove(existing)
      await em.flush()
      const reactions = await em.execute<{ emoji: string; count: number; reacted: boolean }[]>(
        'select emoji,count(*)::int as count,bool_or(visitor_id_hash=?) as reacted from guestbook_reaction where message_id=? group by emoji order by emoji',
        [visitor, id],
      )
      return { id, reactions }
    })
  }
}
