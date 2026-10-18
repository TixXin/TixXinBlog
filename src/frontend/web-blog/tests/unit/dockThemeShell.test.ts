/** @file dockThemeShell.test.ts @description Dock 主题外壳的跳转焦点、主导航当前页与共享页脚回归 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import RootLayout from '../../themes/dock/app/components/RootLayout.vue'
import StatusFooter from '../../themes/dock/app/components/StatusFooter.vue'
import SkipLinks from '../../app/components/layout/SkipLinks.vue'
import MobileNav from '../../app/components/layout/MobileNav.vue'

const state = vi.hoisted(() => ({ reducedMotion: false, route: { path: '/', query: {} } }))

// 只隔离站点读取与登录、主题状态，保留真实导航、跳转链接及页脚组件。
mockNuxtImport('useSiteSettings', () => () => ({
  settings: ref({ announcement: '', announcementUpdatedAt: '' }),
  available: ref(true),
  refresh: vi.fn().mockResolvedValue(undefined),
}))
// 页脚文案、备案号与链接来自站点设置，这里按 useSiteInfo 的展示结构提供。
mockNuxtImport('useSiteInfo', () => () => ({
  siteName: ref('岛上来信'),
  copyrightText: ref('© 2026 岛上来信. All rights reserved.'),
  icp: ref({ number: '沪ICP备2026001234号', href: 'https://beian.miit.gov.cn/' }),
  footerLinks: ref([
    { label: '关于', href: '/about', external: false, newTab: false },
    { label: '源码', href: 'https://github.com/TixXin/TixXinBlog', external: true, newTab: true },
  ]),
  poweredBy: ref([{ label: 'Nuxt', href: 'https://nuxt.com' }]),
  siteStatus: ref({ statusText: '站点资料已同步' }),
}))
mockNuxtImport('useApiLatency', () => () => ({ pingMs: ref(null) }))
mockNuxtImport('useMotionPreference', () => () => ({ reducedMotion: ref(state.reducedMotion) }))
mockNuxtImport('useLayoutTheme', () => () => ({ currentThemeId: ref('dock') }))
mockNuxtImport('useCurrentUser', () => () => ({
  isLoggedIn: ref(false),
  restore: vi.fn().mockResolvedValue(undefined),
}))
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))
mockNuxtImport('useRoute', () => () => state.route)

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
const ThemeComponent = defineComponent({
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => (props.name === 'StatusFooter' ? h(StatusFooter) : null)
  },
})

beforeAll(() => {
  const initializationError = useNuxtApp().payload.error
  if (initializationError) throw initializationError
})

beforeEach(() => {
  state.reducedMotion = false
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

async function mountShell(route = '/') {
  // 独立内存路由保留真实 RouterLink 的 aria-current，不加载宿主页面或发起页面请求。
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...['/', '/moments', '/archive'].map((path) => ({ path, component: { render: () => null } })),
      { path: '/:pathMatch(.*)*', component: { render: () => null } },
    ],
  })
  await router.push(route)
  state.route = { path: router.currentRoute.value.path, query: router.currentRoute.value.query }
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => [h(SkipLinks), h(RootLayout, null, { default: () => h('h1', '来自海边的一封信') }), h(MobileNav)]
      },
    }),
    {
      attachTo: host,
      global: {
        plugins: [router],
        stubs: {
          ThemeComponent,
          Icon: true,
          CommonSiteAnnouncement: true,
          BlogThemeSwitcher: true,
          BlogAppearanceEntry: true,
        },
      },
    },
  )
  wrappers.push(wrapper)
  return wrapper
}

describe('Dock 主题外壳', () => {
  it('宿主跳转链接指向唯一且可编程聚焦的主内容，保留页面插槽与侧栏挂载点', async () => {
    const wrapper = await mountShell()
    expect(wrapper.findAll('main#main-content')).toHaveLength(1)
    const main = wrapper.get<HTMLElement>('main#main-content')
    expect(main.attributes('tabindex')).toBe('-1')
    expect(main.get('h1').text()).toBe('来自海边的一封信')
    expect(wrapper.findAll('#right-sidebar-target')).toHaveLength(1)

    const skip = wrapper.get<HTMLAnchorElement>('a[href="#main-content"]')
    expect(skip.text()).toBe('跳到主内容')
    expect(wrapper.findAll('a')[0]!.element).toBe(skip.element)
    const scroll = vi.spyOn(main.element, 'scrollIntoView').mockImplementation(() => {})
    skip.element.focus()
    await skip.trigger('click')
    expect(document.activeElement).toBe(main.element)
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
  })

  it('主导航拥有稳定 id 和名称，跳转链接将焦点交给第一个可见导航链接', async () => {
    const wrapper = await mountShell()
    expect(wrapper.findAll('#site-navigation')).toHaveLength(1)
    const nav = wrapper.get<HTMLElement>('nav#site-navigation')
    expect(nav.attributes('aria-label')).toBe('主导航')
    const home = nav.get<HTMLAnchorElement>('a[href="/"]')

    // DOM 单测没有布局盒；仅给真实导航目标声明可见，焦点仍由 SkipLinks 执行。
    const rects = [new DOMRect(0, 0, 100, 40)] as unknown as DOMRectList
    vi.spyOn(nav.element, 'getClientRects').mockReturnValue(rects)
    vi.spyOn(home.element, 'getClientRects').mockReturnValue(rects)
    const skip = wrapper.get<HTMLAnchorElement>('a[href="#site-navigation"]')
    skip.element.focus()
    await skip.trigger('click')
    expect(document.activeElement).toBe(home.element)
  })

  it.each([
    ['/', '/'],
    ['/moments', '/'],
    ['/moments/', '/'],
    ['/archive?page=2', '/archive'],
    ['/archive/', '/archive'],
  ])('路由 %s 只把导航 %s 标为当前页，包括主页别名、查询参数与尾斜杠', async (route, activeHref) => {
    const wrapper = await mountShell(route)
    const nav = wrapper.get('#site-navigation')
    expect(nav.findAll('a[aria-current="page"]')).toHaveLength(1)
    const active = nav.get(`a[href="${activeHref}"]`)
    expect(active.attributes('aria-current')).toBe('page')
    expect(active.classes()).toContain('active')
    nav.findAll('a').forEach((link) => {
      if (link.element === active.element) return
      expect(link.attributes('aria-current')).toBeUndefined()
      expect(link.classes()).not.toContain('active')
    })
  })

  it('Dock 使用自身导航，宿主共享移动导航不重复渲染', async () => {
    const wrapper = await mountShell()
    expect(wrapper.findComponent(MobileNav).exists()).toBe(true)
    expect(wrapper.find('.mobile-nav').exists()).toBe(false)
    expect(wrapper.find('nav[aria-label="全部页面"]').exists()).toBe(false)
    const links = wrapper.get('#site-navigation').findAll('a')
    expect(links.length).toBeGreaterThan(4)
    links.forEach((link) => {
      expect(link.attributes('aria-label')).toBeTruthy()
      expect(link.attributes('tabindex')).not.toBe('-1')
      expect(link.element.closest('[inert]')).toBeNull()
    })
  })

  it('主题页脚桥接真实共享内容，只保留一个 footer 地标与可聚焦状态', async () => {
    const wrapper = await mountShell()
    expect(wrapper.findComponent(StatusFooter).exists()).toBe(true)
    expect(wrapper.findAll('footer')).toHaveLength(1)
    const footer = wrapper.get('footer')
    expect(footer.get('.footer__copyright').text()).toContain('岛上来信')
    const icp = footer.get('a.footer__icp')
    expect(icp.text()).toBe('沪ICP备2026001234号')
    expect(icp.attributes('href')).toBe('https://beian.miit.gov.cn/')
    const links = footer.get('nav[aria-label="页脚链接"]')
    expect(links.get('a[href="/about"]').text()).toBe('关于')
    const external = links.get('a[href="https://github.com/TixXin/TixXinBlog"]')
    expect(external.attributes('target')).toBe('_blank')
    expect(external.attributes('rel')).toContain('noopener')
    const status = footer.get<HTMLElement>('[role="status"]')
    expect(status.text()).toBe('站点资料已同步')
    expect(status.attributes('tabindex')).toBe('0')
    status.element.focus()
    expect(document.activeElement).toBe(status.element)
  })

  it.each([false, true])('减少动态效果为 %s 时保留导航，并按偏好启停悬停缩放', async (reducedMotion) => {
    state.reducedMotion = reducedMotion
    const wrapper = await mountShell()
    const nav = wrapper.get('#site-navigation')
    const home = nav.get<HTMLAnchorElement>('a[href="/"]')
    await home.trigger('mouseenter')
    expect(home.element.style.getPropertyValue('--dock-scale')).toBe(
      reducedMotion ? '' : 'var(--dock-icon-scale-hover, 1.3)',
    )
    expect(home.attributes('aria-current')).toBe('page')
    await nav.trigger('mouseleave')
    expect(home.element.style.getPropertyValue('--dock-scale')).toBe('')
  })
})
