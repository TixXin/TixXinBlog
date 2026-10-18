/**
 * @file admin-auth.guard.spec.ts
 * @description 管理员访问令牌、会话归属与版本，以及内容代次保护的单元回归
 */
import type { ExecutionContext } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import { AdminAuthGuard } from '../admin-auth.guard'
import type { AuthedRequest } from '../admin-auth.guard'
import { AdminSession } from '../../../entities/admin-session.entity'
import { ContentContext } from '../../../entities/content-context.entity'
import { ErrorCode } from '../../constants/error-codes'

describe('管理员会话守卫', () => {
  function setup(overrides: { method?: string; path?: string; context?: string } = {}) {
    const payload = { sub: randomUUID(), sid: randomUUID(), version: 0 }
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) }
    const em = { findOne: jest.fn().mockResolvedValue(null), findOneOrFail: jest.fn() }
    const request: Pick<AuthedRequest, 'headers' | 'method' | 'path' | 'adminUser'> = {
      headers: {
        authorization: 'Bearer isolated-token',
        ...(overrides.context ? { 'x-content-context': overrides.context } : {}),
      },
      method: overrides.method ?? 'GET',
      path: overrides.path ?? '/api/v1/auth/me',
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    }
    return {
      payload,
      request,
      jwt,
      em,
      guard: new AdminAuthGuard(jwt as unknown as JwtService, em as unknown as EntityManager),
      context: context as unknown as ExecutionContext,
    }
  }

  function sessionFor(payload: { sub: string; sid: string; version: number }, sessionVersion = payload.version) {
    return {
      id: payload.sid,
      adminUser: { id: payload.sub, username: 'admin', sessionVersion },
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }
  }

  it.each([undefined, '', 'Basic credentials', 'bearer isolated-token'])(
    '缺少有效 Bearer 前缀时拒绝：%s',
    async (header) => {
      const { guard, context, request, jwt, em } = setup()
      request.headers.authorization = header

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 401,
        code: ErrorCode.Unauthorized,
        message: '未鉴权:缺少 Bearer token',
      })
      expect(jwt.verifyAsync).not.toHaveBeenCalled()
      expect(em.findOne).not.toHaveBeenCalled()
      expect(request.adminUser).toBeUndefined()
    },
  )

  it.each([
    ['账号 ID 缺失', { sub: undefined }],
    ['账号 ID 不是字符串', { sub: 1 }],
    ['账号 ID 不是 UUID', { sub: 'invalid-admin-id' }],
    ['会话 ID 不是字符串', { sid: 1 }],
    ['会话 ID 不是 UUID', { sid: 'invalid-session-id' }],
    ['版本缺失', { version: undefined }],
    ['版本不是数字', { version: '0' }],
    ['版本不是整数', { version: 0.5 }],
  ])('%s 时拒绝令牌且不查询存储', async (_label, overrides) => {
    const { guard, context, payload, request, jwt, em } = setup()
    jwt.verifyAsync.mockResolvedValue({ ...payload, ...overrides })

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      code: ErrorCode.Unauthorized,
      message: 'Access token 非法',
    })
    expect(em.findOne).not.toHaveBeenCalled()
    expect(request.adminUser).toBeUndefined()
  })

  it.each([null, 'invalid-payload'])('载荷不是身份对象时拒绝：%s', async (payload) => {
    const { guard, context, jwt, em } = setup()
    jwt.verifyAsync.mockResolvedValue(payload)

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: ErrorCode.Unauthorized })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it.each([
    ['签名不匹配', 'another-unit-secret', 60, ErrorCode.Unauthorized],
    ['令牌已过期', 'isolated-unit-secret', -1, ErrorCode.AccessTokenExpired],
  ])('真实 JWT %s 时返回对应业务码', async (_label, signingSecret, expiresIn, code) => {
    const { context, payload, request, em } = setup()
    const verifier = new JwtService({ secret: 'isolated-unit-secret' })
    const signer = new JwtService({ secret: signingSecret })
    request.headers.authorization = `Bearer ${await signer.signAsync(payload, { expiresIn })}`
    const guard = new AdminAuthGuard(verifier, em as unknown as EntityManager)

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code })
    expect(em.findOne).not.toHaveBeenCalled()
    expect(request.adminUser).toBeUndefined()
  })

  it('格式损坏的真实 JWT 返回非法令牌错误', async () => {
    const { context, request, em } = setup()
    request.headers.authorization = 'Bearer malformed-token'
    const guard = new AdminAuthGuard(new JwtService({ secret: 'isolated-unit-secret' }), em as unknown as EntityManager)

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: ErrorCode.Unauthorized })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it('非 Error 类型的校验失败仍映射为非法令牌', async () => {
    const { guard, context, jwt, em } = setup()
    jwt.verifyAsync.mockRejectedValue('invalid-token')

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: ErrorCode.Unauthorized })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it('已撤销或不存在会话拒绝访问', async () => {
    const { guard, context, request, em } = setup()
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      code: ErrorCode.Unauthorized,
      message: '会话已失效，请重新登录',
    })
    expect(request.adminUser).toBeUndefined()
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })

  it('存储不可用返回 503，不伪装会话失效', async () => {
    const { guard, context, request, em } = setup()
    em.findOne.mockRejectedValue(new Error('database offline'))
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 503,
      message: '登录状态暂时无法校验，请稍后重试',
    })
    expect(request.adminUser).toBeUndefined()
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })

  it('没有会话身份的旧 JWT 需通过原 Cookie 刷新', async () => {
    const { guard, context, jwt, em } = setup()
    jwt.verifyAsync.mockResolvedValue({ sub: randomUUID(), version: 0 })
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it('有效会话注入管理员身份且不查询内容代次', async () => {
    const { guard, context, payload, request, jwt, em } = setup()
    em.findOne.mockResolvedValue(sessionFor(payload))
    const before = new Date()
    await expect(guard.canActivate(context)).resolves.toBe(true)
    const after = new Date()
    expect(jwt.verifyAsync).toHaveBeenCalledWith('isolated-token')
    expect(em.findOne).toHaveBeenCalledWith(
      AdminSession,
      {
        id: payload.sid,
        adminUser: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: expect.any(Date) },
      },
      { populate: ['adminUser'], refresh: true },
    )
    const cutoff = em.findOne.mock.calls[0]![1].expiresAt.$gt as Date
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(cutoff.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(request).toMatchObject({
      adminUser: { id: payload.sub, username: 'admin', sessionVersion: payload.version, sessionId: payload.sid },
    })
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })

  it('改密后真实有效 JWT 使用当前账号版本与资料注入身份', async () => {
    const { context, payload, request, em } = setup()
    payload.version = 4
    const jwt = new JwtService({ secret: 'isolated-unit-secret' })
    request.headers.authorization = `Bearer ${await jwt.signAsync({ ...payload, username: 'old-name' }, { expiresIn: 60 })}`
    em.findOne.mockResolvedValue({
      ...sessionFor(payload),
      adminUser: { id: payload.sub, username: 'current-name', sessionVersion: payload.version },
    })
    const guard = new AdminAuthGuard(jwt, em as unknown as EntityManager)

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.adminUser).toEqual({
      id: payload.sub,
      username: 'current-name',
      sessionVersion: payload.version,
      sessionId: payload.sid,
    })
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('管理读取方法 %s 不要求内容代次', async (method) => {
    const { guard, context, payload, em } = setup({ method, path: '/api/v1/admin/posts' })
    em.findOne.mockResolvedValue(sessionFor(payload))

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })

  it('认证接口写入不查询内容代次', async () => {
    const { guard, context, payload, em } = setup({ method: 'POST', path: '/api/v1/auth/password' })
    em.findOne.mockResolvedValue(sessionFor(payload))

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('未启用强制代次时 %s 管理写入可省略上下文', async (method) => {
    const { guard, context, payload, em } = setup({ method, path: '/api/v1/admin/posts' })
    em.findOne.mockResolvedValue(sessionFor(payload))
    em.findOneOrFail.mockResolvedValue({ requireContext: false, generation: 'current-generation' })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(em.findOneOrFail).toHaveBeenCalledWith(ContentContext, { id: 'default' }, { refresh: true })
  })

  it('未启用强制代次时仍拒绝主动携带的过期上下文', async () => {
    const { guard, context, payload, em } = setup({
      method: 'PATCH',
      path: '/api/v1/admin/posts',
      context: 'old-generation',
    })
    em.findOne.mockResolvedValue(sessionFor(payload))
    em.findOneOrFail.mockResolvedValue({ requireContext: false, generation: 'current-generation' })

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 409 })
  })

  it('内容恢复后缺少上下文的管理写入返回 428', async () => {
    const { guard, context, payload, em } = setup({ method: 'POST', path: '/api/v1/admin/posts' })
    em.findOne.mockResolvedValue(sessionFor(payload))
    em.findOneOrFail.mockResolvedValue({ requireContext: true, generation: 'new-generation' })
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 428 })
  })

  it('内容代次过期时管理写入返回 409，携带当前代次则放行', async () => {
    const stale = setup({ method: 'POST', path: '/api/v1/admin/posts', context: 'old-generation' })
    stale.em.findOne.mockResolvedValue(sessionFor(stale.payload))
    stale.em.findOneOrFail.mockResolvedValue({ requireContext: true, generation: 'new-generation' })
    await expect(stale.guard.canActivate(stale.context)).rejects.toMatchObject({ status: 409 })

    const fresh = setup({ method: 'POST', path: '/api/v1/admin/posts', context: 'new-generation' })
    fresh.em.findOne.mockResolvedValue(sessionFor(fresh.payload))
    fresh.em.findOneOrFail.mockResolvedValue({ requireContext: true, generation: 'new-generation' })
    await expect(fresh.guard.canActivate(fresh.context)).resolves.toBe(true)
  })

  it('会话版本不一致时拒绝', async () => {
    const { guard, context, payload, request, em } = setup({ method: 'POST', path: '/api/v1/admin/posts' })
    em.findOne.mockResolvedValue(sessionFor(payload, payload.version + 1))
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: ErrorCode.Unauthorized })
    expect(request.adminUser).toBeUndefined()
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })
})
