/** @file siteNavigation.test.ts @description 站点导航、页脚链接、每日一言与备案字段：缺省等价、显隐排序、展示转换、即时校验与旧恢复副本兼容 */
import { afterEach, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { SITE_NAV_KEYS, buildNavItems, defaultNavigation, navRouteCatalog } from '../../app/features/nav/routes'
import {
  DEFAULT_ICP_URL,
  buildFooterLinks,
  defaultFooterLinks,
  formatCopyright,
  pickQuote,
} from '../../app/features/site/footer'
import { siteExtrasErrors } from '../../app/features/site/extras'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { SiteSettingsData } from '../../app/features/site/settings'
import { normalizeSiteSettings, parseSiteSettingsRecovery } from '../../app/features/site/editor'
import { useNavItems } from '../../app/composables/useNavItems'
import { useSiteInfo } from '../../app/composables/useSiteInfo'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

/** 此前写死在 nav/mock.ts 的导航，用于核对缺省值升级后外观不变 */
const previousNav = [
  ['lucide:home', '主页', '/'],
  ['lucide:archive', '归档', '/archive'],
  ['lucide:layers', '项目', '/projects'],
  ['lucide:image', '画廊', '/gallery'],
  ['lucide:zap', '闪念', '/flash'],
  ['lucide:link', '友链', '/links'],
  ['lucide:message-circle', '留言', '/guestbook'],
  ['lucide:credit-card', '平台订阅费', '/subscriptions'],
  ['lucide:user', '关于', '/about'],
  ['lucide:aperture', '提示词', '/prompts'],
  ['lucide:layout-grid', '标签页', '/tabs'],
]

it('缺省导航与此前写死的 11 项完全一致，友链仍仅桌面显示', () => {
  for (const items of [buildNavItems(undefined), buildNavItems(defaultNavigation())]) {
    expect(items.map((item) => [item.icon, item.label, item.to])).toEqual(previousNav)
    expect(items.filter((item) => item.desktopOnly).map((item) => item.to)).toEqual(['/links'])
  }
})

it('隐藏模块从导航消失，按配置排序，外链带新窗口标记，首页不能被隐藏', () => {
  const items = buildNavItems([
    { type: 'route', key: 'about', visible: true },
    { type: 'external', label: '旧博客', url: 'https://old.example.com/', newTab: true, visible: true },
    { type: 'external', label: '隐藏外链', url: 'https://hidden.example.com/', newTab: false, visible: false },
    { type: 'external', label: '危险', url: 'javascript:alert(1)', newTab: false, visible: true },
    { type: 'route', key: 'home', visible: false },
    { type: 'route', key: 'subscriptions', visible: false },
    { type: 'route', key: 'prompts', visible: false },
    { type: 'route', key: 'tabs', visible: false },
  ])
  expect(items.slice(0, 3).map((item) => item.label)).toEqual(['关于', '旧博客', '主页'])
  expect(items[1]).toMatchObject({ to: 'https://old.example.com/', external: true, newTab: true })
  const labels = items.map((item) => item.label)
  for (const hidden of ['平台订阅费', '提示词', '标签页', '隐藏外链', '危险']) expect(labels).not.toContain(hidden)
  // 未出现在配置中的内置模块按显示追加
  expect(labels).toContain('归档')
  expect(items).toHaveLength(SITE_NAV_KEYS.length - 3 + 1)
})

it('导航与页脚组合函数读取站点设置，SSR 状态变化后同步更新', async () => {
  let nav!: ReturnType<typeof useNavItems>
  let info!: ReturnType<typeof useSiteInfo>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        nav = useNavItems()
        info = useSiteInfo()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  const { settings } = useSiteSettings()
  const original = structuredClone(toRaw(settings.value))
  try {
    expect(nav.navItems.value.map((item) => item.to)).toEqual(previousNav.map((item) => item[2]))
    expect(info.footerLinks.value.map((link) => link.label)).toEqual(['关于本站', 'RSS 订阅', '站点地图'])
    expect(info.copyrightText.value).toBe(`© ${new Date().getFullYear()} ${settings.value.name}. All rights reserved.`)
    expect(info.icp.value).toBeNull()
    expect(info.ownerCard.value.quotes).toContain(info.dailyQuote.value)
    settings.value = {
      ...settings.value,
      navigation: [
        { type: 'route', key: 'home', visible: true },
        { type: 'route', key: 'subscriptions', visible: false },
        { type: 'route', key: 'flash', visible: false },
      ],
      footerLinks: [{ label: '源码', url: 'https://example.com/repo', newTab: false }],
      quotes: ['唯一的一言'],
      icpNumber: '京ICP备00000000号',
      icpUrl: '',
      copyright: '{siteName} © {year}',
    }
    expect(nav.navItems.value.map((item) => item.to)).not.toContain('/subscriptions')
    expect(nav.mobileNavItems.value.map((item) => item.to)).not.toContain('/flash')
    expect(info.footerLinks.value).toEqual([
      { label: '源码', href: 'https://example.com/repo', external: true, newTab: false },
    ])
    expect(info.icp.value).toEqual({ number: '京ICP备00000000号', href: DEFAULT_ICP_URL })
    expect(info.copyrightText.value).toBe(`${settings.value.name} © ${new Date().getFullYear()}`)
    expect(info.ownerCard.value.quotes).toEqual(['唯一的一言'])
  } finally {
    settings.value = original
  }
})

it('页脚链接：站内页面走路由，服务端文件与站外地址走原生链接，缺省等于此前写死的三项', () => {
  expect(buildFooterLinks(undefined)).toEqual([
    { label: '关于本站', href: '/about', external: false, newTab: false },
    { label: 'RSS 订阅', href: '/rss.xml', external: true, newTab: true },
    { label: '站点地图', href: '/sitemap.xml', external: true, newTab: true },
  ])
  expect(buildFooterLinks([{ label: '订阅', url: '/moments.xml?x=1', newTab: false }])[0]?.external).toBe(true)
  expect(buildFooterLinks([{ label: '归档', url: '/archive', newTab: false }])[0]?.external).toBe(false)
  expect(buildFooterLinks([])).toEqual([])
})

it('版权文案留空用默认格式，自定义文案替换占位符；一言列表为空时返回空串', () => {
  expect(formatCopyright('', 2026, '山间札记')).toBe('© 2026 山间札记. All rights reserved.')
  expect(formatCopyright('  ', 2026, '山间札记')).toBe('© 2026 山间札记. All rights reserved.')
  expect(formatCopyright('© {year} {siteName} 保留所有权利', 2026, '山间札记')).toBe('© 2026 山间札记 保留所有权利')
  expect(pickQuote([])).toBe('')
  expect(pickQuote(['a', 'b'], () => 0.99)).toBe('b')
})

it('即时校验与服务端规则一致：外链协议、页脚路径、重复与上限', () => {
  const value = {
    ...structuredClone(defaultSiteSettings),
    navigation: [
      ...defaultNavigation(),
      { type: 'external' as const, label: '', url: 'javascript:alert(1)', newTab: false, visible: true },
      { type: 'external' as const, label: '甲', url: 'https://a.example', newTab: false, visible: true },
      { type: 'external' as const, label: '乙', url: 'https://a.example', newTab: false, visible: true },
    ],
    footerLinks: [
      { label: '外站', url: '//evil.example', newTab: false },
      { label: '关于', url: '/about', newTab: false },
      { label: '又是关于', url: '/about', newTab: true },
    ],
    quotes: ['一', ' 一 ', ''],
    icpUrl: 'beian.miit.gov.cn',
  }
  const errors = siteExtrasErrors(value)
  expect(Object.keys(errors).sort()).toEqual(
    ['nav-11-label', 'nav-11-url', 'nav-13-url', 'footer-0-url', 'footer-2-url', 'quote-1', 'quote-2', 'icpUrl'].sort(),
  )
  expect(siteExtrasErrors(defaultSiteSettings)).toEqual({})
  const tooMany = {
    ...structuredClone(defaultSiteSettings),
    navigation: Array.from({ length: 5 }, (_, index) => ({
      type: 'external' as const,
      label: `站${index}`,
      url: `https://s${index}.example`,
      newTab: true,
      visible: true,
    })),
  }
  expect(siteExtrasErrors(tooMany).navigation).toBe('外链导航最多 4 个')
})

it('旧恢复副本缺少新字段时仍可读取，并按缺省值补齐', () => {
  const {
    navigation: _navigation,
    footerLinks: _footerLinks,
    quotes: _quotes,
    icpNumber: _icpNumber,
    icpUrl: _icpUrl,
    copyright: _copyright,
    ...legacy
  } = structuredClone(defaultSiteSettings)
  const recovery = parseSiteSettingsRecovery(
    JSON.stringify({ version: 1, draft: legacy, baseline: legacy, preserved: null, submission: null }),
  )
  expect(recovery?.draft.navigation).toEqual(defaultNavigation())
  expect(recovery?.draft.footerLinks).toEqual(defaultFooterLinks())
  expect(recovery?.draft.icpNumber).toBe('')
  expect(normalizeSiteSettings(legacy as SiteSettingsData).quotes).toHaveLength(5)
  const broken = { ...structuredClone(defaultSiteSettings), navigation: 'all' }
  expect(parseSiteSettingsRecovery(JSON.stringify({ version: 1, draft: broken, baseline: broken }))).toBeNull()
  expect(navRouteCatalog.home.to).toBe('/')
})
