// @vitest-environment node
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

  it('保留非默认端口，移除凭据、路径、查询和片段', () => {
    expect(scriptOrigin('http://stats.example.com:8080/script.js?site=blog#load')).toBe('http://stats.example.com:8080')
    expect(scriptOrigin('https://reader:secret@stats.example.com:443/script.js')).toBe('https://stats.example.com')
    expect(scriptOrigin('https://[2001:db8::1]:8443/script.js')).toBe('https://[2001:db8::1]:8443')
  })

  it.each([
    undefined,
    null,
    '/script.js',
    '//stats.example.com/script.js',
    'data:text/javascript,alert(1)',
    'file:///tmp/a.js',
  ])('缺失或非 HTTP 绝对地址 %s 不产生 CSP 来源', (url) => {
    expect(scriptOrigin(url)).toBe('')
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

  it('按完整指令名和来源 token 匹配，重复目标指令仍只追加一次', () => {
    expect(
      appendCspSource(
        "script-src-elem 'self'; script-src https://stats.example.com.evil; img-src *",
        ['script-src', 'script-src'],
        'https://stats.example.com',
      ),
    ).toBe("script-src-elem 'self'; script-src https://stats.example.com.evil https://stats.example.com; img-src *")
  })

  it('空策略可以补齐多条指令，重复分隔和空白不产生空指令', () => {
    expect(appendCspSource(' ;  ; ', ['script-src', 'connect-src'], 'https://stats.example.com')).toBe(
      "script-src 'self' https://stats.example.com; connect-src 'self' https://stats.example.com",
    )
    expect(appendCspSource(" default-src 'self' ; script-src\t'self' ; ; ", ['script-src'], 'https://a.example')).toBe(
      "default-src 'self'; script-src 'self' https://a.example",
    )
  })
})
