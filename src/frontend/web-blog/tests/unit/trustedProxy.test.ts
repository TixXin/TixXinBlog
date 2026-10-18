// @vitest-environment node
/** @file trustedProxy.test.ts @description 可信代理配置、转发链和受管媒体路径的边界校验 */
import { describe, expect, it } from 'vitest'
import { canCacheMediaResponse, createProxyTrust, resolveProxyClientIp } from '../../server/utils/trustedProxy'

describe('createProxyTrust', () => {
  it('空白配置不信任地址，混合配置只接受明确地址与子网', () => {
    const empty = createProxyTrust(' , , ')
    expect(empty('127.0.0.1')).toBe(false)
    expect(empty('::1')).toBe(false)
    const trust = createProxyTrust(' 192.0.2.8, 198.51.100.0/24, 2001:db8:1::/48, ::1, ')
    for (const address of ['192.0.2.8', '198.51.100.0', '198.51.100.255', '2001:db8:1:ffff::8', '::1']) {
      expect(trust(address), address).toBe(true)
    }
    for (const address of ['192.0.2.9', '198.51.101.1', '2001:db8:2::8', 'localhost', '']) {
      expect(trust(address), address).toBe(false)
    }
  })

  it.each(['127.0.0.1/', '127.0.0.1/-1', '127.0.0.1/1.5', '::1/abc', '127.0.0.1:80', '192.0.2.1,invalid'])(
    '拒绝非法代理配置 %s，不静默接受其中部分配置',
    (config) => {
      expect(() => createProxyTrust(config)).toThrow('NUXT_TRUSTED_PROXY_CIDRS')
    },
  )
})

describe('resolveProxyClientIp', () => {
  const trust = createProxyTrust('192.0.2.0/24, 2001:db8:1::/48')

  it('剥离受信任代理后停在首个不可信节点，不采纳更左侧头值', () => {
    expect(resolveProxyClientIp('192.0.2.8', '203.0.113.9, 198.51.100.7, 192.0.2.9', trust)).toBe('198.51.100.7')
    expect(resolveProxyClientIp('2001:db8:1::8', '2001:db8:2::7, 2001:db8:1::9', trust)).toBe('2001:db8:2::7')
  })

  it.each(['', 'not-an-ip', undefined])('缺失或无效连接地址 %s 不通过转发头补造身份', (remote) => {
    expect(resolveProxyClientIp(remote, '198.51.100.7', trust)).toBe('')
  })

  it.each(['', '198.51.100.7,', ',198.51.100.7', '198.51.100.7, unknown', '198.51.100.7:80', '[2001:db8:2::7]'])(
    '缺失或包含无效节点的转发链 %s 回退到连接地址',
    (forwardedFor) => {
      expect(resolveProxyClientIp('192.0.2.8', forwardedFor, trust)).toBe('192.0.2.8')
    },
  )
})

describe('canCacheMediaResponse', () => {
  it.each([
    'media/08c765c3-e450-38ed-bd57-c73cd4aa7001.webp',
    'media/08c765c3-e450-48ed-7d57-c73cd4aa7001.webp',
    'media/08c765c3-e450-48ed-bd57-c73cd4aa7001.png',
    'media/08c765c3-e450-48ed-bd57-c73cd4aa7001.webp?w=320',
    '/media/08c765c3-e450-48ed-bd57-c73cd4aa7001.webp',
    'subscriptions/favicons/08c765c3-e450-48ed-bd57-c73cd4aa7001.webp',
  ])('非精确受管媒体路径 %s 不保留条件缓存', (path) => {
    expect(canCacheMediaResponse(path, 'GET', 304)).toBe(false)
  })
})
