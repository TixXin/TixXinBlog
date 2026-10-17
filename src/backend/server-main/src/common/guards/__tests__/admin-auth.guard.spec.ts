/**
 * @file admin-auth.guard.spec.ts
 * @description 数据库故障与会话失效必须区分；成功注入与内容代次 428/409 也需独立回归
 */
import type { ExecutionContext } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import { AdminAuthGuard } from '../admin-auth.guard'

describe('管理员会话守卫', () => {
  function setup(overrides: { method?: string; path?: string; context?: string } = {}) {
    const payload = { sub: randomUUID(), sid: randomUUID(), version: 0 }
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) }
    const em = { findOne: jest.fn().mockResolvedValue(null), findOneOrFail: jest.fn() }
    const request = {
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

  it('已撤销或不存在会话拒绝访问', async () => {
    const { guard, context } = setup()
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 })
  })

  it('存储不可用返回 503，不伪装会话失效', async () => {
    const { guard, context, em } = setup()
    em.findOne.mockRejectedValue(new Error('database offline'))
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503 })
  })

  it('没有会话身份的旧 JWT 需通过原 Cookie 刷新', async () => {
    const { guard, context, jwt, em } = setup()
    jwt.verifyAsync.mockResolvedValue({ sub: randomUUID(), version: 0 })
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it('有效会话注入管理员身份且不查询内容代次', async () => {
    const { guard, context, payload, request, em } = setup()
    em.findOne.mockResolvedValue(sessionFor(payload))
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request).toMatchObject({
      adminUser: { id: payload.sub, username: 'admin', sessionVersion: payload.version, sessionId: payload.sid },
    })
    expect(em.findOneOrFail).not.toHaveBeenCalled()
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
    const { guard, context, payload, em } = setup()
    em.findOne.mockResolvedValue(sessionFor(payload, payload.version + 1))
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 })
  })
})
