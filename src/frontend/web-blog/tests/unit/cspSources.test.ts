/** @file cspSources.test.ts @description 运行时 CSP 来源追加：合法 origin 提取、去重、缺失指令补齐与非法地址忽略 */
import { describe, expect, it } from 'vitest'
import { appendCspSource, scriptOrigin } from '../../server/utils/cspSources'

const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'"

describe('scriptOrigin', () => {
  it('只接受 http(s) 地址并返回 origin', () => {
    expect(scriptOrigin('https://stats.example.com/script.js')).toBe('https://stats.example.com')
    expect(scriptOrigin('javascript:alert(1)')).toBe('')
    expect(scriptOrigin('not a url')).toBe('')
    expect(scriptOrigin('')).toBe('')
  })
})

describe('appendCspSource', () => {
  it('追加到指定指令且不影响其他指令', () => {
    expect(appendCspSource(policy, ['script-src', 'connect-src'], 'https://stats.example.com')).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://stats.example.com; connect-src 'self' https://stats.example.com",
    )
  })

  it('已包含时不重复，空来源原样返回', () => {
    const once = appendCspSource(policy, ['script-src'], 'https://a.example')
    expect(appendCspSource(once, ['script-src'], 'https://a.example')).toBe(once)
    expect(appendCspSource(policy, ['script-src'], '')).toBe(policy)
  })

  it('指令缺失时以 self 为基础补齐', () => {
    expect(appendCspSource("default-src 'self'", ['connect-src'], 'https://a.example')).toBe(
      "default-src 'self'; connect-src 'self' https://a.example",
    )
  })
})
