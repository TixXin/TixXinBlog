/** @file auroraThemeShell.test.ts @description Aurora 外壳的跳转地标、导航语义与共享底栏回归。 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AuroraRootLayout from '../../themes/aurora/app/components/RootLayout.vue'
import AuroraStatusFooter from '../../themes/aurora/app/components/StatusFooter.vue'
import SkipLinks from '../../app/components/layout/SkipLinks.vue'
import MobileNav from '../../app/components/layout/MobileNav.vue'
import ContextDrawer from '../../app/components/common/ContextDrawer.vue'

const mocks = vi.hoisted(() => ({
  currentThemeId: {} as Ref<string>,
  route: { path: '/', meta: {}, query: {} } as {
    readonly path: string
    readonly meta: Record<string, unknown>
    readonly query: Record<string, unknown>
  },
  openLogin: vi.fn(),
}))
mockNuxtImport('useLayoutTheme', () => () => ({ currentThemeId: mocks.currentThemeId }))
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
    return () => (props.name === 'StatusFooter' ? h(AuroraStatusFooter) : null)
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

beforeAll(() => {
  // 初始化失败会让后续组件回归失真，不能只依赖测试断言通过。
  const error = useNuxtApp().payload.error
  if (error) throw error
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

  it('底栏桥接共享内容，保持单一页脚地标和可读的链接及状态', async () => {
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
})
