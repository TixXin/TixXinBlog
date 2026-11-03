/** @file og.controller.spec.ts @description 分享卡片地址白名单、ETag/304 与 HEAD 响应 */
import { NotFoundException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { OgController, parseOgRequest } from './og.controller'
import type { OgService } from './og.service'

describe('分享卡片地址解析', () => {
  it.each([
    [['nexus', 'zh-CN'], { theme: 'nexus', locale: 'zh-CN' }],
    [['aurora', 'en', 'post', '12.png'], { theme: 'aurora', locale: 'en', kind: 'post', id: '12' }],
    [
      ['dock', 'zh-CN', 'flash', '0c5d3f8e-1b2a-4c3d-9e8f-001122334455.png'],
      { theme: 'dock', locale: 'zh-CN', kind: 'flash', id: '0c5d3f8e-1b2a-4c3d-9e8f-001122334455' },
    ],
    [
      ['nexus', 'en', 'moment', 'legacy_id-01.png'],
      { theme: 'nexus', locale: 'en', kind: 'moment', id: 'legacy_id-01' },
    ],
  ])('合法地址 %j', (args, expected) => {
    expect(parseOgRequest(...(args as [string, string, string?, string?]))).toEqual(expected)
  })

  it.each([
    ['未登记主题', ['retro', 'zh-CN']],
    ['未支持语言', ['nexus', 'ja']],
    ['未知类型', ['nexus', 'zh-CN', 'gallery', '1.png']],
    ['非 png 后缀', ['nexus', 'zh-CN', 'post', '1.jpg']],
    ['文章编号为 0', ['nexus', 'zh-CN', 'post', '0.png']],
    ['文章编号非数字', ['nexus', 'zh-CN', 'post', 'abc.png']],
    ['文章编号超出整数范围', ['nexus', 'zh-CN', 'post', '9999999999.png']],
    ['闪念编号含路径字符', ['nexus', 'zh-CN', 'flash', '..%2Fx.png']],
    ['朋友圈编号过长', ['nexus', 'zh-CN', 'moment', 'a'.repeat(65) + '.png']],
  ])('%s 返回 404', (_, args) => {
    expect(() => parseOgRequest(...(args as [string, string, string?, string?]))).toThrow(NotFoundException)
  })
})

describe('分享卡片响应', () => {
  const png = Buffer.from('png-bytes')
  function setup(ifNoneMatch?: string, method = 'GET') {
    const card = jest.fn().mockResolvedValue({ etag: '"og-abc"', png })
    const controller = new OgController({ card } as unknown as OgService)
    const request = { method, get: (name: string) => (name === 'if-none-match' ? ifNoneMatch : undefined) }
    const response = {
      headers: {} as Record<string, unknown>,
      statusCode: 200,
      body: undefined as unknown,
      setHeader(name: string, value: unknown) {
        this.headers[name] = value
        return this
      },
      status(code: number) {
        this.statusCode = code
        return this
      },
      type(value: string) {
        this.headers['Content-Type'] = value
        return this
      },
      end: jest.fn(),
      send(body: unknown) {
        this.body = body
        return this
      },
    }
    return { controller, card, request: request as unknown as Request, response, res: response as unknown as Response }
  }

  it('返回 PNG 与缓存头', async () => {
    const { controller, card, request, response, res } = setup()
    await controller.content({ theme: 'nexus', lang: 'zh-CN', kind: 'post', file: '3.png' }, request, res)
    expect(card).toHaveBeenCalledWith({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: '3' })
    expect(response.headers).toMatchObject({
      'Cache-Control': 'public, max-age=86400',
      ETag: '"og-abc"',
      'Content-Type': 'image/png',
    })
    expect(response.body).toBe(png)
  })

  it('If-None-Match 命中时返回 304，不发送图片', async () => {
    const { controller, request, response, res } = setup('W/"og-abc", "other"')
    await controller.site({ theme: 'aurora', lang: 'en', file: 'site.png' }, request, res)
    expect(response.statusCode).toBe(304)
    expect(response.body).toBeUndefined()
  })

  it('HEAD 只返回长度', async () => {
    const { controller, request, response, res } = setup(undefined, 'HEAD')
    await controller.site({ theme: 'nexus', lang: 'zh-CN', file: 'site.png' }, request, res)
    expect(response.headers['Content-Length']).toBe(png.length)
    expect(response.body).toBeUndefined()
    expect(response.end).toHaveBeenCalled()
  })

  it('站点卡只接受 site.png', async () => {
    const { controller, card, request, res } = setup()
    expect(() => controller.site({ theme: 'nexus', lang: 'zh-CN', file: 'index.png' }, request, res)).toThrow(
      NotFoundException,
    )
    expect(card).not.toHaveBeenCalled()
  })
})
