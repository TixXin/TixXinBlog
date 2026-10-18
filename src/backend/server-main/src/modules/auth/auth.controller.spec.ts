/**
 * @file auth.controller.spec.ts
 * @description 认证接口单元测试：凭据传递、刷新 Cookie、审计上下文与会话管理。
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import type { Request, Response } from 'express'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard'
import type { AuditRequest } from '../audit/audit-request'
import { REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_MS } from './auth.constants'
import { AuthController } from './auth.controller'
import type { AuthService, LoginResult } from './auth.service'
import type { AuthSessionsService } from './auth-sessions.service'

const admin = {
  id: 'ae876a78-28d1-4216-af2c-e5e725a729e8',
  sessionId: 'b8ce2285-41b8-4427-9d71-4e8ff43fe3aa',
  sessionVersion: 3,
}
const otherSessionId = 'c5ab4aa9-74de-40a7-8729-d006b2690aa4'
const loginResult: LoginResult = {
  accessToken: 'access-token',
  expiresIn: 900,
  user: { id: admin.id, username: 'blogger' },
  refreshTokenPlain: 'refresh-cookie-only',
}

function setup() {
  const auth: jest.Mocked<
    Pick<AuthService, 'login' | 'refresh' | 'logout' | 'getMe' | 'changePassword' | 'hasSession'>
  > = {
    login: jest.fn().mockResolvedValue(loginResult),
    refresh: jest.fn().mockResolvedValue(loginResult),
    logout: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn(),
    changePassword: jest.fn().mockResolvedValue({ ok: true }),
    hasSession: jest.fn().mockResolvedValue(false),
  }
  const sessions: jest.Mocked<Pick<AuthSessionsService, 'list' | 'revoke' | 'revokeOthers'>> = {
    list: jest.fn(),
    revoke: jest.fn().mockResolvedValue({ ok: true, revoked: 1 }),
    revokeOthers: jest.fn().mockResolvedValue({ ok: true, revoked: 2 }),
  }
  const response = { cookie: jest.fn(), clearCookie: jest.fn() }
  return {
    auth,
    sessions,
    response,
    res: response as unknown as Response,
    controller: new AuthController(auth as AuthService, sessions as AuthSessionsService),
  }
}

function request(headers: Request['headers'] = {}, cookies?: Record<string, string>): AuditRequest {
  return { headers, cookies } as AuditRequest
}

function expectRefreshCookie(response: ReturnType<typeof setup>['response']) {
  expect(response.cookie).toHaveBeenCalledTimes(1)
  expect(response.cookie).toHaveBeenCalledWith(
    REFRESH_COOKIE_NAME,
    loginResult.refreshTokenPlain,
    expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/v1/auth', maxAge: REFRESH_TOKEN_TTL_MS }),
  )
}

describe('AuthController', () => {
  it('所有认证接口检查来源，账号与会话管理接口额外要求管理员身份', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController)).toContain(AuthOriginGuard)
    for (const method of ['sessionsList', 'revokeSession', 'revokeOthers', 'me', 'password'] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype[method])).toContain(AdminAuthGuard)
    }
  })

  it('登录只在 HttpOnly Cookie 中返回刷新凭据，并设置不含凭据的审计身份', async () => {
    const { controller, auth, response, res } = setup()
    const req = request({ 'user-agent': 'Browser/1.0' })

    const payload = await controller.login({ username: 'blogger', password: ' unchanged password ' }, req, res)

    expect(auth.login).toHaveBeenCalledWith('blogger', ' unchanged password ', 'Browser/1.0')
    expect(payload).toEqual({ accessToken: 'access-token', expiresIn: 900, user: loginResult.user })
    expectRefreshCookie(response)
    expect(req.auditActor).toEqual({ id: admin.id, name: 'blogger' })
    expect(req.auditResourceId).toBe(admin.id)
  })

  it('登录失败传播原异常，不签发 Cookie 或记录成功身份', async () => {
    const { controller, auth, response, res } = setup()
    const error = new UnauthorizedException('账号或密码错误')
    auth.login.mockRejectedValue(error)
    const req = request()

    await expect(controller.login({ username: 'blogger', password: 'wrong-password' }, req, res)).rejects.toBe(error)

    expect(response.cookie).not.toHaveBeenCalled()
    expect(req.auditActor).toBeUndefined()
    expect(req.auditResourceId).toBeUndefined()
  })

  it('刷新从 Cookie 读取凭据并传递设备与 traceId，响应不包含刷新凭据', async () => {
    const { controller, auth, response, res } = setup()
    const req = request(
      { 'user-agent': 'Browser/2.0', 'x-trace-id': 'refresh-trace-1', authorization: 'Bearer unrelated-access-token' },
      { [REFRESH_COOKIE_NAME]: 'previous-refresh-token' },
    )

    const payload = await controller.refresh(req, res)

    expect(auth.refresh).toHaveBeenCalledWith('previous-refresh-token', 'Browser/2.0', 'refresh-trace-1')
    expect(payload).toEqual({ accessToken: 'access-token', expiresIn: 900, user: loginResult.user })
    expectRefreshCookie(response)
  })

  it.each([undefined, {}])('缺少刷新 Cookie（%p）时由认证服务拒绝，不写入替代凭据', async (cookies) => {
    const { controller, auth, response, res } = setup()
    const error = new UnauthorizedException('刷新令牌无效')
    auth.refresh.mockRejectedValue(error)

    await expect(controller.refresh(request({ 'x-trace-id': 'missing-cookie' }, cookies), res)).rejects.toBe(error)

    expect(auth.refresh).toHaveBeenCalledWith('', undefined, 'missing-cookie')
    expect(response.cookie).not.toHaveBeenCalled()
  })

  it('登出同时转交 Cookie 与 Bearer，清除认证路径 Cookie 并记录撤销会话', async () => {
    const { controller, auth, response, res } = setup()
    const actor = { id: admin.id, name: 'blogger', sessionId: admin.sessionId, revoked: 2 }
    auth.logout.mockResolvedValue(actor)
    const req = request({ authorization: 'Bearer access-token' }, { [REFRESH_COOKIE_NAME]: 'refresh-token' })

    await expect(controller.logout(req, res)).resolves.toEqual({ ok: true, revoked: 2 })

    expect(auth.logout).toHaveBeenCalledWith('refresh-token', 'access-token')
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' })
    expect(req.auditActor).toEqual(actor)
    expect(req.auditResourceId).toBe(admin.sessionId)
  })

  it.each([undefined, 'Basic credentials', 'bearer access-token'])(
    '登出不把非 Bearer 请求头（%p）作为访问令牌',
    async (authorization) => {
      const { controller, auth, response, res } = setup()
      const req = request({ authorization })

      await expect(controller.logout(req, res)).resolves.toEqual({ ok: true, revoked: 0 })

      expect(auth.logout).toHaveBeenCalledWith(undefined, undefined)
      expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' })
      expect(req.auditActor).toBeUndefined()
      expect(req.auditResourceId).toBeUndefined()
    },
  )

  it('登出撤销失败时传播原异常，不伪造成功结果或审计身份', async () => {
    const { controller, auth, res } = setup()
    const error = new Error('撤销失败')
    auth.logout.mockRejectedValue(error)
    const req = request()

    await expect(controller.logout(req, res)).rejects.toBe(error)

    expect(req.auditActor).toBeUndefined()
  })

  it.each([
    { cookie: 'valid-refresh-token', authenticated: true },
    { cookie: 'invalid-refresh-token', authenticated: false },
    { cookie: undefined, authenticated: false },
  ])('会话探测返回认证服务判断：$authenticated', async ({ cookie, authenticated }) => {
    const { controller, auth } = setup()
    auth.hasSession.mockResolvedValue(authenticated)
    const cookies = cookie === undefined ? undefined : { [REFRESH_COOKIE_NAME]: cookie }

    await expect(controller.session(request({}, cookies))).resolves.toEqual({ authenticated })

    expect(auth.hasSession).toHaveBeenCalledWith(cookie)
  })

  it('当前账号只使用守卫提供的管理员编号读取', async () => {
    const { controller, auth } = setup()
    const profile = { ...loginResult.user, lastLoginAt: '2026-10-18T00:00:00.000Z' }
    auth.getMe.mockResolvedValue(profile)

    await expect(controller.me(admin)).resolves.toEqual(profile)

    expect(auth.getMe).toHaveBeenCalledWith(admin.id)
  })

  it('改密传递守卫确认的会话版本与原始密码，成功后清除刷新 Cookie', async () => {
    const { controller, auth, response, res } = setup()

    await expect(
      controller.password(admin, { currentPassword: ' old password ', newPassword: ' new password ' }, res),
    ).resolves.toEqual({ ok: true })

    expect(auth.changePassword).toHaveBeenCalledWith(admin.id, 3, ' old password ', ' new password ')
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' })
  })

  it.each([new BadRequestException('当前密码不正确'), new UnauthorizedException('登录已失效')])(
    '改密失败传播原异常并保留 Cookie：%p',
    async (error) => {
      const { controller, auth, response, res } = setup()
      auth.changePassword.mockRejectedValue(error)

      await expect(
        controller.password(admin, { currentPassword: 'current-password', newPassword: 'new-password' }, res),
      ).rejects.toBe(error)

      expect(response.clearCookie).not.toHaveBeenCalled()
    },
  )

  it('会话列表转交当前管理员、当前会话与请求页码', async () => {
    const { controller, sessions } = setup()
    const list = { items: [], total: 41, page: 3, pageSize: 20 }
    sessions.list.mockResolvedValue(list)

    await expect(controller.sessionsList(admin, { page: 3 })).resolves.toEqual(list)

    expect(sessions.list).toHaveBeenCalledWith(admin.id, admin.sessionId, 3)
  })

  it.each([0, 1])('撤销当前会话规范化大写 UUID，并在撤销数为 %i 时清除 Cookie', async (revoked) => {
    const { controller, sessions, response, res } = setup()
    sessions.revoke.mockResolvedValue({ ok: true, revoked })

    await expect(controller.revokeSession(admin, admin.sessionId.toUpperCase(), res)).resolves.toEqual({
      ok: true,
      revoked,
      current: true,
    })

    expect(sessions.revoke).toHaveBeenCalledWith(admin.id, admin.sessionId, admin.sessionId)
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' })
  })

  it('撤销其他会话保留当前 Cookie，明确返回 current 为 false', async () => {
    const { controller, sessions, response, res } = setup()

    await expect(controller.revokeSession(admin, otherSessionId.toUpperCase(), res)).resolves.toEqual({
      ok: true,
      revoked: 1,
      current: false,
    })

    expect(sessions.revoke).toHaveBeenCalledWith(admin.id, otherSessionId, admin.sessionId)
    expect(response.clearCookie).not.toHaveBeenCalled()
  })

  it('撤销当前会话失败时不提前清理 Cookie', async () => {
    const { controller, sessions, response, res } = setup()
    const error = new UnauthorizedException('当前会话已失效')
    sessions.revoke.mockRejectedValue(error)

    await expect(controller.revokeSession(admin, admin.sessionId, res)).rejects.toBe(error)

    expect(response.clearCookie).not.toHaveBeenCalled()
  })

  it('撤销其他会话始终传递当前会话作为保留目标', async () => {
    const { controller, sessions } = setup()

    await expect(controller.revokeOthers(admin)).resolves.toEqual({ ok: true, revoked: 2 })

    expect(sessions.revokeOthers).toHaveBeenCalledWith(admin.id, admin.sessionId)
  })
})
