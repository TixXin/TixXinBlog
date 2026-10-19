/**
 * @file apiConflict.test.ts
 * @description 409 冲突种类按后端业务码与 ownershipChanged 判断，不随界面语言变化
 * @author TixXin
 * @since 2026-10-19
 */
import { describe, expect, it } from 'vitest'
import { apiConflictKind, apiResponseCode } from '~/utils/apiError'

const envelope = (code: unknown, message = '') => ({ statusCode: 409, data: { code, message, data: null } })

describe('apiConflictKind', () => {
  it.each([
    [envelope(41, 'Subscription was modified'), 'revision'],
    [envelope(42, '站点数据上下文已变化'), 'context'],
    [envelope(43), 'context'],
    [envelope(44, 'This submission was already processed'), 'submission'],
    [envelope(40, '订阅已被修改，请保留输入并重新读取'), 'unknown'],
    [envelope('41'), 'unknown'],
    [new Error('Network error'), 'unknown'],
    [Object.assign(new Error('Your account or content library changed'), { ownershipChanged: true }), 'context'],
    [undefined, 'unknown'],
  ])('%#', (cause, expected) => {
    expect(apiConflictKind(cause)).toBe(expected)
  })

  it('只接受整数业务码', () => {
    expect(apiResponseCode(envelope(44))).toBe(44)
    expect(apiResponseCode(envelope(4.5))).toBeNull()
    expect(apiResponseCode(null)).toBeNull()
  })
})
