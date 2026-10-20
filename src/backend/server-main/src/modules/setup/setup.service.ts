/**
 * @file setup.service.ts
 * @description 浏览器初始化向导：仅在配置了 SETUP_TOKEN 且没有任何管理员时可用，
 *              创建首个管理员、按需更新站点与博主资料（含头像登记为站内媒体）并写审计；完成后接口永久表现为不存在
 * @author TixXin
 * @since 2026-10-19
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { LockMode, UniqueConstraintViolationException } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  adminPasswordProblem,
  createAdminAccount,
  hashAdminPassword,
} from '../../admin-cli'
import { isAllowedAuthOrigin } from '../../common/guards/auth-origin.guard'
import { msg, zh } from '../../common/i18n'
import { AdminUser } from '../../entities/admin-user.entity'
import { AuditEntry } from '../../entities/audit-entry.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { SiteSettings, SiteSettingsRevision } from '../../entities/site-settings.entity'
import type { SiteSettingsValues } from '../../entities/site-settings.entity'
import { normalizeImage } from '../media/media-image'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { MediaStorage } from '../media/media-storage'
import { SAFE_INITIAL_SITE_VALUES, SAFE_INITIAL_SITE_VALUES_EN, initialSiteProfile } from '../site/initial-profile'
import { SetupDto } from './setup.dto'

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
function isSafeHttpUrl(value: string): boolean {
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
const LOCALIZABLE_FIELDS = ['ownerName', 'avatarAlt'] as const

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

@Injectable()
export class SetupService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    private readonly storage: MediaStorage,
  ) {}

  private token(): string {
    return this.config.get<string>('SETUP_TOKEN')?.trim() ?? ''
  }

  private async hasAdmin(em: EntityManager = this.em): Promise<boolean> {
    return (await em.count(AdminUser, {})) > 0
  }

  /** 未配置令牌时恒为 false；配置后仅在数据库里没有任何管理员时为 true */
  async status(): Promise<{ needsSetup: boolean }> {
    if (!this.token()) return { needsSetup: false }
    return { needsSetup: !(await this.hasAdmin()) }
  }

  /** 与全局 ValidationPipe 相同的规则（白名单、拒绝未知字段、转换），只在接口开放时执行 */
  private parse(body: unknown): SetupDto {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException(msg('setup.tokenInvalid'))
    const input = plainToInstance(SetupDto, body)
    const errors = validateSync(input, { whitelist: true, forbidNonWhitelisted: true })
    if (errors.length) {
      const first = errors[0]!
      const message = Object.values(first.constraints ?? {})[0] ?? `property ${first.property} should not exist`
      // 自定义消息为字典中文，全局过滤器按请求语言翻译；DTO 默认英文提示原样返回。
      throw new BadRequestException(message)
    }
    return input
  }

  async complete(body: unknown, request: { origin?: string; host?: string } = {}): Promise<{ username: string }> {
    const expected = this.token()
    // 接口关闭（未配置令牌或已有管理员）时与不存在的路由一致，不区分原因，也不先做参数或来源校验。
    if (!expected || (await this.hasAdmin())) throw new NotFoundException(SETUP_CLOSED_MESSAGE)
    if (!isAllowedAuthOrigin(request.origin, request.host, this.config.get<string>('CORS_ORIGIN', '')))
      throw new ForbiddenException(msg('common.crossSiteAuth'))
    // 令牌先于其余字段核对：令牌不对时不提示登录名或密码规则。
    const token = (body as { token?: unknown } | null)?.token
    if (!setupTokenMatches(token, expected)) throw new ForbiddenException(msg('setup.tokenInvalid'))
    const input = this.parse(body)
    const username = input.username.trim()
    if (!username || username.length > 64) throw new BadRequestException(msg('setup.usernameInvalid'))
    const problem = adminPasswordProblem(input.password)
    if (problem === 'missing') throw new BadRequestException(msg('setup.passwordMissing'))
    if (problem === 'tooShort')
      throw new BadRequestException(msg('setup.passwordTooShort', { min: ADMIN_PASSWORD_MIN_LENGTH }))
    if (problem === 'tooLong')
      throw new BadRequestException(msg('setup.passwordTooLong', { max: ADMIN_PASSWORD_MAX_LENGTH }))
    for (const link of input.socials ?? [])
      if (!isSafeHttpUrl(link.href)) throw new BadRequestException(msg('setup.socialUrlInvalid'))
    // 头像：外部地址与 Cravatar 只保存地址；图片在事务外解码与转码，事务内登记为站内媒体
    let avatar: string | undefined
    let avatarImage: Awaited<ReturnType<typeof normalizeImage>> | undefined
    if (input.avatarSource === 'url') {
      if (!input.avatarUrl || !isSafeHttpsUrl(input.avatarUrl))
        throw new BadRequestException(msg('setup.avatarUrlInvalid'))
      avatar = input.avatarUrl
    } else if (input.avatarSource === 'cravatar') {
      if (!input.email) throw new BadRequestException(msg('setup.avatarEmailRequired'))
      avatar = cravatarUrl(input.email)
    } else if (input.avatarSource === 'image') {
      try {
        avatarImage = await normalizeImage(decodeAvatarImage(input.avatarImage))
      } catch {
        throw new BadRequestException(msg('setup.avatarInvalid'))
      }
    }
    // 慢哈希放在事务外，缩短持表锁的时间。
    const passwordHash = await hashAdminPassword(input.password)
    let avatarKey: string | undefined
    try {
      return await this.em.transactional(async (tx) => {
        // 表级 SHARE ROW EXCLUSIVE 与自身及任何 INSERT 互斥：并发的向导提交与命令行初始化都在此排队，
        // 拿到锁后重新计数，先提交的一方之后只能看到已有管理员。
        await tx.execute('lock table admin_user in share row exclusive mode')
        if (await this.hasAdmin(tx)) throw new ConflictException(msg('setup.alreadyCompleted'))
        const user = createAdminAccount(tx, { username, passwordHash })
        if (avatarImage) {
          await lockMedia(tx)
          const id = randomUUID()
          avatarKey = `${id}.webp`
          await this.storage.put(avatarKey, avatarImage.buffer)
          tx.create(MediaAsset, {
            id,
            originalName: avatarImage.name,
            storageKey: avatarKey,
            mimeType: 'image/webp',
            byteSize: avatarImage.buffer.length,
            width: avatarImage.width,
            height: avatarImage.height,
            sha256: createHash('sha256').update(avatarImage.buffer).digest('hex'),
            alt: zh('setup.avatarAlt'),
          })
          // 先写入媒体记录，随后登记头像引用时按数据库中的媒体核对存在性
          await tx.flush()
          avatar = mediaUrl(id)
        }
        const fields = await this.applyProfile(tx, input, avatar)
        const now = new Date()
        tx.create(AuditEntry, {
          action: 'setup.complete',
          resourceType: 'account',
          resourceId: user.id,
          actorId: user.id,
          actorName: username,
          state: 'success',
          statusCode: 201,
          summary: { fields },
          createdAt: now,
          finishedAt: now,
        })
        await tx.flush()
        return { username }
      })
    } catch (error) {
      // 事务未提交时删除已写入的头像文件，不留下没有登记的媒体
      if (avatarKey) await this.storage.remove(avatarKey).catch(() => undefined)
      if (error instanceof UniqueConstraintViolationException)
        throw new ConflictException(msg('setup.alreadyCompleted'))
      throw error
    }
  }

  /** 站点名称与仍未编辑的初始博主资料：有变化时生成新修订，返回审计字段名（中文持久化） */
  private async applyProfile(tx: EntityManager, input: SetupDto, avatar?: string): Promise<string[]> {
    await lockMedia(tx)
    const settings = await tx.findOne(
      SiteSettings,
      { id: 'default' },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    )
    if (!settings) return []
    const patch = setupProfilePatch(settings.values, input, avatar)
    const changed = Object.keys(patch) as (keyof SiteSettingsValues)[]
    if (!changed.length) return []
    const now = new Date()
    settings.values = { ...settings.values, ...patch }
    settings.revision += 1
    settings.updatedAt = now
    tx.create(SiteSettingsRevision, {
      revision: settings.revision,
      values: settings.values,
      reason: zh('setup.reasonSiteProfile'),
      createdAt: now,
    })
    // 与后台保存一致：新修订同样登记头像的媒体引用，历史恢复与媒体回收不因此缺失引用。
    await synchronizeMediaReferences(tx, 'site:default', 'site', [settings.values.avatar], {})
    await synchronizeMediaReferences(
      tx,
      `site-revision:${settings.revision}`,
      'site-revision',
      [settings.values.avatar],
      { revision: settings.revision },
    )
    const labels: Partial<Record<keyof SiteSettingsValues, string>> = {
      name: zh('audit.field.name'),
      description: zh('audit.field.description'),
      ownerName: zh('audit.field.ownerName'),
      ownerTitle: zh('audit.field.ownerTitle'),
      avatar: zh('audit.field.avatar'),
      avatarAlt: zh('audit.field.avatarAlt'),
      socials: zh('audit.field.socials'),
      launchedAt: zh('setup.fieldLaunchedAt'),
    }
    return changed.map((field) => labels[field] ?? field)
  }
}
