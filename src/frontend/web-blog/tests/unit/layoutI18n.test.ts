/**
 * @file layoutI18n.test.ts
 * @description 外壳（导航、页脚、侧栏、通用组件）英文冒烟：切到 en 后关键文案变为英文，切回中文逐字不变
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { buildNavItems, navRouteCatalog } from '../../app/features/nav/routes'
import { buildFooterLinks, defaultQuotes } from '../../app/features/site/footer'
import { defaultSiteSettings, presenceStatusOptions } from '../../app/features/site/settings'
import { COLOR_MODE_LABELS, CONTENT_TRANSITION_OPTIONS } from '../../app/features/appearance/types'
import { presenceStatusLabels } from '../../app/composables/useSiteInfo'
import SkipLinks from '../../app/components/layout/SkipLinks.vue'
import ImageFailure from '../../app/components/common/ImageFailure.vue'
import HeatmapGrid from '../../app/components/sidebar/HeatmapGrid.vue'
import SiteStatsCard from '../../app/components/sidebar/SiteStatsCard.vue'
import FlashCalendarCard from '../../app/components/sidebar/FlashCalendarCard.vue'

// 在用例内取：收集阶段测试应用尚未就绪
const i18n = () => useNuxtApp().$i18n
const wrappers: { unmount(): void }[] = []

afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await i18n().setLocale('zh-CN')
})

async function inEnglish() {
  await i18n().setLocale('en')
}

describe('外壳英文冒烟', () => {
  it('内置导航名称、缺省页脚链接、一言与站点缺省值跟随界面语言', async () => {
    expect(buildNavItems(undefined).map((item) => item.label)).toContain('平台订阅费')
    expect(defaultSiteSettings.avatarAlt).toBe('博主头像')
    await inEnglish()
    expect(
      buildNavItems(undefined)
        .slice(0, 3)
        .map((item) => item.label),
    ).toEqual(['Home', 'Archive', 'Projects'])
    expect(navRouteCatalog.subscriptions.label).toBe('Subscriptions')
    expect(buildFooterLinks(undefined).map((link) => link.label)).toEqual(['About this site', 'RSS feed', 'Sitemap'])
    expect(defaultQuotes()).toHaveLength(5)
    expect(defaultQuotes()[0]).not.toMatch(/[一-鿿]/)
    // 复制站点缺省值得到取值当时语言的普通数据
    const copy = structuredClone(defaultSiteSettings)
    expect(copy.avatarAlt).toBe('Author avatar')
    expect(copy.footerLinks[0]?.label).toBe('About this site')
    expect(presenceStatusLabels.idle).toBe('Away')
    expect(presenceStatusOptions.map((option) => option.label)).toContain('Busy')
    expect(COLOR_MODE_LABELS.system).toBe('System')
    expect(CONTENT_TRANSITION_OPTIONS.find((option) => option.value === 'none')?.label).toBe('No animation')
  })

  it('跳转链接与图片失败提示切换为英文', async () => {
    await inEnglish()
    const skip = mount(SkipLinks)
    wrappers.push(skip)
    expect(skip.text()).toContain('Skip to main content')
    const failure = mount(ImageFailure, { props: { alt: 'Lake' }, global: { stubs: { Icon: true } } })
    wrappers.push(failure)
    expect(failure.text()).toContain('Image failed to load')
    expect(failure.get('button').attributes('aria-label')).toBe('Image failed to load. Retry: Lake')
  })

  it('侧栏统计、热力图与日历使用英文复数和日期格式', async () => {
    await inEnglish()
    const stats = mount(SiteStatsCard, {
      props: { stats: { siteAgeDays: 1234, articles: 1, views: '2', comments: 3, tags: 4 } },
      global: { stubs: { Icon: true, SidebarHeatmapGrid: true } },
    })
    wrappers.push(stats)
    expect(stats.text()).toContain('1,234 days')
    expect(stats.text()).toContain('Posts')

    const heatmap = mount(HeatmapGrid, {
      props: { activity: [{ date: '2026-01-05', articles: 1, comments: 2 }] },
    })
    wrappers.push(heatmap)
    expect(heatmap.text()).toContain('Last 15 weeks · UTC')
    // 明细分隔符前后空白必须保留
    expect(i18n().t('layout.sidebar.heatmap.separator')).toBe(', ')
    expect(heatmap.get('button').attributes('aria-label')).toBe('2026-01-05: 1 public posts, 2 public comments')

    const calendar = mount(FlashCalendarCard, {
      props: { dates: [] },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(calendar)
    expect(calendar.text()).toContain('Posting calendar')
    expect(calendar.text()).toMatch(/[A-Z][a-z]{2} \d{4}/)
    expect(calendar.text()).toContain('Mo')
  })
})
