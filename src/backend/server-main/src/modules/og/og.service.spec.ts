/** @file og.service.spec.ts @description 分享卡片数据：公开详情可见性、站点卡内容、受管头像与外链头像、渲染缓存 */
import { NotFoundException } from '@nestjs/common'
import type { MediaService } from '../media/media.service'
import type { SiteSettingsService } from '../site/site-settings.service'
import type { FlashService } from '../flash/flash.service'
import type { MomentReadService } from '../moment/moment-read.service'
import type { PostService } from '../post/post.service'
import { OgContentService } from './og-content.service'
import { renderOgCard } from './og-render'
import { OG_CACHE_LIMIT, OgService } from './og.service'

jest.mock('./og-render', () => ({ renderOgCard: jest.fn(async () => Buffer.from('png')) }))
const render = renderOgCard as jest.MockedFunction<typeof renderOgCard>

const settings = { name: '示例博客', description: '记录\n技术与生活', ownerName: '博主', avatar: '' }
const avatarId = '0c5d3f8e-1b2a-4c3d-9e8f-001122334455'

function setup(overrides: { avatar?: string; post?: unknown } = {}) {
  const posts = {
    findDetail: jest.fn(async () => {
      if (overrides.post === null) throw new NotFoundException()
      return { title: '静态发布\n实践', date: '2026-11-03T02:00:00.000Z' }
    }),
  }
  const flashes = {
    findOne: jest.fn(async () => ({ content: '## 闪念\n今天把**搜索**补上了', createdAt: '2026-11-02T03:00:00.000Z' })),
  }
  const moments = { detail: jest.fn(async () => ({ content: '江边散步', date: '2026-10-30T10:00:00.000Z' })) }
  const site = { get: jest.fn(async () => ({ ...settings, avatar: overrides.avatar ?? '' })) }
  const media = { read: jest.fn(async () => ({ etag: '"sha-w320"', content: Buffer.from('avatar') })) }
  const contents = new OgContentService(
    posts as unknown as PostService,
    flashes as unknown as FlashService,
    moments as unknown as MomentReadService,
  )
  const service = new OgService(contents, site as unknown as SiteSettingsService, media as unknown as MediaService)
  return { service, posts, flashes, moments, site, media }
}

describe('分享卡片数据', () => {
  beforeEach(() => render.mockClear())

  it('站点卡：站点名、简介与博主名，不显示类型标签和日期', async () => {
    const { service } = setup()
    const result = await service.card({ theme: 'aurora', locale: 'en' })
    expect(result.etag).toMatch(/^"og-[0-9a-f]{32}"$/)
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'aurora',
        headline: '示例博客',
        body: '记录 技术与生活',
        name: '博主',
        initial: '博',
      }),
    )
    expect(render.mock.calls[0]![0]).not.toHaveProperty('label')
    expect(render.mock.calls[0]![0].date).toBeUndefined()
  })

  it('文章卡经公开详情读取标题，类型标签按地址语言输出', async () => {
    const { service, posts } = setup()
    await service.card({ theme: 'nexus', locale: 'en', kind: 'post', id: '7' })
    expect(posts.findDetail).toHaveBeenCalledWith(7)
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Post', headline: '静态发布 实践', headlineSize: 64, name: '示例博客' }),
    )
    expect(render.mock.calls[0]![0].date).toMatch(/^2026-11-0[23]$/)
  })

  it('闪念与朋友圈取去掉 Markdown 的正文', async () => {
    const { service, flashes, moments } = setup()
    await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'flash', id: 'abc' })
    await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'moment', id: 'def' })
    expect(flashes.findOne).toHaveBeenCalledWith('abc')
    expect(moments.detail).toHaveBeenCalledWith('def')
    expect(render.mock.calls[0]![0]).toMatchObject({
      label: '闪念',
      headline: '闪念 今天把搜索补上了',
      headlineSize: 44,
    })
    expect(render.mock.calls[1]![0]).toMatchObject({ label: '朋友圈', headline: '江边散步' })
  })

  it('草稿、删除或不公开的内容沿用公开详情的 404，不渲染', async () => {
    const { service } = setup({ post: null })
    await expect(service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: '9' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(render).not.toHaveBeenCalled()
  })

  it('受管头像读取 320 宽变体，头像变化时卡片 ETag 随之变化', async () => {
    const { service, media } = setup({ avatar: `/api/v1/media/${avatarId}.webp` })
    const first = await service.card({ theme: 'nexus', locale: 'zh-CN' })
    expect(media.read).toHaveBeenCalledWith(avatarId, { width: 320 })
    expect(render.mock.calls[0]![0].avatar).toEqual(Buffer.from('avatar'))
    media.read.mockResolvedValueOnce({ etag: '"other-w320"', content: Buffer.from('avatar-2') })
    expect((await service.card({ theme: 'nexus', locale: 'zh-CN' })).etag).not.toBe(first.etag)
  })

  it.each(['https://cravatar.cn/avatar/abc', '/avatar.svg', 'data:image/png;base64,AAAA'])(
    '外链或非受管头像 %s 改用首字母，不读取媒体也不发起网络请求',
    async (avatar) => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const { service, media } = setup({ avatar })
      await service.card({ theme: 'nexus', locale: 'zh-CN' })
      expect(media.read).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(render.mock.calls[0]![0].avatar).toBeUndefined()
      fetchSpy.mockRestore()
    },
  )

  it('受管头像不可读时退回首字母头像', async () => {
    const { service, media } = setup({ avatar: `/api/v1/media/${avatarId}.webp` })
    media.read.mockRejectedValueOnce(new Error('missing'))
    await service.card({ theme: 'nexus', locale: 'zh-CN' })
    expect(render.mock.calls[0]![0].avatar).toBeUndefined()
  })

  it('同样的渲染输入只渲染一次，超过上限时淘汰最早的结果', async () => {
    const { service, posts } = setup()
    await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: '1' })
    await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: '1' })
    expect(render).toHaveBeenCalledTimes(1)
    for (let index = 0; index < OG_CACHE_LIMIT; index++) {
      posts.findDetail.mockResolvedValueOnce({ title: `标题 ${index}`, date: '2026-11-03T02:00:00.000Z' })
      await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: String(index + 2) })
    }
    await service.card({ theme: 'nexus', locale: 'zh-CN', kind: 'post', id: '1' })
    expect(render).toHaveBeenCalledTimes(OG_CACHE_LIMIT + 2)
  })
})
