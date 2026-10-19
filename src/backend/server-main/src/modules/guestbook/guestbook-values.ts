/** @file guestbook-values.ts @description 留言可见性、查询游标和静态交流规则；游标绑定筛选条件 */
import { BadRequestException } from '@nestjs/common'
import type { FilterQuery } from '@mikro-orm/core'
import type { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { GuestbookFilters } from './guestbook.dto'
import { submissionHash } from '../moment/moment-values'
import { DEFAULT_API_LOCALE, msg, translate, type ApiLocale } from '../../common/i18n'
export const PUBLIC_GUESTBOOK = { status: 'published' as const, deletedAt: null }
/** 留言独立公开；只将尚无公开博主直接回复的游客根留言计入待回复。 */
export function unansweredGuestbookSql(alias = 'g'): string {
  if (!/^[a-z][a-z0-9_]*$/.test(alias)) throw new Error('非法内部 SQL 别名')
  return `${alias}.deleted_at is null and ${alias}.status='published' and not ${alias}.is_owner
    and ${alias}.reply_to_id is null and not exists(select 1 from guestbook_message r
    where r.reply_to_id=${alias}.id and r.is_owner and r.status='published' and r.deleted_at is null)`
}
const GUESTBOOK_RULE_KEYS = ['guestbook.rule.share', 'guestbook.rule.respect', 'guestbook.rule.noSpam'] as const
/** 静态交流规则，按请求语言给出 */
export function guestbookRules(locale: ApiLocale = DEFAULT_API_LOCALE) {
  return GUESTBOOK_RULE_KEYS.map((key, index) => ({ id: index + 1, text: translate(locale, key) }))
}
/** 中文规则，与未带 Accept-Language 的接口返回一致 */
export const GUESTBOOK_RULES = guestbookRules()
export function guestbookId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException(msg('guestbook.idInvalid'))
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
    throw new BadRequestException(msg('guestbook.cursorInvalid'))
  }
}
