/** @file guestbook-read.service.ts @description 留言读取、引用可见性和真实侧栏聚合；公开响应不返回身份哈希或管理信息 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GUESTBOOK_REACTIONS } from '../../entities/guestbook-reaction.entity'
import { createHash } from 'node:crypto'
import type { QueryGuestbookDto, QueryAdminGuestbookDto } from './guestbook.dto'
import {
  PUBLIC_GUESTBOOK,
  visibleGuestbook,
  guestbookFilter,
  encodeGuestbookCursor,
  decodeGuestbookCursor,
  guestbookId,
  GUESTBOOK_RULES,
} from './guestbook-values'

@Injectable()
export class GuestbookReadService {
  constructor(private readonly em: EntityManager) {}
  async require(id: number, visitor = '', admin = false) {
    const note = await this.em.findOne(
      GuestbookMessage,
      { $and: [{ id: guestbookId(id) }, admin ? { deletedAt: null } : visibleGuestbook(visitor)] },
      { populate: ['replyTo'], refresh: true },
    )
    if (!note) throw new NotFoundException('留言不存在或暂不可见')
    return note
  }
  async detail(id: number, visitor = '', admin = false) {
    return (await this.serialize([await this.require(id, visitor, admin)], visitor, admin))[0]!
  }
  async list(query: QueryGuestbookDto, visitor = '') {
    const filters = [visibleGuestbook(visitor), guestbookFilter(query)]
    const total = await this.em.count(GuestbookMessage, { $and: filters })
    const rows = await this.em.find(
      GuestbookMessage,
      { $and: [...filters, ...(query.before ? [decodeGuestbookCursor(query.before, query)] : [])] },
      { populate: ['replyTo'], orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.pageSize + 1 },
    )
    const items = rows.slice(0, query.pageSize)
    return {
      items: await this.serialize(items, visitor),
      total,
      nextCursor: rows.length > query.pageSize && items.length ? encodeGuestbookCursor(items.at(-1)!, query) : null,
    }
  }
  async adminList(query: QueryAdminGuestbookDto) {
    const [items, total] = await this.em.findAndCount(
      GuestbookMessage,
      {
        $and: [
          { deletedAt: null },
          guestbookFilter(query),
          ...(query.status && query.status !== 'all' ? [{ status: query.status }] : []),
        ],
      },
      {
        populate: ['replyTo'],
        orderBy: { createdAt: 'desc', id: 'desc' },
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    )
    return { items: await this.serialize(items, '', true), total, page: query.page, pageSize: query.pageSize }
  }
  async serialize(notes: GuestbookMessage[], visitor = '', admin = false) {
    if (!notes.length) return []
    const reactions = await this.em.execute<{ message_id: number; emoji: string; count: number; reacted: boolean }[]>(
      `select message_id,emoji,count(*)::int as count,bool_or(visitor_id_hash=?) as reacted from guestbook_reaction where message_id in (${notes.map(() => '?').join(',')}) group by message_id,emoji`,
      [visitor || '__anonymous__', ...notes.map((note) => note.id)],
    )
    return notes.map((note) => {
      const parent = note.replyTo
      const parentVisible =
        !!parent &&
        (admin ||
          (!parent.deletedAt &&
            (parent.status === 'published' ||
              (parent.status === 'pending' && !!visitor && parent.visitorIdHash === visitor))))
      return {
        id: note.id,
        author: note.author,
        avatar: note.avatar,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        isOwner: note.isOwner,
        isPinned: note.isPinned,
        moderationStatus: note.status,
        replyTo: parentVisible
          ? {
              id: parent!.id,
              author: parent!.author,
              content: parent!.content,
              ...(admin ? { status: parent!.status, deleted: !!parent!.deletedAt } : {}),
            }
          : null,
        replyUnavailable: !!parent && !parentVisible,
        reactions: reactions
          .filter((item) => item.message_id === note.id)
          .sort(
            (a, b) =>
              GUESTBOOK_REACTIONS.indexOf(a.emoji as (typeof GUESTBOOK_REACTIONS)[number]) -
              GUESTBOOK_REACTIONS.indexOf(b.emoji as (typeof GUESTBOOK_REACTIONS)[number]),
          )
          .map(({ emoji, count, reacted }) => ({ emoji, count, reacted })),
        ...(admin ? { revision: note.revision, updatedAt: note.updatedAt.toISOString() } : {}),
      }
    })
  }
  async metadata(visitor = '') {
    const [stats] = await this.em.execute<{ messages: number; members: number; recent: number; today: number }[]>(
      `select count(*)::int as messages,count(distinct case when is_owner then '__owner__' else visitor_id_hash end)::int as members,count(*) filter(where created_at>=now()-interval '30 days')::int as recent,count(*) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date)::int as today from guestbook_message where status='published' and deleted_at is null`,
    )
    const members = await this.em.execute<
      { member: string; author: string; avatar: string; count: number; is_owner: boolean }[]
    >(
      `with visible as (select *,case when is_owner then '__owner__' else visitor_id_hash end as member from guestbook_message where status='published' and deleted_at is null), totals as (select member,count(*)::int as count from visible group by member), latest as (select distinct on(member) member,author,avatar,is_owner from visible order by member,created_at desc,id desc) select latest.*,totals.count from latest join totals using(member) order by totals.count desc,latest.member limit 6`,
    )
    const pinned = await this.em.findOne(
      GuestbookMessage,
      { ...PUBLIC_GUESTBOOK, isPinned: true },
      { populate: ['replyTo'] },
    )
    return {
      stats,
      pinned: pinned ? (await this.serialize([pinned], visitor))[0] : null,
      members: members.map((row) => ({
        id: createHash('sha256')
          .update('member:' + row.member)
          .digest('hex')
          .slice(0, 20),
        name: row.author,
        avatar: row.avatar,
        messageCount: row.count,
        isOwner: row.is_owner,
      })),
      rules: GUESTBOOK_RULES,
    }
  }
}
