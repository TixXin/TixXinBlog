/**
 * @file setup-helpers.ts
 * @description 站点初始化向导常量、令牌比对、地址白名单与资料补丁纯逻辑
 * @author TixXin
 * @since 2026-10-21
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import type { SiteSettingsValues } from '../../entities/site-settings.entity'
import { SAFE_INITIAL_SITE_VALUES, SAFE_INITIAL_SITE_VALUES_EN, initialSiteProfile } from '../site/initial-profile'
import type { SetupDto } from './setup.dto'

/** 与路由不存在时 Nest 返回的文案一致，关闭后不透露接口曾经存在或站点状态 */
export const SETUP_CLOSED_MESSAGE = 'Cannot POST /api/v1/setup'

/** 定长摘要后做常量时间比较：长度不同也不提前返回，不泄露令牌长度 */
export function setupTokenMatches(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== 'string' || !expected) return false
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
  return timingSafeEqual(digest(candidate), digest(expected))
}

/** 外部地址只接受不带账号信息的 https：站点 CSP 的 img-src 只放行 https */
export function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

/** 社交链接与后台站点资料一致：http(s) 且不带账号信息 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

/** Cravatar 按小写邮箱的 MD5 取头像，没有注册时显示 identicon；浏览器直接加载，服务器不抓取 */
export function cravatarUrl(email: string): string {
  const hash = createHash('md5').update(email.trim().toLowerCase(), 'utf8').digest('hex')
  return `https://cn.cravatar.com/avatar/${hash}?s=512&d=identicon`
}

/** 解析客户端裁切好的头像 data URL；格式与内容由 normalizeImage 再次核对 */
export function decodeAvatarImage(value: string | undefined) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value ?? '')
  if (!match) throw new BadRequestException(msg('setup.avatarInvalid'))
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1]!
  const buffer = Buffer.from(match[2]!, 'base64')
  return { buffer, originalname: `avatar.${extension}`, mimetype: `image/${match[1]}`, size: buffer.length }
}

/** 仍为初始值的博主资料字段：中英两份中性初始值都算未编辑，可按所选语言改写 */
export const LOCALIZABLE_FIELDS = ['ownerName', 'avatarAlt'] as const

/** 计算初始化向导要写入的站点资料差异；没有差异时返回空对象 */
export function setupProfilePatch(
  values: SiteSettingsValues,
  input: Partial<
    Pick<
      SetupDto,
      | 'siteName'
      | 'locale'
      | 'description'
      | 'launchedAt'
      | 'ownerName'
      | 'ownerTitle'
      | 'email'
      | 'socials'
      | 'searchIndexing'
    >
  >,
  avatar?: string,
): Partial<SiteSettingsValues> {
  const next: Partial<SiteSettingsValues> = {}
  if (input.siteName) next.name = input.siteName
  if (input.locale) {
    const target = initialSiteProfile(input.locale).values
    for (const field of LOCALIZABLE_FIELDS) {
      const untouched = [SAFE_INITIAL_SITE_VALUES[field], SAFE_INITIAL_SITE_VALUES_EN[field]].includes(values[field])
      if (untouched) next[field] = target[field]
    }
  }
  // 明确填写的资料覆盖按语言改写的初始值；空串视为未填写，保留当前值
  if (input.ownerName) next.ownerName = input.ownerName
  if (input.ownerTitle) next.ownerTitle = input.ownerTitle
  if (input.description) next.description = input.description
  if (input.launchedAt) next.launchedAt = input.launchedAt
  if (avatar) next.avatar = avatar
  const socials = [
    ...(input.email
      ? [{ label: input.locale === 'en' ? 'Email' : '邮箱', href: `mailto:${input.email}`, icon: 'lucide:mail' }]
      : []),
    ...(input.socials ?? []),
  ]
  if (socials.length) next.socials = socials
  if (typeof input.searchIndexing === 'boolean') next.searchIndexing = input.searchIndexing
  // 只保留与当前值不同的字段，审计与修订只记录真正的变化
  const patch: Partial<SiteSettingsValues> = {}
  for (const [field, value] of Object.entries(next) as [keyof SiteSettingsValues, unknown][]) {
    if (JSON.stringify(values[field]) !== JSON.stringify(value)) Object.assign(patch, { [field]: value })
  }
  return patch
}
