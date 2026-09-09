/** @file moment-values.ts @description 朋友圈输入规范化、公开过滤与稳定提交指纹 */
import { BadRequestException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { FilterQuery } from '@mikro-orm/core'
import { raw } from '@mikro-orm/core'
import { Moment } from '../../entities/moment.entity'
import type { QueryMomentsDto, SaveMomentDto } from './moment.dto'

export const publicMoments = { status: 'published' as const, deletedAt: null }
export function momentWhere(query: QueryMomentsDto, admin = false): FilterQuery<Moment> {
  const where: FilterQuery<Moment> = admin ? { deletedAt: null } : { ...publicMoments }
  if (query.topic) where.topics = { $contains: [query.topic] }
  if (query.date) {
    const from = new Date(query.date + 'T00:00:00.000Z')
    where.publishedAt = { $gte: from, $lt: new Date(from.getTime() + 86400000) }
  }
  if (query.q) {
    const value = `%${query.q.replace(/[\\%_]/g, (character) => '\\' + character)}%`
    where.$or = [
      { content: { $ilike: value } },
      { location: { $ilike: value } },
      { [raw((alias) => `${alias}.topics::text`)]: { $ilike: value } },
    ]
  }
  return where
}
export function momentUrl(value: string, allowMedia = false, allowAvatar = false): string {
  const input = value.trim()
  if (allowAvatar && (!input || ['/avatar.svg', '/avatar-photo.webp'].includes(input))) return input
  if (
    allowMedia &&
    /^\/api\/v1\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(input)
  )
    return input.toLowerCase()
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid URL')
    return url.toString()
  } catch {
    throw new BadRequestException('链接只允许完整 HTTP(S) 地址或本站媒体资源')
  }
}
export function momentValues(input: SaveMomentDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([name, value]) => !['requestId', 'revision'].includes(name) && value !== undefined),
  ) as Omit<SaveMomentDto, 'requestId' | 'revision'>
  if (input.topics)
    values.topics = [...new Set(input.topics.map((topic) => topic.trim().replace(/^#+/, '').trim()).filter(Boolean))]
  if (input.images) values.images = [...new Set(input.images.map((url) => momentUrl(url, true)))]
  if (input.linkedLink) {
    values.linkedLink = {
      ...input.linkedLink,
      url: momentUrl(input.linkedLink.url),
      image: input.linkedLink.image ? momentUrl(input.linkedLink.image, true) : undefined,
      favicon: input.linkedLink.favicon ? momentUrl(input.linkedLink.favicon, true) : undefined,
    }
  }
  if (values.linkedArticleId && values.linkedLink) throw new BadRequestException('站内文章和外链引用只能选择一种')
  return values
}
export function submissionHash(value: unknown): string {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, entry: unknown) =>
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
          : entry,
      ),
    )
    .digest('hex')
}
