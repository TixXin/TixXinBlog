/**
 * @file audit-gate.guard.spec.ts
 * @description 审计守卫回归：request.id 与 traceId 一致后，审计记录携带 UUID 编号，非 UUID 不入库
 */
import type { ExecutionContext } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import { AuditGateGuard } from './audit-gate.guard'
import type { AuditService } from './audit.service'

async function run(id: unknown) {
  const audit = { begin: jest.fn().mockResolvedValue('audit-1'), complete: jest.fn() }
  const guard = new AuditGateGuard(audit as unknown as AuditService, {} as JwtService)
  const request = { path: '/api/v1/auth/login', method: 'POST', headers: {}, body: {}, id }
  const response = { setHeader: jest.fn(), once: jest.fn() }
  await guard.canActivate({
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext)
  return audit.begin.mock.calls[0]?.[2] as string | undefined
}

describe('AuditGateGuard traceId', () => {
  it('UUID 请求编号写入审计，非 UUID 编号不写入', async () => {
    expect(await run('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(await run('edge-trace.01')).toBeUndefined()
    expect(await run(7)).toBeUndefined()
  })
})
