/**
 * @file visitor-id.spec.ts
 * @description 访客 id 哈希与格式校验单元测试
 * @author TixXin
 * @since 2026-07-20
 */

import { hashVisitorId, VISITOR_ID_PATTERN } from '../visitor-id'

describe('visitor-id', () => {
  it('同一输入哈希稳定，不同输入哈希不同', () => {
    const a = hashVisitorId('visitor-abc-123')
    expect(a).toBe(hashVisitorId('visitor-abc-123'))
    expect(a).toHaveLength(64)
    expect(a).not.toBe(hashVisitorId('visitor-abc-124'))
  })

  it('合法格式：8-128 位可打印 ASCII', () => {
    expect(VISITOR_ID_PATTERN.test('abcd1234')).toBe(true)
    expect(VISITOR_ID_PATTERN.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('非法格式：过短、含空格、含中文、超长', () => {
    expect(VISITOR_ID_PATTERN.test('short')).toBe(false)
    expect(VISITOR_ID_PATTERN.test('has space here')).toBe(false)
    expect(VISITOR_ID_PATTERN.test('访客身份标识')).toBe(false)
    expect(VISITOR_ID_PATTERN.test('x'.repeat(129))).toBe(false)
  })
})
