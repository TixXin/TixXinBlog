/**
 * @file setup.service.spec.ts
 * @description 浏览器初始化向导回归：令牌开关、常量时间比较、已有管理员关闭、并发只成功一次、成功后关闭与中英文错误
 * @author TixXin
 * @since 2026-10-19
 */
import type { ArgumentsHost } from '@nestjs/common'
import { HttpException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import * as argon2 from 'argon2'
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter'
import { AdminUser } from '../../entities/admin-user.entity'
import { AuditEntry } from '../../entities/audit-entry.entity'
import { SiteSettings, SiteSettingsRevision } from '../../entities/site-settings.entity'
import { SAFE_INITIAL_SITE_VALUES } from '../site/initial-profile'
import { SETUP_CLOSED_MESSAGE, SetupService, setupProfilePatch, setupTokenMatches } from './setup.service'

const TOKEN = 'f'.repeat(64)
const valid = { token: TOKEN, username: 'owner', password: 'correct-horse-battery' }

/** 模拟数据库：表锁用互斥队列模拟，事务提交前写入的管理员对其他事务不可见 */
function createDatabase(initialAdmins = 0) {
  const committed = { admins: initialAdmins }
  const settings = { id: 'default', revision: 0, values: { ...SAFE_INITIAL_SITE_VALUES }, updatedAt: new Date(0) }
  const created: Array<{ entity: unknown; data: Record<string, unknown> }> = []
  let lockQueue = Promise.resolve()
  const executed: string[] = []
  const root = {
    count: jest.fn(async () => committed.admins),
    transactional: jest.fn(async (run: (tx: unknown) => Promise<unknown>) => {
      let release = () => {}
      let pending = 0
      const tx = {
        execute: jest.fn(async (sql: string) => {
          executed.push(sql)
          if (sql.startsWith('lock table')) {
            const previous = lockQueue
            lockQueue = new Promise<void>((resolve) => (release = resolve))
            await previous
          }
          return []
        }),
        count: jest.fn(async () => committed.admins),
        findOne: jest.fn(async (entity: unknown) => (entity === SiteSettings ? settings : null)),
        find: jest.fn(async () => []),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const record = { id: `${created.length}-id`, ...data }
          created.push({ entity, data: record })
          if (entity === AdminUser) pending += 1
          return record
        }),
        persist: jest.fn(),
        flush: jest.fn(async () => undefined),
        nativeDelete: jest.fn(async () => 0),
        getReference: jest.fn(),
      }
      try {
        const result = await run(tx)
        committed.admins += pending
        return result
      } finally {
        release()
      }
    }),
  }
  return { em: root as unknown as EntityManager, root, committed, settings, created, executed }
}

function service(database = createDatabase(), env: Record<string, string> = { SETUP_TOKEN: TOKEN }) {
  return new SetupService(database.em, new ConfigService(env))
}

/** 经全局异常过滤器渲染，得到客户端实际收到的状态与 message */
function rendered(exception: unknown, acceptLanguage?: string) {
  const sent: { status?: number; body?: { message: string; code: number } } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: { message: string; code: number }) {
      sent.body = body
    },
  }
  const request = {
    method: 'POST',
    path: '/api/v1/setup',
    headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
  }
  new AllExceptionsFilter().catch(exception, {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost)
  return sent
}

async function failure(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise
  } catch (error) {
    if (error instanceof HttpException) return error
    throw error
  }
  throw new Error('预期请求被拒绝')
}

describe('setupTokenMatches', () => {
  it('长度不同或类型不对时拒绝，内容一致才放行', () => {
    expect(setupTokenMatches(TOKEN, TOKEN)).toBe(true)
    expect(setupTokenMatches(`${TOKEN}0`, TOKEN)).toBe(false)
    expect(setupTokenMatches(TOKEN.slice(1), TOKEN)).toBe(false)
    expect(setupTokenMatches('', TOKEN)).toBe(false)
    expect(setupTokenMatches(undefined, TOKEN)).toBe(false)
    expect(setupTokenMatches(TOKEN, '')).toBe(false)
  })
})

describe('SetupService', () => {
  it('未配置 SETUP_TOKEN 时 status 恒为 false，POST 与不存在的路由一样返回 404', async () => {
    for (const env of [{}, { SETUP_TOKEN: '' }, { SETUP_TOKEN: '   ' }] as Record<string, string>[]) {
      const database = createDatabase(0)
      const subject = service(database, env)
      expect(await subject.status()).toEqual({ needsSetup: false })
      const error = await failure(subject.complete(valid))
      expect(error.getStatus()).toBe(404)
      expect(rendered(error, 'en').body?.message).toBe(SETUP_CLOSED_MESSAGE)
      expect(database.root.transactional).not.toHaveBeenCalled()
    }
  })

  it('已有管理员时 status 为 false，POST 一律 404，参数错误与跨站来源也不暴露细节', async () => {
    const database = createDatabase(1)
    const subject = service(database)
    expect(await subject.status()).toEqual({ needsSetup: false })
    for (const body of [valid, { ...valid, token: 'wrong' }, { nonsense: true }, null]) {
      const error = await failure(subject.complete(body, { origin: 'https://evil.example', host: 'blog.example' }))
      expect([error.getStatus(), rendered(error).body?.message]).toEqual([404, SETUP_CLOSED_MESSAGE])
    }
    expect(database.root.transactional).not.toHaveBeenCalled()
  })

  it('令牌错误返回 403，按 Accept-Language 返回中英文案，不创建账号', async () => {
    const database = createDatabase(0)
    const subject = service(database)
    expect(await subject.status()).toEqual({ needsSetup: true })
    const error = await failure(subject.complete({ ...valid, token: 'e'.repeat(64) }))
    expect(error.getStatus()).toBe(403)
    expect(rendered(error).body?.message).toBe('初始化令牌无效，请核对安装完成时输出的链接')
    expect(rendered(error, 'en-US,en;q=0.9').body?.message).toBe(
      'The setup token is invalid. Check the link printed when installation finished.',
    )
    expect(database.root.transactional).not.toHaveBeenCalled()
  })

  it('跨站来源被拒绝，同源与无来源放行', async () => {
    const error = await failure(service().complete(valid, { origin: 'https://evil.example', host: 'blog.example.com' }))
    expect(error.getStatus()).toBe(403)
    expect(rendered(error, 'en').body?.message).toBe('Cross-site authentication requests are not allowed')
    await expect(
      service().complete(valid, { origin: 'https://blog.example.com', host: 'blog.example.com' }),
    ).resolves.toEqual({ username: 'owner' })
  })

  it('密码规则复用 assertAdminPassword 的长度限制，并给出中英文提示', async () => {
    const short = await failure(service().complete({ ...valid, password: 'short' }))
    expect(short.getStatus()).toBe(400)
    expect(rendered(short).body?.message).toBe('密码至少需要 6 个字符')
    expect(rendered(short, 'en').body?.message).toBe('The password must be at least 6 characters')
    const long = await failure(service().complete({ ...valid, password: 'x'.repeat(129) }))
    expect(rendered(long, 'en').body?.message).toBe('The password cannot exceed 128 characters')
    const placeholder = await failure(service().complete({ ...valid, password: '<required>' }))
    expect(rendered(placeholder, 'en').body?.message).toBe('Enter a password')
  })

  it('请求体按 DTO 白名单校验：登录名为空、未知字段与非法语言都返回 400', async () => {
    const blank = await failure(service().complete({ ...valid, username: '   ' }))
    expect([blank.getStatus(), rendered(blank, 'en').body?.message]).toEqual([
      400,
      'The username must be 1–64 characters',
    ])
    expect((await failure(service().complete({ ...valid, role: 'owner' }))).getStatus()).toBe(400)
    expect((await failure(service().complete({ ...valid, locale: 'fr' }))).getStatus()).toBe(400)
  })

  it('成功：argon2id 创建管理员、更新站点名称与初始资料语言、写审计，之后 status 为 false 且 POST 返回 404', async () => {
    const database = createDatabase(0)
    const subject = service(database)
    await expect(
      subject.complete({ ...valid, username: '  owner  ', siteName: '  Night Notes ', locale: 'en' }),
    ).resolves.toEqual({ username: 'owner' })
    expect(database.executed[0]).toBe('lock table admin_user in share row exclusive mode')
    const admin = database.created.find((item) => item.entity === AdminUser)!.data
    expect(admin.username).toBe('owner')
    expect(await argon2.verify(admin.passwordHash as string, valid.password)).toBe(true)
    expect(admin.passwordHash).toMatch(/^\$argon2id\$/)
    expect(database.settings.revision).toBe(1)
    expect(database.settings.values).toMatchObject({
      name: 'Night Notes',
      ownerName: 'Blogger',
      avatarAlt: 'Blogger avatar',
    })
    const revision = database.created.find((item) => item.entity === SiteSettingsRevision)!.data
    expect(revision).toMatchObject({ revision: 1, reason: '初始化向导设置站点资料' })
    const audit = database.created.find((item) => item.entity === AuditEntry)!.data
    expect(audit).toMatchObject({
      action: 'setup.complete',
      resourceType: 'account',
      actorName: 'owner',
      state: 'success',
      summary: { fields: ['站点名称', '博主名称', '头像说明'] },
    })
    expect(JSON.stringify(audit)).not.toContain(valid.password)
    expect(JSON.stringify(audit)).not.toContain(TOKEN)
    expect(await subject.status()).toEqual({ needsSetup: false })
    expect((await failure(subject.complete(valid))).getStatus()).toBe(404)
  })

  it('省略站点名称与语言时不生成站点资料修订', async () => {
    const database = createDatabase(0)
    await service(database).complete(valid)
    expect(database.settings.revision).toBe(0)
    expect(database.created.map((item) => item.entity)).toEqual([AdminUser, AuditEntry])
    expect(database.created[1]!.data.summary).toEqual({ fields: [] })
  })

  it('并发两次提交只成功一次：后拿到表锁的一方看到已有管理员并返回 409', async () => {
    const database = createDatabase(0)
    const subject = service(database)
    const results = await Promise.allSettled([
      subject.complete(valid),
      subject.complete({ ...valid, username: 'second' }),
    ])
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const error = rejected[0]!.reason as HttpException
    expect(error.getStatus()).toBe(409)
    expect(rendered(error, 'en').body?.message).toBe(
      'This site has already been set up. Sign in to the dashboard instead.',
    )
    expect(database.committed.admins).toBe(1)
    expect(database.created.filter((item) => item.entity === AuditEntry)).toHaveLength(1)
  })
})

describe('setupProfilePatch', () => {
  it('只改写仍为中英初始值的博主资料，博主编辑过的值保持不变', () => {
    expect(setupProfilePatch({ ...SAFE_INITIAL_SITE_VALUES }, { locale: 'zh-CN' })).toEqual({})
    expect(
      setupProfilePatch(
        { ...SAFE_INITIAL_SITE_VALUES, ownerName: 'Blogger', avatarAlt: 'Blogger avatar' },
        {
          locale: 'zh-CN',
        },
      ),
    ).toEqual({ ownerName: '博主', avatarAlt: '博主头像' })
    expect(setupProfilePatch({ ...SAFE_INITIAL_SITE_VALUES, ownerName: '小林' }, { locale: 'en' })).toEqual({
      avatarAlt: 'Blogger avatar',
    })
    expect(setupProfilePatch({ ...SAFE_INITIAL_SITE_VALUES }, { siteName: 'My Blog' })).toEqual({})
  })
})
