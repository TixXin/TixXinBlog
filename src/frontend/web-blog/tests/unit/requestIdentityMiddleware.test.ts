// @vitest-environment node
/** @file requestIdentityMiddleware.test.ts @description 请求身份中间件的登记、内部继承和并发请求隔离 */
import { AsyncResource } from 'node:async_hooks'
import { defineEventHandler, type H3Event } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { clientIpForUpstream, currentRequestIdentity } from '../../server/utils/requestIdentity'

const runtimeConfig = vi.hoisted(() => ({ trustedProxyCidrs: '127.0.0.1/32' }))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)

let handler: typeof import('../../server/middleware/00.request-identity').default

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  handler = (await import('../../server/middleware/00.request-identity')).default
})

beforeEach(() => {
  runtimeConfig.trustedProxyCidrs = '127.0.0.1/32'
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function event(remoteAddress?: string, forwardedFor?: string): H3Event {
  return {
    node: { req: { socket: { remoteAddress }, headers: { 'x-forwarded-for': forwardedFor } } },
  } as unknown as H3Event
}

/** 模拟独立外部请求的异步根，避免 enterWith 影响其他用例或并发请求。 */
async function inRequest<T>(action: () => T | Promise<T>): Promise<T> {
  const resource = new AsyncResource('request-identity-test')
  try {
    return await resource.runInAsyncScope(action)
  } finally {
    resource.emitDestroy()
  }
}

describe('请求身份中间件', () => {
  it('登记真实连接解析出的身份，内部请求和缺失 socket 都保留外部身份', async () => {
    await inRequest(async () => {
      expect(handler(event('127.0.0.1', '203.0.113.5'))).toBeUndefined()
      expect(currentRequestIdentity()).toEqual({ clientIp: '203.0.113.5' })
      await Promise.resolve()

      expect(handler(event('', '198.51.100.99'))).toBeUndefined()
      expect(clientIpForUpstream(event(''))).toBe('203.0.113.5')
      const noSocket = { node: { req: { headers: {} } } } as unknown as H3Event
      expect(handler(noSocket)).toBeUndefined()
      expect(clientIpForUpstream(noSocket)).toBe('203.0.113.5')
    })
    expect(currentRequestIdentity()).toBeUndefined()
  })

  it('没有外部登记的内部请求不采纳伪造转发头，也不创建身份', async () => {
    await inRequest(() => {
      expect(handler(event(undefined, '198.51.100.99'))).toBeUndefined()
      expect(currentRequestIdentity()).toBeUndefined()
      expect(clientIpForUpstream(event(undefined, '198.51.100.99'))).toBe('')
    })
  })

  it('不可信外部连接会覆盖旧登记，直接使用连接地址', async () => {
    await inRequest(() => {
      handler(event('127.0.0.1', '203.0.113.5'))
      handler(event('198.51.100.7', '203.0.113.99'))
      expect(currentRequestIdentity()).toEqual({ clientIp: '198.51.100.7' })
      expect(clientIpForUpstream(event(''))).toBe('198.51.100.7')
      expect(clientIpForUpstream(event('127.0.0.1', '203.0.113.6'))).toBe('203.0.113.6')
    })
  })

  it('交错执行的外部请求及其内部调用各自沿用访客身份', async () => {
    const firstReady = Promise.withResolvers<undefined>()
    const secondReady = Promise.withResolvers<undefined>()
    const first = inRequest(async () => {
      handler(event('127.0.0.1', '203.0.113.5'))
      firstReady.resolve(undefined)
      await secondReady.promise
      handler(event(''))
      return clientIpForUpstream(event(''))
    })
    const second = inRequest(async () => {
      await firstReady.promise
      handler(event('127.0.0.1', '198.51.100.7'))
      secondReady.resolve(undefined)
      await Promise.resolve()
      handler(event(''))
      return clientIpForUpstream(event(''))
    })

    await expect(Promise.all([first, second])).resolves.toEqual(['203.0.113.5', '198.51.100.7'])
    expect(currentRequestIdentity()).toBeUndefined()
  })
})
