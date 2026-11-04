// @vitest-environment node
/** @file releaseHeaderMiddleware.test.ts @description 版本响应头由前端按运行时配置下发，未配置时不下发 */
import { createEvent, defineEventHandler, setResponseHeader } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const runtimeConfig = vi.hoisted(() => ({ releaseVersion: '' as string | undefined }))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)

let handler: typeof import('../../server/middleware/02.release-header').default

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setResponseHeader', setResponseHeader)
  handler = (await import('../../server/middleware/02.release-header')).default
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function run(version: string | undefined) {
  runtimeConfig.releaseVersion = version
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)
  handler(createEvent(req, res))
  return res.getHeader('x-tixxin-release')
}

describe('版本响应头', () => {
  it('按运行时配置下发，去掉首尾空白', () => {
    expect(run('0.6.0')).toBe('0.6.0')
    expect(run(' sha-abc123 ')).toBe('sha-abc123')
  })

  it('本机开发与静态发布未配置版本时不下发', () => {
    expect(run('')).toBeUndefined()
    expect(run(undefined)).toBeUndefined()
    expect(run('   ')).toBeUndefined()
  })
})
