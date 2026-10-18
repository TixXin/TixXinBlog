/** @file post-preview.controller.spec.ts @description 使用隔离 HTTP 与内存服务替身校验预览路由、管理鉴权和错误响应安全头，不连接数据库。 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { configureApplication } from '../../bootstrap'
import { EntityManager as EntityManagerToken } from '@mikro-orm/postgresql'
import { AdminSession } from '../../entities/admin-session.entity'
import { ContentContext } from '../../entities/content-context.entity'
import { AdminPostController } from './admin-post.controller'
import { AdminPostService } from './admin-post.service'
import { PostBatchService } from './post-batch.service'
import { PostController } from './post.controller'
import { PostDiscoveryService } from './post-discovery.service'
import { PostPreviewService } from './post-preview.service'
import { PostRevisionsService } from './post-revisions.service'
import { PostService } from './post.service'

describe('草稿预览 HTTP 契约', () => {
  let app: INestApplication
  let origin: string
  const generation = '24930d9a-932f-45a2-9d0e-640b914f592a'
  const sessionId = 'd67fc2a6-6269-41c0-8e5c-0cdbd105e946'
  const userId = 'a6247260-01d9-49c7-bae4-0c8f9ba0be01'
  const previews = {
    issue: jest.fn(async () => ({ token: 'signed-preview-token', expiresAt: '2026-10-25T08:00:00.000Z' })),
    read: jest.fn(async (token: unknown) => {
      if (token !== 'signed-preview-token') throw new NotFoundException('预览链接无效或已过期')
      return { id: '7', title: '草稿', contentRaw: '正文', seoNoindex: true, commentEnabled: false }
    }),
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PostController, AdminPostController],
      providers: [
        { provide: ConfigService, useValue: new ConfigService({ TRUSTED_PROXY_CIDRS: '' }) },
        { provide: PostPreviewService, useValue: previews },
        ...[PostService, PostDiscoveryService, AdminPostService, PostRevisionsService, PostBatchService].map(
          (provide) => ({ provide, useValue: {} }),
        ),
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn(async () => ({ sub: userId, sid: sessionId, version: 1 })) },
        },
        {
          provide: EntityManagerToken,
          useValue: {
            findOne: jest.fn(async (entity: unknown) =>
              entity === AdminSession
                ? {
                    id: sessionId,
                    adminUser: { id: userId, username: 'owner', sessionVersion: 1 },
                  }
                : null,
            ),
            findOneOrFail: jest.fn(async (entity: unknown) => {
              if (entity === ContentContext) return { generation, requireContext: true }
              throw new Error('不应读取其他实体')
            }),
          } as unknown as EntityManager,
        },
      ],
    }).compile()
    app = module.createNestApplication({ logger: false })
    configureApplication(app)
    await app.listen(0, '127.0.0.1')
    origin = await app.getUrl()
  })

  afterAll(async () => app?.close())
  beforeEach(() => jest.clearAllMocks())

  function expectPrivateHeaders(response: Response) {
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  }

  it('匿名 GET 命中 preview 静态路由，成功和失效响应都禁止缓存和索引', async () => {
    for (const [query, status] of [
      ['?token=signed-preview-token', 200],
      ['?token=expired', 404],
      ['', 404],
      ['?token=one&token=two', 404],
    ] as const) {
      const response = await fetch(`${origin}/api/v1/posts/preview${query}`)
      expect(response.status).toBe(status)
      expectPrivateHeaders(response)
      const body = (await response.json()) as { data: unknown }
      expect(body.data).toEqual(
        status === 200 ? { id: '7', title: '草稿', contentRaw: '正文', seoNoindex: true, commentEnabled: false } : null,
      )
    }
  })

  it('签发需要管理员身份与当前内容上下文，守卫和参数失败保留安全头', async () => {
    for (const [id, headers, status] of [
      ['7', {}, 401],
      ['7', { authorization: 'Bearer fixture' }, 428],
      ['7', { authorization: 'Bearer fixture', 'x-content-context': 'old-generation' }, 409],
      ['invalid', { authorization: 'Bearer fixture', 'x-content-context': generation }, 400],
      ['7', { authorization: 'Bearer fixture', 'x-content-context': generation }, 201],
    ] as const) {
      const response = await fetch(`${origin}/api/v1/admin/posts/${id}/preview-link`, { method: 'POST', headers })
      expect(response.status).toBe(status)
      expectPrivateHeaders(response)
      await response.text()
    }
    expect(previews.issue).toHaveBeenCalledTimes(1)
    expect(previews.issue).toHaveBeenCalledWith(7)
  })
})
