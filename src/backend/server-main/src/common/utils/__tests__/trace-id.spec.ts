/**
 * @file trace-id.spec.ts
 * @description traceId 回归：上游值格式白名单、非法值重新生成、同一请求只生成一次
 */
import type { IncomingMessage } from 'node:http'
import { getTraceId, normalizeTraceId } from '../trace-id'

const request = (traceId?: unknown) => ({ headers: { 'x-trace-id': traceId } }) as unknown as IncomingMessage
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('traceId', () => {
  it('接受 UUID（统一小写）与不超过 64 位的安全字符', () => {
    expect(normalizeTraceId(' 3F2504E0-4F89-41D3-9A0C-0305E82C3301 ')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(normalizeTraceId('edge.req-01_A')).toBe('edge.req-01_A')
    expect(normalizeTraceId('a'.repeat(64))).toBe('a'.repeat(64))
  })

  it.each(['', 'a'.repeat(65), 'bad id', 'line\nbreak', '<script>', '中文', ['array']])('拒绝 %p', (value) => {
    expect(normalizeTraceId(value)).toBeUndefined()
  })

  it('非法上游值被替换为新 UUID，同一请求重复读取保持一致', () => {
    const req = request('evil\r\nX-Injected: 1')
    const first = getTraceId(req)
    expect(first).toMatch(uuid)
    expect(getTraceId(req)).toBe(first)
    expect(getTraceId(request('upstream-1'))).toBe('upstream-1')
    expect(getTraceId(request())).toMatch(uuid)
  })
})
