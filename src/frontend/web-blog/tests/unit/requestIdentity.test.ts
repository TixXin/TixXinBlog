// @vitest-environment node
/** @file requestIdentity.test.ts @description 访客 IP 来源：外部请求按可信代理解析，内部调用沿用登记身份，没有登记不捏造地址 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { H3Event } from 'h3'
import {
  clientIpForUpstream,
  enterRequestIdentity,
  isInternalRequest,
  resolveEventClientIp,
} from '../../server/utils/requestIdentity'

const runtimeConfig = vi.hoisted(() => ({ apiBaseUrl: '', trustedProxyCidrs: '127.0.0.1/32' }))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)

beforeEach(() => {
  runtimeConfig.trustedProxyCidrs = '127.0.0.1/32'
})

function event(remoteAddress: string | undefined, forwardedFor?: string) {
  return {
    node: { req: { socket: { remoteAddress }, headers: { 'x-forwarded-for': forwardedFor } } },
  } as unknown as H3Event
}

it('真实连接直接按可信代理解析，模拟 socket 视为内部调用', () => {
  expect(isInternalRequest('')).toBe(true)
  expect(isInternalRequest(undefined)).toBe(true)
  expect(isInternalRequest('127.0.0.1')).toBe(false)
  expect(resolveEventClientIp(event('127.0.0.1', '203.0.113.5'))).toBe('203.0.113.5')
  expect(clientIpForUpstream(event('127.0.0.1', '203.0.113.5'))).toBe('203.0.113.5')
})

it('内部调用沿用外部请求登记的访客身份，没有登记时保持空串', async () => {
  expect(clientIpForUpstream(event(''))).toBe('')
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      enterRequestIdentity({ clientIp: '198.51.100.7' })
      // SSR 期间的内部 fetch 是外部请求的异步后代
      void Promise.resolve().then(() => {
        expect(clientIpForUpstream(event(''))).toBe('198.51.100.7')
        resolve()
      })
    }, 0)
  })
  // 其它异步分支不受该登记影响
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
})

it('运行时收回或更换代理信任后立即按新配置解析', () => {
  const request = event('127.0.0.1', '203.0.113.5')
  expect(resolveEventClientIp(request)).toBe('203.0.113.5')

  runtimeConfig.trustedProxyCidrs = ''
  expect(resolveEventClientIp(request)).toBe('127.0.0.1')
  runtimeConfig.trustedProxyCidrs = '192.0.2.0/24'
  expect(resolveEventClientIp(request)).toBe('127.0.0.1')
  expect(resolveEventClientIp(event('192.0.2.8', '203.0.113.6'))).toBe('203.0.113.6')
})

it('非法运行配置不沿用旧信任，修正后可以恢复解析', () => {
  const request = event('127.0.0.1', '203.0.113.5')
  expect(resolveEventClientIp(request)).toBe('203.0.113.5')
  runtimeConfig.trustedProxyCidrs = 'true'
  expect(() => resolveEventClientIp(request)).toThrow('NUXT_TRUSTED_PROXY_CIDRS')
  runtimeConfig.trustedProxyCidrs = ''
  expect(resolveEventClientIp(request)).toBe('127.0.0.1')
})
