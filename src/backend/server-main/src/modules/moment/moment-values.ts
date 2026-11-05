/** @file moment-values.ts @description 朋友圈输入规范化、公开过滤与稳定提交指纹 */
import { BadRequestException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { FilterQuery } from '@mikro-orm/core'
import { raw } from '@mikro-orm/core'
import { Moment } from '../../entities/moment.entity'
import type { QueryMomentsDto, SaveMomentDto } from './moment.dto'
import { msg } from '../../common/i18n'
import { DEFAULT_SITE_TIME_ZONE, siteDayRange } from '../site/site-time-zone'

export const publicMoments = { status: 'published' as const, deletedAt: null }
export function momentWhere(
  query: QueryMomentsDto,
  admin = false,
  timeZone = DEFAULT_SITE_TIME_ZONE,
): FilterQuery<Moment> {
  const where: FilterQuery<Moment> = admin ? { deletedAt: null } : { ...publicMoments }
  if (query.topic) where.topics = { $contains: [query.topic] }
  // 单日筛选按站点时区的日边界，与日历分组一致
  if (query.date) where.publishedAt = siteDayRange(query.date, query.date, timeZone)
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
    throw new BadRequestException(msg('moment.linkInvalid'))
  }
}
/**
 * 后台保存时页面内嵌的图片地址（配图、链接卡片图片与图标）只收 HTTPS 或本站媒体：HTTP 图片在 HTTPS 站点上
 * 会被浏览器按混合内容拦截。编辑时原记录已有的地址照常保留；内容包迁入与样本沿用 momentValues，不受此限制。
 */
export function assertSecureEmbeds(
  values: Pick<SaveMomentDto, 'images' | 'linkedLink'>,
  existing: { images?: string[]; linkedLink?: { image?: string; favicon?: string } | null } | null,
) {
  const kept = new Set([
    ...(existing?.images ?? []),
    ...[existing?.linkedLink?.image, existing?.linkedLink?.favicon].filter((value): value is string => !!value),
  ])
  const embeds = [...(values.images ?? []), values.linkedLink?.image, values.linkedLink?.favicon]
  for (const url of embeds)
    if (url && url.startsWith('http:') && !kept.has(url)) throw new BadRequestException(msg('moment.imageInsecure'))
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
  if (values.linkedArticleId && values.linkedLink) throw new BadRequestException(msg('moment.referenceExclusive'))
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
