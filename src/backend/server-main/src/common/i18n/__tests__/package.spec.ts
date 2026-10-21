/**
 * @file package.spec.ts
 * @description 内容包解析与结构校验的异常按 Accept-Language 输出英文，默认中文与 HTTP 状态保持不变
 * @author TixXin
 * @since 2026-10-19
 */
import 'reflect-metadata'
import { BadRequestException, HttpException, Logger, PayloadTooLargeException } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MESSAGES } from '../messages'
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter'
import { translate, translateStored, type LocalizedMessage } from '..'
import { parseContentPackage } from '../../../modules/backup/content-package'

const bundle = () => ({
  format: 'tixxin-content',
  version: 14,
  omittedRelations: 0,
  exportedAt: '2026-10-01T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [],
  moments: [],
  guestbook: [],
  gallery: [],
  projects: [],
  links: [],
  prompts: [],
  subscriptions: [],
  linkSettings: { rules: [] },
  gallerySettings: { gear: [] },
  folders: [],
  tags: [],
  media: [],
  requireCommentApproval: false,
  site: {
    name: '山间札记',
    description: '',
    ownerName: '林间',
    ownerTitle: '',
    avatar: '',
    avatarAlt: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    socials: [],
  },
})

async function rejected(input: unknown): Promise<HttpException> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input))
  try {
    await parseContentPackage(buffer)
  } catch (error) {
    return error as HttpException
  }
  throw new Error('预期抛出异常')
}

function render(exception: unknown, headers: Record<string, string> = {}) {
  const sent: { status?: number; body?: Record<string, unknown> } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: Record<string, unknown>) {
      sent.body = body
    },
  }
  const request = { method: 'POST', path: '/api/v1/admin/backup/content-imports', headers }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return sent
}

const english = (error: HttpException) => {
  const body = error.getResponse() as LocalizedMessage
  return translate('en', body.messageKey, body.messageParams)
}

describe('内容包校验的英文异常', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('非法 JSON：中文不变，过滤器按 en 输出英文', async () => {
    const error = await rejected(Buffer.from([0xff, 0xfe]))
    expect(error).toBeInstanceOf(BadRequestException)
    expect(error.message).toBe('请选择有效的 UTF-8 JSON 内容包')
    expect(render(error, { 'accept-language': 'en' })).toMatchObject({
      status: 400,
      body: { message: 'Choose a valid UTF-8 JSON content package.' },
    })
    expect(render(error).body).toMatchObject({ message: '请选择有效的 UTF-8 JSON 内容包' })
  })

  it('超限仍为 413，英文可读', async () => {
    const error = await rejected(Buffer.alloc(0))
    expect(error).toBeInstanceOf(PayloadTooLargeException)
    expect(error.message).toBe('内容包不能超过 50MB；较大站点请使用完整维护备份')
    expect(english(error)).toBe('Content packages cannot exceed 50MB. For larger sites, use a full maintenance backup.')
  })

  it('字段路径作为参数插值', async () => {
    const error = await rejected({ ...bundle(), posts: Array(1001).fill(null) })
    expect(error.message).toBe('内容包字段不合法：posts')
    expect(error.getResponse()).toMatchObject({ messageKey: 'package.invalidField', messageParams: { path: 'posts' } })
    expect(english(error)).toBe('Invalid content package field: posts')
  })

  it('中文字段名拆为独立条目，不作为参数传入', async () => {
    const error = await rejected({ ...bundle(), version: 8, omittedRelations: undefined })
    expect(error.message).toBe('内容包字段不合法：v1–v9 不支持图片提示词')
    expect(error.getResponse()).toEqual({
      message: '内容包字段不合法：v1–v9 不支持图片提示词',
      messageKey: 'package.fieldV9Prompts',
    })
    expect(english(error)).toBe('Invalid content package field: v1–v9 do not support image prompts')
  })

  it('订阅编号非法：路径参数与中文后缀分离', async () => {
    const error = await rejected({
      ...bundle(),
      subscriptions: [{ sourceId: 0, createdAt: '', publishedAt: null, deleted: false, values: {} }],
    })
    expect(error.message).toBe('内容包字段不合法：subscriptions[0].重复或非法编号')
    expect(english(error)).toBe('Invalid content package field: subscriptions[0] (duplicate or invalid ID)')
  })

  it('被其他模块记录的中文可反查为英文', () => {
    expect(translateStored('en', '内容包字段不合法：媒体解码')).toBe('Invalid content package field: media decoding')
    expect(translateStored('en', '内容包字段不合法：links[2].图片来源互斥')).toBe(
      'Invalid content package field: links[2] (media and external image are mutually exclusive)',
    )
    expect(translateStored('en', '内容包字段不合法：gallery[0].takenOn')).toBe(
      'Invalid content package field: gallery[0].takenOn',
    )
  })

  it('源码引用的 package.field* 条目全部登记在字典中', () => {
    const root = join(__dirname, '../../../modules/backup')
    const files = readdirSync(root).filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.types.ts') &&
        !file.includes('__tests__'),
    )
    const keys = files.flatMap((file) => [...readFileSync(join(root, file), 'utf8').matchAll(/'(package\.field\w+)'/g)])
    expect(keys.length).toBeGreaterThan(90)
    for (const [, key] of keys) expect([key, Object.hasOwn(MESSAGES, key!)]).toEqual([key, true])
  })
})
