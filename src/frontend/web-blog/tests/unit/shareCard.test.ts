/** @file shareCard.test.ts @description 分享卡片地址：路径与后端白名单一致、版本号随内容变化；页面缺图时改用卡片，全站兜底为站点卡 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { isShareCardId, shareCardUrl } from '../../app/utils/shareCard'

const site = 'https://blog.example.com'

describe('分享卡片地址', () => {
  it('站点卡与三类内容卡的路径', () => {
    const base = { site, theme: 'aurora', locale: 'en', version: [] }
    expect(shareCardUrl(base)).toMatch(
      /^https:\/\/blog\.example\.com\/api\/v1\/og\/aurora\/en\/site\.png\?v=[0-9a-z]+$/,
    )
    expect(shareCardUrl({ ...base, kind: 'post', id: 12 })).toContain('/api/v1/og/aurora/en/post/12.png?v=')
    expect(shareCardUrl({ ...base, kind: 'flash', id: 'a1-b_2' })).toContain('/og/aurora/en/flash/a1-b_2.png?v=')
    expect(shareCardUrl({ ...base, kind: 'moment', id: 'm-1' })).toContain('/og/aurora/en/moment/m-1.png?v=')
  })

  it('未登记的主题与语言回退 nexus 与中文', () => {
    expect(shareCardUrl({ site, theme: 'retro', locale: 'ja', version: [] })).toContain('/og/nexus/zh-CN/site.png')
  })

  it.each([
    ['post', 0],
    ['post', '12a'],
    ['post', 9999999999],
    ['flash', 'a/b'],
    ['moment', 'x'.repeat(65)],
    ['flash', undefined],
  ] as const)('不合规的编号 %s/%s 不生成卡片地址', (kind, id) => {
    expect(isShareCardId(kind, id)).toBe(false)
    expect(shareCardUrl({ site, theme: 'nexus', locale: 'zh-CN', kind, id, version: [] })).toBeUndefined()
  })

  it('卡片内容、主题或语言变化时版本号变化，相同内容版本号稳定', () => {
    const card = (title: string, theme = 'nexus', locale = 'zh-CN') =>
      shareCardUrl({ site, theme, locale, kind: 'post', id: 3, version: [title, '2026-11-03'] })
    expect(card('标题')).toBe(card('标题'))
    expect(card('标题')).not.toBe(card('新标题'))
    expect(new URL(card('标题')!).searchParams.get('v')).not.toBe(new URL(card('标题', 'dock')!).searchParams.get('v'))
    expect(new URL(card('标题')!).searchParams.get('v')).not.toBe(
      new URL(card('标题', 'nexus', 'en')!).searchParams.get('v'),
    )
  })
})

describe('页面分享图取用顺序', () => {
  const wrappers: { unmount(): void }[] = []
  afterEach(async () => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    await flushPromises()
  })

  async function mountSeo(options: Parameters<typeof usePageSeo>[0]) {
    wrappers.push(
      await mountSuspended(
        defineComponent({
          setup() {
            usePageSeo(options)
            return () => h('div')
          },
        }),
      ),
    )
  }
  const meta = (selector: string) => document.querySelector(selector)?.getAttribute('content')

  it('有封面用封面，缺图时改用分享卡片，并输出大图卡片', async () => {
    await mountSeo({ title: '有封面', image: () => '/cover.webp', fallbackImage: () => `${site}/api/v1/og/a.png` })
    await vi.waitFor(() => expect(meta('meta[property="og:image"]')).toMatch(/\/cover\.webp$/))
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    await mountSeo({ title: '无封面', image: () => undefined, fallbackImage: () => `${site}/api/v1/og/a.png` })
    await vi.waitFor(() => expect(meta('meta[property="og:image"]')).toBe(`${site}/api/v1/og/a.png`))
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
  })

  it('方形头像可指定小卡片；SVG 不作为分享图', async () => {
    await mountSeo({ title: '关于', image: () => '/avatar.png', imageCard: 'summary' })
    await vi.waitFor(() => expect(meta('meta[name="twitter:card"]')).toBe('summary'))
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    await mountSeo({ title: '关于', image: () => '/avatar.svg', fallbackImage: () => undefined })
    await flushPromises()
    expect(meta('meta[property="og:image"]') ?? '').not.toMatch(/avatar\.svg/)
  })

  it('内容卡在演示数据模式下不生成，站点卡始终可用', async () => {
    let cards!: ReturnType<typeof useShareCard>
    wrappers.push(
      await mountSuspended(
        defineComponent({
          setup() {
            cards = useShareCard()
            return () => h('div')
          },
        }),
      ),
    )
    const config = useRuntimeConfig()
    expect(cards.siteCard()).toMatch(/\/api\/v1\/og\/nexus\/zh-CN\/site\.png\?v=/)
    const mock = config.public.postUseMockRepo
    config.public.postUseMockRepo = true
    expect(cards.contentCard('post', 5, ['标题'])).toBeUndefined()
    config.public.postUseMockRepo = false
    expect(cards.contentCard('post', 5, ['标题'])).toContain('/api/v1/og/nexus/zh-CN/post/5.png?v=')
    config.public.postUseMockRepo = mock
  })
})
