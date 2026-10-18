/** @file subscription-favicon.spec.ts @description 固定供应商图标代理的DNS、实际图片、缓存和失败边界 */
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import type { RequestOptions } from 'node:https'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import {
  downloadFavicon,
  faviconKey,
  faviconUrl,
  normalizeFavicon,
  providerPath,
  publicAddress,
  SubscriptionFaviconService,
} from './subscription-favicon.service'
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }))
jest.mock('node:https', () => ({ request: jest.fn() }))
const lookupMock = jest.mocked(lookup)
const requestMock = jest.mocked(request)
const artifactRoot = resolve(__dirname, '../../../../../../.artifacts')
type ResponseOptions = {
  contentLength?: string
  chunks?: Buffer[]
  requestError?: Error
  responseError?: Error
  waitForAbort?: boolean
}
function response(bytes: Buffer, statusCode = 200, contentType = 'image/png', options: ResponseOptions = {}) {
  const destroy = jest.fn()
  requestMock.mockImplementation((_options: unknown, callback: unknown) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void }
    if (options.waitForAbort) {
      const signal = (_options as RequestOptions).signal!
      signal.addEventListener('abort', () => req.emit('error', signal.reason), { once: true })
    }
    req.end = () => {
      if (options.requestError) {
        req.emit('error', options.requestError)
        return
      }
      if (options.waitForAbort) return
      let destroyed = false
      const res = new EventEmitter() as EventEmitter & {
        statusCode: number
        headers: object
        destroy: (error?: Error) => void
      }
      res.statusCode = statusCode
      res.headers = { 'content-type': contentType, 'content-length': options.contentLength }
      res.destroy = destroy.mockImplementation((error?: Error) => {
        destroyed = true
        if (error) res.emit('error', error)
      })
      ;(callback as (res: unknown) => void)(res)
      if (destroyed) return
      if (options.responseError) {
        res.emit('error', options.responseError)
        return
      }
      for (const chunk of options.chunks ?? [bytes]) {
        res.emit('data', chunk)
        if (destroyed) return
      }
      res.emit('end')
    }
    return req as never
  })
  return { destroy }
}
async function createPng() {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: 'blue' } })
    .png()
    .toBuffer()
}
beforeEach(() => {
  jest.resetAllMocks()
  lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})
describe('favicon代理边界', () => {
  it.each([
    '',
    'localhost',
    '999.1.1.1',
    '0.0.0.0',
    '0.255.255.255',
    '127.0.0.1',
    '10.1.1.1',
    '100.64.0.1',
    '100.127.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.0.2.1',
    '192.88.99.1',
    '198.18.1.1',
    '198.19.255.255',
    '198.51.100.1',
    '203.0.113.1',
    '224.1.1.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
    '2001::1',
    '2001:1ff::1',
    '2001:db8::1',
    '2001:0db8:0000:0000:0000:0000:0000:0001',
    '2002:7f00:1::1',
    '3fff::1',
    '4000::1',
  ])('拒绝保留地址 %s', (address) => {
    expect(publicAddress(address)).toBe(false)
  })
  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '100.63.255.255',
    '100.128.0.0',
    '172.15.255.255',
    '172.32.0.0',
    '192.88.98.255',
    '192.88.100.0',
    '198.17.255.255',
    '198.20.0.0',
    '223.255.255.255',
    '2000::1',
    '2001:200::1',
    '2001:4860:4860::8888',
    '2003::1',
    '3ffe::1',
  ])('允许保留段边界以外的公网地址 %s', (address) => {
    expect(publicAddress(address)).toBe(true)
  })
  it('仅使用固定供应商与固定路径，域名不携带官网敏感参数', async () => {
    response(Buffer.from('png'))
    await downloadFavicon('github.com')
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 't3.gstatic.com',
        port: 443,
        path: providerPath('github.com'),
        agent: false,
      }),
      expect.any(Function),
    )
    expect(providerPath('github.com')).not.toContain('secret')
    expect(faviconUrl('github.com')).toBe(`/api/v1/subscriptions/favicons/${faviconKey('github.com')}.webp`)
  })
  it('DNS返回任意私网地址即拒绝，避免重解析绕过', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never)
    await expect(downloadFavicon('github.com')).rejects.toThrow('地址不安全')
    expect(requestMock).not.toHaveBeenCalled()
  })
  it.each([
    { addresses: [] },
    {
      addresses: [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    },
    {
      addresses: [
        { address: '2001:4860:4860::8888', family: 6 },
        { address: 'fe80::1', family: 6 },
      ],
    },
  ])('空解析或混合私网解析不发起 HTTPS：$addresses', async ({ addresses }) => {
    lookupMock.mockResolvedValue(addresses as never)
    await expect(downloadFavicon('github.com')).rejects.toThrow('地址不安全')
    expect(requestMock).not.toHaveBeenCalled()
  })
  it('DNS异常原样拒绝且清除解析计时器', async () => {
    jest.useFakeTimers()
    const error = new Error('DNS 查询失败')
    lookupMock.mockRejectedValue(error)
    await expect(downloadFavicon('github.com')).rejects.toBe(error)
    expect(requestMock).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
  it('DNS在三秒仍未完成时拒绝且不发起 HTTPS', async () => {
    jest.useFakeTimers()
    lookupMock.mockImplementation(() => new Promise(() => undefined))
    const result = expect(downloadFavicon('github.com')).rejects.toThrow('图标解析超时')
    jest.advanceTimersByTime(2999)
    expect(requestMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    await result
    expect(requestMock).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
  it.each([
    {
      addresses: [
        { address: '2001:4860:4860::8888', family: 6 },
        { address: '8.8.8.8', family: 4 },
      ],
      chosen: { address: '8.8.8.8', family: 4 },
    },
    {
      addresses: [{ address: '2001:4860:4860::8888', family: 6 }],
      chosen: { address: '2001:4860:4860::8888', family: 6 },
    },
  ])('固定供应商连接绑定已验证的地址 $chosen.address', async ({ addresses, chosen }) => {
    lookupMock.mockResolvedValue(addresses as never)
    response(Buffer.from('png'))
    await downloadFavicon('github.com')
    expect(lookupMock).toHaveBeenCalledTimes(1)
    expect(lookupMock).toHaveBeenCalledWith('t3.gstatic.com', { all: true })
    const options = requestMock.mock.calls[0]![0] as RequestOptions
    expect(options).toMatchObject({
      hostname: 't3.gstatic.com',
      servername: 't3.gstatic.com',
      port: 443,
      method: 'GET',
      family: chosen.family,
      agent: false,
    })
    const callback = jest.fn()
    const pinnedLookup = options.lookup as (
      host: string,
      options: object,
      callback: (error: Error | null, address: string, family: number) => void,
    ) => void
    pinnedLookup('t3.gstatic.com', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, chosen.address, chosen.family)
    expect(lookupMock).toHaveBeenCalledTimes(1)
  })
  it('重定向和超大响应立即拒绝', async () => {
    response(Buffer.from(''), 302)
    await expect(downloadFavicon('github.com')).rejects.toThrow()
    response(Buffer.alloc(256 * 1024 + 1))
    await expect(downloadFavicon('github.com')).rejects.toThrow('体积过大')
  })
  it.each([301, 302, 303, 307, 308, 404, 500])('拒绝状态码 %s，不跟随重定向', async (status) => {
    const { destroy } = response(Buffer.from('png'), status)
    await expect(downloadFavicon('github.com')).rejects.toThrow('图标响应不合法')
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })
  it.each(['', 'text/html', 'image/svg+xml', 'image/gif', 'image/png-extra'])(
    '拒绝不支持的响应类型 %s',
    async (type) => {
      const { destroy } = response(Buffer.from('image'), 200, type)
      await expect(downloadFavicon('github.com')).rejects.toThrow('图标响应不合法')
      expect(destroy).toHaveBeenCalledTimes(1)
    },
  )
  it.each(['image/png', 'image/jpeg', 'image/webp', 'IMAGE/PNG; charset=binary'])(
    '允许图片响应类型 %s',
    async (type) => {
      const bytes = Buffer.from('image')
      response(bytes, 200, type)
      await expect(downloadFavicon('github.com')).resolves.toEqual(bytes)
    },
  )
  it('声明长度超限时在读取响应体前销毁连接', async () => {
    const { destroy } = response(Buffer.from('small'), 200, 'image/png', { contentLength: String(256 * 1024 + 1) })
    await expect(downloadFavicon('github.com')).rejects.toThrow('图标响应不合法')
    expect(destroy).toHaveBeenCalledWith()
  })
  it('累计分块大小独立校验，不信任较小的声明长度', async () => {
    const { destroy } = response(Buffer.alloc(0), 200, 'image/png', {
      contentLength: '1',
      chunks: [Buffer.alloc(128 * 1024), Buffer.alloc(128 * 1024), Buffer.from('x')],
    })
    await expect(downloadFavicon('github.com')).rejects.toThrow('图标体积过大')
    expect(destroy).toHaveBeenCalledWith(expect.objectContaining({ message: '图标体积过大' }))
  })
  it('恰好达到大小上限的多块响应保留顺序并完整返回', async () => {
    const chunks = [Buffer.alloc(128 * 1024, 1), Buffer.alloc(128 * 1024, 2)]
    const { destroy } = response(Buffer.alloc(0), 200, 'image/png', {
      contentLength: String(256 * 1024),
      chunks,
    })
    await expect(downloadFavicon('github.com')).resolves.toEqual(Buffer.concat(chunks))
    expect(destroy).not.toHaveBeenCalled()
  })
  it.each(['requestError', 'responseError'] as const)('传播 %s 网络异常', async (kind) => {
    const error = new Error('连接中断')
    response(Buffer.alloc(0), 200, 'image/png', { [kind]: error })
    await expect(downloadFavicon('github.com')).rejects.toBe(error)
  })
  it('下载使用五秒取消信号并传播超时异常', async () => {
    const controller = new AbortController()
    const error = new Error('下载超时')
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      queueMicrotask(() => controller.abort(error))
      return controller.signal
    })
    response(Buffer.alloc(0), 200, 'image/png', { waitForAbort: true })
    await expect(downloadFavicon('github.com')).rejects.toBe(error)
    expect(timeout).toHaveBeenCalledWith(5000)
  })
  it.each([Buffer.alloc(0), Buffer.alloc(256 * 1024 + 1)])('空内容或超限字节不进入图片解码', async (bytes) => {
    await expect(normalizeFavicon(bytes)).rejects.toThrow('图标体积不合法')
  })
  it('校验实际格式、尺寸，拒绝SVG与伪装图片', async () => {
    await expect(
      normalizeFavicon(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')),
    ).rejects.toThrow()
    await expect(normalizeFavicon(Buffer.from('not a png'))).rejects.toThrow()
    const large = await sharp({ create: { width: 513, height: 1, channels: 3, background: 'white' } })
      .png()
      .toBuffer()
    await expect(normalizeFavicon(large)).rejects.toThrow()
    const small = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'blue' } })
      .png()
      .toBuffer()
    const result = await normalizeFavicon(small)
    expect((await sharp(result).metadata()).format).toBe('webp')
  })
  it.each(['jpeg', 'webp'] as const)('将真实 %s 图片统一为可读取的 WebP 缓存', async (format) => {
    const source = await sharp(await createPng())
      .toFormat(format)
      .toBuffer()
    const normalized = await normalizeFavicon(source)
    const metadata = await sharp(normalized).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: 16, height: 16 })
    expect(metadata.pages ?? 1).toBe(1)
  })
  it('拒绝可解码但不在允许格式内的 SVG 与 GIF', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>',
    )
    const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64')
    await expect(normalizeFavicon(svg)).rejects.toThrow('图标内容不合法')
    await expect(normalizeFavicon(gif)).rejects.toThrow('图标内容不合法')
  })
  it('拒绝超高图片，允许宽高均处于512像素上限的图片', async () => {
    const tall = await sharp({ create: { width: 1, height: 513, channels: 3, background: 'white' } })
      .png()
      .toBuffer()
    await expect(normalizeFavicon(tall)).rejects.toThrow('图标内容不合法')
    const maximum = await sharp({ create: { width: 512, height: 512, channels: 3, background: 'white' } })
      .png()
      .toBuffer()
    expect(await sharp(await normalizeFavicon(maximum)).metadata()).toMatchObject({ width: 512, height: 512 })
  })
  it('成功缓存供只读接口复用，失败缓存减少重试，force可显式恢复', async () => {
    await mkdir(artifactRoot, { recursive: true })
    const root = await mkdtemp(join(artifactRoot, 'subscription-favicon-'))
    try {
      const service = new SubscriptionFaviconService(new ConfigService({ MEDIA_DIRECTORY: root, NODE_ENV: 'test' }))
      const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'blue' } })
        .png()
        .toBuffer()
      response(png)
      expect((await service.fetch('https://github.com/path?private=1')).state).toBe('ready')
      expect((await service.read(`${faviconKey('github.com')}.webp`)).length).toBeGreaterThan(0)
      await service.fetch('https://github.com')
      expect(requestMock).toHaveBeenCalledTimes(1)
      await expect(service.read('../secret')).rejects.toThrow()
      response(Buffer.from('bad'))
      expect((await service.fetch('https://npmjs.com')).state).toBe('failed')
      expect((await service.fetch('https://npmjs.com')).state).toBe('failed')
      expect(requestMock).toHaveBeenCalledTimes(2)
      response(png)
      expect((await service.fetch('https://npmjs.com', true)).state).toBe('ready')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('favicon缓存生命周期', () => {
  let root: string
  let service: SubscriptionFaviconService
  let png: Buffer
  beforeEach(async () => {
    await mkdir(artifactRoot, { recursive: true })
    root = await mkdtemp(join(artifactRoot, 'subscription-favicon-'))
    service = new SubscriptionFaviconService(new ConfigService({ MEDIA_DIRECTORY: root, NODE_ENV: 'test' }))
    png = await createPng()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })
  it('测试环境必须显式配置独立媒体目录', () => {
    expect(() => new SubscriptionFaviconService(new ConfigService({ NODE_ENV: 'test' }))).toThrow('独立媒体目录')
  })
  it.each(['../secret', 'a'.repeat(64), `${'A'.repeat(64)}.webp`, `${'a'.repeat(64)}.png`])(
    '读取接口拒绝非法缓存键 %s',
    async (key) => {
      await expect(service.read(key)).rejects.toBeInstanceOf(NotFoundException)
      expect(requestMock).not.toHaveBeenCalled()
    },
  )
  it('不存在的缓存返回404且不会触发下载', async () => {
    await expect(service.read(`${faviconKey('github.com')}.webp`)).rejects.toBeInstanceOf(NotFoundException)
    expect(lookupMock).not.toHaveBeenCalled()
    expect(requestMock).not.toHaveBeenCalled()
  })
  it('读取时保留非文件不存在的存储异常', async () => {
    const key = `${faviconKey('github.com')}.webp`
    await mkdir(join(root, '.subscription-favicons', key), { recursive: true })
    await expect(service.read(key)).rejects.toMatchObject({ code: 'EISDIR' })
  })
  it('规范化后的相同域名合并并发下载，force也复用正在处理的请求', async () => {
    response(png)
    const results = await Promise.all([
      service.fetch('https://github.com/path?private=1'),
      service.fetch('https://GITHUB.COM/another'),
      service.fetch('https://github.com', true),
    ])
    expect(results).toEqual(
      Array.from({ length: 3 }, () => ({ domain: 'github.com', state: 'ready', faviconUrl: faviconUrl('github.com') })),
    )
    expect(lookupMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0]![0]).toMatchObject({ path: providerPath('github.com') })
    expect(await readdir(join(root, '.subscription-favicons'))).toEqual([`${faviconKey('github.com')}.webp`])
  })
  it('成功缓存七天内复用，到期后重新抓取', async () => {
    response(png)
    await service.fetch('https://github.com')
    const modified = (await stat(join(root, '.subscription-favicons', `${faviconKey('github.com')}.webp`))).mtimeMs
    const now = jest.spyOn(Date, 'now').mockReturnValue(modified + 7 * 24 * 60 * 60 * 1000 - 1)
    await service.fetch('https://github.com')
    expect(requestMock).toHaveBeenCalledTimes(1)
    now.mockReturnValue(modified + 7 * 24 * 60 * 60 * 1000)
    expect((await service.fetch('https://github.com')).state).toBe('ready')
    expect(requestMock).toHaveBeenCalledTimes(2)
  })
  it('失败缓存按域名隔离，五分钟到期后可重新下载', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    response(Buffer.from('bad'))
    const failed = { domain: 'github.com', state: 'failed', faviconUrl: null }
    await expect(service.fetch('https://github.com')).resolves.toEqual(failed)
    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 - 1)
    await expect(service.fetch('https://github.com')).resolves.toEqual(failed)
    expect(requestMock).toHaveBeenCalledTimes(1)
    response(png)
    expect((await service.fetch('https://npmjs.com')).state).toBe('ready')
    expect(requestMock).toHaveBeenCalledTimes(2)
    now.mockReturnValue(1_000_000 + 5 * 60 * 1000)
    expect((await service.fetch('https://github.com')).state).toBe('ready')
    expect(requestMock).toHaveBeenCalledTimes(3)
  })
  it('强制刷新失败保留原有成功缓存，随后强制重试可恢复', async () => {
    response(png)
    await service.fetch('https://github.com')
    const key = `${faviconKey('github.com')}.webp`
    const cached = await service.read(key)
    response(Buffer.from('bad'))
    await expect(service.fetch('https://github.com', true)).resolves.toEqual({
      domain: 'github.com',
      state: 'ready',
      faviconUrl: faviconUrl('github.com'),
    })
    await expect(service.read(key)).resolves.toEqual(cached)
    response(png)
    expect((await service.fetch('https://github.com', true)).state).toBe('ready')
    expect(requestMock).toHaveBeenCalledTimes(3)
    expect(await readdir(join(root, '.subscription-favicons'))).toEqual([key])
  })
  it('失败的并发下载会释放处理中状态，强制重试可重新执行', async () => {
    response(Buffer.from('bad'))
    const results = await Promise.all([service.fetch('https://github.com'), service.fetch('https://github.com')])
    expect(results.map((result) => result.state)).toEqual(['failed', 'failed'])
    expect(requestMock).toHaveBeenCalledTimes(1)
    response(png)
    expect((await service.fetch('https://github.com', true)).state).toBe('ready')
    expect(requestMock).toHaveBeenCalledTimes(2)
  })
})
