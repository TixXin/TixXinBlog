/**
 * @file admin-auth.guard.spec.ts
 * @description 数据库故障与会话失效必须区分，避免瞬时故障被误判为退出。
 */
import type { ExecutionContext } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import { AdminAuthGuard } from '../admin-auth.guard'
describe('管理员会话守卫', () => {
  function setup() {
    const payload = { sub: randomUUID(), sid: randomUUID(), version: 0 }
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) }
    const em = { findOne: jest.fn().mockResolvedValue(null) }
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer isolated-token' } }) }),
    }
    return {
      jwt,
      em,
      guard: new AdminAuthGuard(jwt as unknown as JwtService, em as unknown as EntityManager),
      context: context as unknown as ExecutionContext,
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
})
