/** @file guestbook-values.ts @description 留言可见性、查询游标和静态交流规则；游标绑定筛选条件 */
import { BadRequestException } from '@nestjs/common'
import type { FilterQuery } from '@mikro-orm/core'
import type { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { GuestbookFilters } from './guestbook.dto'
import { submissionHash } from '../moment/moment-values'
export const PUBLIC_GUESTBOOK = { status: 'published' as const, deletedAt: null }
/** 留言独立公开；只将尚无公开博主直接回复的游客根留言计入待回复。 */
export function unansweredGuestbookSql(alias = 'g'): string {
  if (!/^[a-z][a-z0-9_]*$/.test(alias)) throw new Error('非法内部 SQL 别名')
  return `${alias}.deleted_at is null and ${alias}.status='published' and not ${alias}.is_owner
    and ${alias}.reply_to_id is null and not exists(select 1 from guestbook_message r
    where r.reply_to_id=${alias}.id and r.is_owner and r.status='published' and r.deleted_at is null)`
}
export const GUESTBOOK_RULES = [
  { id: 1, text: '欢迎分享技术经验、阅读感受和生活见闻。' },
  { id: 2, text: '请友善交流，尊重不同意见。' },
  { id: 3, text: '请勿发布个人隐私、广告或与讨论无关的内容。' },
]
export function guestbookId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException('留言编号不合法')
  return id
}
export function visibleGuestbook(visitor: string): FilterQuery<GuestbookMessage> {
  return {
    deletedAt: null,
    $or: [{ status: 'published' }, ...(visitor ? [{ status: 'pending' as const, visitorIdHash: visitor }] : [])],
  }
}
export function guestbookFilter(query: GuestbookFilters): FilterQuery<GuestbookMessage> {
  const where: FilterQuery<GuestbookMessage> = {}
  if (query.q) {
    const value = '%' + query.q.replace(/[\\%_]/g, (char) => '\\' + char) + '%'
    where.$or = [{ content: { $ilike: value } }, { author: { $ilike: value } }]
  }
  if (query.date) {
    const from = new Date(query.date + 'T00:00:00.000Z')
    where.createdAt = { $gte: from, $lt: new Date(from.getTime() + 86400000) }
  }
  return where
}
const scope = (query: GuestbookFilters) => submissionHash({ q: query.q ?? '', date: query.date ?? '' })
export function encodeGuestbookCursor(note: GuestbookMessage, query: GuestbookFilters) {
  return Buffer.from(
    JSON.stringify({ v: 1, id: note.id, at: note.createdAt.toISOString(), scope: scope(query) }),
  ).toString('base64url')
}
export function decodeGuestbookCursor(value: string, query: GuestbookFilters): FilterQuery<GuestbookMessage> {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as {
      v: number
      id: number
      at: string
      scope: string
    }
    guestbookId(parsed.id)
    const date = new Date(parsed.at)
    if (
      parsed.v !== 1 ||
      typeof parsed.at !== 'string' ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString() !== parsed.at ||
      parsed.scope !== scope(query)
    )
      throw new Error('cursor')
    return { $or: [{ createdAt: { $lt: date } }, { createdAt: date, id: { $lt: parsed.id } }] }
  } catch {
    throw new BadRequestException('留言游标无效或筛选已变化，请重新加载')
  }
}
