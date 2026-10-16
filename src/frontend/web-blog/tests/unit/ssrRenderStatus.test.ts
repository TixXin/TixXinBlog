/**
 * @file ssrRenderStatus.test.ts
 * @description SSR 降级判定：上游 5xx 或网络失败返回 503，4xx 与无错误不改状态
 */
import { describe, expect, it } from 'vitest'
import { ssrDegradedStatus } from '~/utils/ssrRenderStatus'

describe('ssrDegradedStatus', () => {
  it('无错误或全部为空时不降级', () => {
    expect(ssrDegradedStatus(undefined)).toBeNull()
    expect(ssrDegradedStatus({ 'post-list': undefined, 'post-metadata': null })).toBeNull()
  })
  it('上游 5xx 或无状态码的失败返回 503', () => {
    expect(ssrDegradedStatus({ 'post-archive': { statusCode: 502 } })).toBe(503)
    expect(ssrDegradedStatus({ 'moment-overview': { message: 'fetch failed' } })).toBe(503)
  })
  it('4xx 由页面自行处理，不改状态码', () => {
    expect(ssrDegradedStatus({ 'gallery-selection': { statusCode: 404 } })).toBeNull()
  })
})
