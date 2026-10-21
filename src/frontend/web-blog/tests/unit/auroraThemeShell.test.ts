/** @file auroraThemeShell.test.ts @description Aurora 外壳的跳转地标、导航语义与共享底栏回归。 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AuroraRootLayout from '../../themes/aurora/app/components/RootLayout.vue'
import DefaultStatusFooter from '../../app/components/theme/DefaultStatusFooter.vue'
import SkipLinks from '../../app/components/layout/SkipLinks.vue'
import MobileNav from '../../app/components/layout/MobileNav.vue'
import ContextDrawer from '../../app/components/common/ContextDrawer.vue'

// 主题组件清单：用于确认与宿主重复的桥接组件已删除，缺失组件由宿主默认壳层承接。
const themeComponents = import.meta.glob('../../themes/aurora/app/components/*.vue')

const mocks = vi.hoisted(() => ({
  currentThemeId: {} as Ref<string>,
  route: { path: '/', meta: {}, query: {} } as {
    readonly path: string
    readonly meta: Record<string, unknown>
    readonly query: Record<string, unknown>
  },
  openLogin: vi.fn(),
}))
mockNuxtImport('useLayoutTheme', () => () => ({
  currentThemeId: mocks.currentThemeId,
  // 宿主 MobileNav 按能力位决定是否渲染共享移动导航，能力位来自 activeTheme
  activeTheme: ref({ name: 'aurora', capabilities: { mobileNav: true } }),
}))
mockNuxtImport('useCurrentUser', () => () => ({
  isLoggedIn: ref(false),
  restore: vi.fn().mockResolvedValue(undefined),
}))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useLoginDrawer', () => () => ({ open: mocks.openLogin }))
mockNuxtImport('useMotionPreference', () => () => ({ reducedMotion: ref(true) }))
mockNuxtImport('useAppearanceSettings', () => () => ({ sidebarAnimationClass: ref('') }))
mockNuxtImport('useApiLatency', () => () => ({ pingMs: ref(null) }))
mockNuxtImport('useSiteSettings', () => () => ({
  settings: ref({ name: '山间来信', description: '记录生活与创作', announcement: '', announcementUpdatedAt: '' }),
  available: ref(true),
  refresh: vi.fn().mockResolvedValue(undefined),
}))

const PassThrough = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})
const ThemeComponent = defineComponent({
  props: { name: { type: String, required: true } },
  setup(props) {
    // 与宿主 ThemeComponent 一致：主题缺 StatusFooter 时由宿主默认壳层承接
    return () => (props.name === 'StatusFooter' ? h(DefaultStatusFooter) : null)
  },
})
const Shell = defineComponent({
  setup() {
    return () =>
      h('div', [h(SkipLinks), h(AuroraRootLayout, null, { default: () => h('h1', '山野手记') }), h(MobileNav)])
  },
})
const stubs = {
  Icon: true,
  BlogThemeSwitcher: true,
  BlogAppearanceEntry: true,
  CommonSiteAnnouncement: true,
  CommonCustomScrollbar: PassThrough,
  CommonTooltip: PassThrough,
  ThemeComponent,
  CommonContextDrawer: ContextDrawer,
}
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
let desktopNavigationHidden = false

beforeAll(async () => {
  // 初始化失败会让后续组件回归失真，不能只依赖测试断言通过。
  const error = useNuxtApp().payload.error
  if (error) throw error
  // Nuxt i18n 首次切换语言会懒加载整包词典（冷启动可达十余秒）；在 hook 超时内预热，
  // 避免后续英文用例撞上默认 5s 测试超时（仓库 layoutTheme 测试同样显式放宽过超时）。
  await useNuxtApp().$i18n.setLocale('en')
  await useNuxtApp().$i18n.setLocale('zh-CN')
})

beforeEach(() => {
  mocks.currentThemeId = ref('aurora')
  mocks.openLogin.mockReset()
  desktopNavigationHidden = false
  // 单元 DOM 不做布局；只模拟可见矩形，仍由真实跳转与模态代码决定聚焦对象。
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    const rects = desktopNavigationHidden && this.closest('#site-navigation') ? [] : [new DOMRect(0, 0, 100, 24)]
    return Object.assign(rects, { item: (index: number) => rects[index] ?? null })
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

async function mountShell(route = '/archive') {
  // 独立内存路由保留真实 RouterLink，避免加载宿主页面及触发页面请求。
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...['/', '/moments', '/archive'].map((path) => ({ path, component: { render: () => null } })),
      { path: '/:pathMatch(.*)*', component: { render: () => null } },
    ],
  })
  await router.push(route)
  mocks.route = {
    get path() {
      return router.currentRoute.value.path
    },
    get meta() {
      return router.currentRoute.value.meta
    },
    get query() {
      return router.currentRoute.value.query
    },
  }
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = mount(Shell, { attachTo: host, global: { stubs, plugins: [router] } })
  wrappers.push(wrapper)
  return wrapper
}

describe('Aurora 主题外壳', () => {
  it('首个跳转链接将焦点移到唯一的主内容地标并保留宿主页插槽', async () => {
    const wrapper = await mountShell()
    const skip = wrapper.get<HTMLAnchorElement>('.skip-links a')
    const main = wrapper.get<HTMLElement>('main#main-content')
    const scrollIntoView = vi.spyOn(main.element, 'scrollIntoView').mockImplementation(() => {})

    expect(skip.text()).toBe('跳到主内容')
    expect(skip.attributes('href')).toBe('#main-content')
    expect(wrapper.findAll('a')[0]!.element).toBe(skip.element)
    expect(wrapper.findAll('#main-content')).toHaveLength(1)
    expect(main.attributes('tabindex')).toBe('-1')
    expect(main.get('h1').text()).toBe('山野手记')
    skip.element.focus()
    await skip.trigger('click')

    expect(document.activeElement).toBe(main.element)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('主导航使用唯一的稳定 id，跳到导航聚焦首个可见链接', async () => {
    const wrapper = await mountShell()
    const nav = wrapper.get('nav#site-navigation')
    expect(wrapper.findAll('#site-navigation')).toHaveLength(1)
    expect(nav.attributes('aria-label')).toBe('主导航')
    await wrapper.get('.skip-links a[href="#site-navigation"]').trigger('click')
    expect(document.activeElement).toBe(nav.get('a').element)
  })

  it('桌面导航不可见时，跳到导航回退到共享移动导航', async () => {
    const wrapper = await mountShell()
    desktopNavigationHidden = true
    await wrapper.get('.skip-links a[href="#site-navigation"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('.mobile-nav a').element)
  })

  it.each([
    ['/archive?page=2', '/archive'],
    ['/archive/', '/archive'],
    ['/', '/'],
    ['/moments', '/'],
    ['/moments/', '/'],
  ])('路由 %s 的主导航仅为 %s 标记当前页面', async (route, currentHref) => {
    const wrapper = await mountShell(route)
    const nav = wrapper.get('#site-navigation')
    expect(nav.findAll('[aria-current="page"]')).toHaveLength(1)
    expect(nav.get('[aria-current="page"]').attributes('href')).toBe(currentHref)
    expect(nav.get(`a[href="${currentHref}"]`).classes()).toContain('active')
    for (const link of nav.findAll('a')) {
      if (link.attributes('href') !== currentHref) expect(link.attributes('aria-current')).toBeUndefined()
    }
  })

  it('主题缺失 StatusFooter 时由宿主默认壳层承接，保持单一页脚地标和可读的链接及状态', async () => {
    const wrapper = await mountShell()
    expect(wrapper.findAll('footer')).toHaveLength(1)
    const footer = wrapper.get('footer')
    expect(footer.findAll('.site-footer')).toHaveLength(1)
    expect(footer.get('nav[aria-label="页脚链接"] a[href="/about"]').text()).toBe('关于本站')
    const rss = footer.get('a[href="/rss.xml"]')
    expect(rss.attributes('target')).toBe('_blank')
    expect(rss.attributes('rel')).toContain('noopener')
    expect(footer.get('[role="status"]').attributes('tabindex')).toBe('0')
    expect(footer.get('[role="status"]').text()).toContain('站点资料已同步')
    expect(footer.text()).toContain('山间来信')
  })

  it('主题不再保留与宿主重复的桥接组件，缺失挂件由契约合法跳过', () => {
    const componentNames = Object.keys(themeComponents).map((path) => path.split('/').pop())
    expect(componentNames).toContain('RootLayout.vue')
    expect(componentNames).not.toContain('PostCard.vue')
    expect(componentNames).not.toContain('StatusFooter.vue')
    expect(componentNames).not.toContain('ThemeAccessory.vue')
  })
})

describe('Aurora 主题外壳英文界面', () => {
  const i18n = () => useNuxtApp().$i18n

  it('切到英文后主导航、登录入口与减少动效下的首页背景按钮为英文', async () => {
    await i18n().setLocale('en')
    try {
      const wrapper = await mountShell('/')
      expect(wrapper.get('nav#site-navigation').attributes('aria-label')).toBe('Main navigation')
      expect(wrapper.get('.aurora-topbar__login').attributes('aria-label')).toBe('Sign in')
      expect(wrapper.get('.aurora-hero__play').text()).toBe('Static background')
    } finally {
      await i18n().setLocale('zh-CN')
    }
  })
})
