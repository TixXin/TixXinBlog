/** @file subscription-favicon.spec.ts @description 固定供应商图标代理的DNS、实际图片、缓存和失败边界 */
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
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
function response(bytes: Buffer, statusCode = 200, contentType = 'image/png') {
  requestMock.mockImplementation((_options: unknown, callback: unknown) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void }
    req.end = () => {
      const res = new EventEmitter() as EventEmitter & {
        statusCode: number
        headers: object
        destroy: (error?: Error) => void
      }
      res.statusCode = statusCode
      res.headers = { 'content-type': contentType }
      res.destroy = (error) => {
        if (error) res.emit('error', error)
      }
      ;(callback as (res: unknown) => void)(res)
      if (statusCode === 200 && contentType.startsWith('image/')) {
        res.emit('data', bytes)
        res.emit('end')
      }
    }
    return req as never
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never)
})
describe('favicon代理边界', () => {
  it.each([
    '127.0.0.1',
    '10.1.1.1',
    '100.64.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '192.0.2.1',
    '198.18.1.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.1.1.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
    '2001:0db8:0000:0000:0000:0000:0000:0001',
    '2002:7f00:1::1',
  ])('拒绝保留地址 %s', (address) => {
    expect(publicAddress(address)).toBe(false)
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
  it('重定向和超大响应立即拒绝', async () => {
    response(Buffer.from(''), 302)
    await expect(downloadFavicon('github.com')).rejects.toThrow()
    response(Buffer.alloc(256 * 1024 + 1))
    await expect(downloadFavicon('github.com')).rejects.toThrow('体积过大')
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
  it('成功缓存供只读接口复用，失败缓存减少重试，force可显式恢复', async () => {
    const root = await mkdtemp(join(tmpdir(), 'subscription-favicon-'))
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
