/** @file nexusThemeShell.test.ts @description Nexus 外壳的跳转目标、导航语义及底栏收起态焦点回归 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'
import { defineComponent, h, nextTick, ref, Suspense } from 'vue'
import type { Component } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import DefaultLayout from '../../app/layouts/default.vue'
import SkipLinks from '../../app/components/layout/SkipLinks.vue'
import RootLayout from '../../themes/nexus/app/components/RootLayout.vue'
import StatusFooter from '../../themes/nexus/app/components/StatusFooter.vue'

// 主题组件清单：用于确认与宿主重复的桥接组件已删除，缺失挂件走宿主契约的合法跳过。
const themeComponents = import.meta.glob('../../themes/nexus/app/components/*.vue')

const mocks = vi.hoisted(() => ({
  postMetadata: vi.fn(),
  momentOverview: vi.fn(),
  siteInfo: vi.fn(),
  scrollProgress: vi.fn(),
  loginDrawer: vi.fn(),
  currentUser: vi.fn(),
  footerExpand: vi.fn(),
  router: null as Router | null,
}))
mockNuxtImport('usePostMetadata', () => mocks.postMetadata)
mockNuxtImport('useMomentOverview', () => mocks.momentOverview)
mockNuxtImport('useSiteInfo', () => mocks.siteInfo)
mockNuxtImport('useScrollProgress', () => mocks.scrollProgress)
mockNuxtImport('useLoginDrawer', () => mocks.loginDrawer)
mockNuxtImport('useCurrentUser', () => () => mocks.currentUser() ?? { isLoggedIn: ref(false), restore: vi.fn() })
mockNuxtImport('useFooterExpand', () => mocks.footerExpand)
mockNuxtImport('usePageMotion', () => () => {})
mockNuxtImport('useSiteSettings', () => () => ({ available: ref(true), settings: ref({}), refresh: vi.fn() }))
mockNuxtImport('useRouter', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => mocks.router ?? actual.useRouter()
})
mockNuxtImport('useRoute', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () =>
    mocks.router
      ? {
          get path() {
            return mocks.router!.currentRoute.value.path
          },
          get meta() {
            return mocks.router!.currentRoute.value.meta
          },
        }
      : actual.useRoute()
})

const SlotContainer = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const PageContent = defineComponent({
  setup: () => () => h('article', { 'data-page-content': '' }, '这里是页面正文'),
})
// 只替换引擎分发；默认布局、Nexus 根布局及底栏仍使用生产组件。
const ThemeComponent = defineComponent({
  props: { name: String },
  setup:
    (props, { slots }) =>
    () => {
      if (props.name === 'RootLayout') return h(RootLayout, null, slots)
      if (props.name === 'StatusFooter') return h(StatusFooter)
      return null
    },
})
const stubs = {
  ThemeComponent,
  LayoutSkipLinks: SkipLinks,
  NuxtPage: PageContent,
  LayoutMobileNav: true,
  CommonAppearanceDrawer: true,
  CommonCustomScrollbar: SlotContainer,
  OwnerProfileCard: true,
  SiteAnnouncementCard: true,
  SidebarSiteStatsCard: true,
  DailyQuoteCard: true,
  SidebarFooterCard: true,
  LazySidebarMomentAuthorCard: true,
  LazySidebarMomentCalendarCard: true,
  BlogThemeSwitcher: true,
  BlogAppearanceEntry: true,
  Icon: true,
}
const wrappers: { unmount(): void }[] = []
const containers: HTMLElement[] = []
const removeRoutes: (() => void)[] = []
let router: Router
let expanded = ref(false)

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
  expanded = ref(false)
  mocks.footerExpand.mockReturnValue({ isFooterExpanded: expanded })
  mocks.postMetadata.mockResolvedValue({ siteStats: ref(null), error: ref(null) })
  mocks.momentOverview.mockResolvedValue({
    authorStats: ref(null),
    ownerCard: ref(null),
    momentDates: ref([]),
    momentDateCounts: ref({}),
    metadata: ref(null),
  })
  mocks.siteInfo.mockReturnValue({
    ownerPresence: ref({ status: 'online', label: '在线', signature: '记录所见', since: '' }),
    ownerCard: ref({
      name: '山间笔记',
      title: '写作者',
      avatar: '/avatar.svg',
      quotes: ['记录日常的微光'],
      socials: [{ label: '代码', href: 'https://github.com/example', icon: 'lucide:github' }],
    }),
    dailyQuote: ref('记录日常的微光'),
  })
  mocks.scrollProgress.mockReturnValue({
    scrollProgress: ref(0),
    scrollResetFn: ref(null),
    scrollDirection: ref('up'),
  })
  mocks.loginDrawer.mockReturnValue({
    isOpen: ref(false),
    preferModal: ref(false),
    toggle: vi.fn(),
    close: vi.fn(),
  })
  mocks.currentUser.mockReturnValue({ isLoggedIn: ref(false), currentUser: ref(null), logout: vi.fn() })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  containers.splice(0).forEach((container) => container.remove())
  removeRoutes.splice(0).forEach((remove) => remove())
  vi.useRealTimers()
  vi.restoreAllMocks()
  mocks.router = null
})

async function mountShell(component: Component = StatusFooter, route = '/') {
  // 内存路由保留真实 NuxtLink/RouterLink，避免加载宿主页面及测试工具的链接替身。
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...['/', '/archive', '/about', '/moments'].map((path) => ({ path, component: PageContent })),
      { path: '/:pathMatch(.*)*', component: PageContent },
    ],
  })
  await router.push(route)
  mocks.router = router
  const container = document.createElement('div')
  document.body.append(container)
  containers.push(container)
  const Host = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(component) }),
  })
  const wrapper = mount(Host, { attachTo: container, global: { stubs, plugins: [router] } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('Nexus 默认布局与主导航', () => {
  it('首个跳转链接定位唯一主内容，保留页面插槽、侧栏挂载点和底栏主导航', async () => {
    const wrapper = await mountShell(DefaultLayout)
    const links = wrapper.findAll('.skip-links a')
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['跳到主内容', '#main-content'],
      ['跳到导航', '#site-navigation'],
    ])
    expect(wrapper.findAll('#main-content')).toHaveLength(1)
    expect(wrapper.findAll('#right-sidebar-target')).toHaveLength(1)
    expect(wrapper.findAll('#site-navigation')).toHaveLength(1)
    expect(wrapper.findAll('a, button')[0]!.element).toBe(links[0]!.element)
    const main = wrapper.get<HTMLElement>('main#main-content')
    expect(main.attributes('tabindex')).toBe('-1')
    expect(main.get('[data-page-content]').text()).toBe('这里是页面正文')
    const scroll = vi.spyOn(main.element, 'scrollIntoView').mockImplementation(() => {})
    await links[0]!.trigger('click')
    expect(document.activeElement).toBe(main.element)
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
  })

  it('跳到导航会聚焦底栏首个链接，并立即收起悬停卡片', async () => {
    const wrapper = await mountShell(DefaultLayout)
    // happy-dom 没有布局引擎；仅为本次外壳中的导航节点提供可见矩形。
    wrapper.findAll<HTMLElement>('#site-navigation, #site-navigation a').forEach(({ element }) => {
      vi.spyOn(element, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 100, 40)] as unknown as DOMRectList)
    })
    expanded.value = true
    await nextTick()
    expect(wrapper.get('.nexus-bar__row-owner').attributes('inert')).toBeUndefined()
    await wrapper.get('.skip-links a[href="#site-navigation"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#site-navigation a').element)
    expect(wrapper.get('.nexus-bar__row-owner').attributes('inert')).toBeDefined()
    expect(wrapper.get('.nexus-bar').classes()).not.toContain('is-expanded')
  })

  it('主页、尾斜杠、子路径及相似前缀均只标记实际所属栏目', async () => {
    const wrapper = await mountShell()
    removeRoutes.push(
      router.addRoute({ path: '/archive/:pathMatch(.*)*', component: PageContent }),
      router.addRoute({ path: '/archives', component: PageContent }),
    )
    for (const [path, current] of [
      ['/', '/'],
      ['/archive', '/archive'],
      ['/archive/', '/archive'],
      ['/archive/2026', '/archive'],
      ['/archives', null],
      ['/about', '/about'],
    ]) {
      await router.push(path!)
      await flushPromises()
      const nav = wrapper.get('nav#site-navigation')
      expect(nav.attributes('aria-label')).toBe('站点导航')
      expect(nav.findAll('a[aria-current="page"]').map((link) => link.attributes('href'))).toEqual(
        current ? [current] : [],
      )
      expect(nav.findAll('.is-active').map((link) => link.attributes('href'))).toEqual(current ? [current] : [])
    }
  })

  it('桌面底栏保留主题切换与外观设置入口，移动端浮动重复入口已随组件删除', async () => {
    const wrapper = await mountShell()
    const actions = wrapper.get('.nexus-bar__row-nav .nexus-bar__actions')
    expect(actions.find('blog-theme-switcher-stub').exists()).toBe(true)
    expect(actions.find('blog-appearance-entry-stub').exists()).toBe(true)
    expect(wrapper.find('.nexus-mobile-fab').exists()).toBe(false)
  })

  it('SidebarNav 僵尸桥接已移除，主题只保留自身实现组件', () => {
    const componentNames = Object.keys(themeComponents).map((path) => path.split('/').pop())
    expect(componentNames).toContain('RootLayout.vue')
    expect(componentNames).toContain('StatusFooter.vue')
    expect(componentNames).not.toContain('PostCard.vue')
    expect(componentNames).not.toContain('SidebarNav.vue')
    expect(componentNames).not.toContain('ThemeAccessory.vue')
  })
})

describe('Nexus 底栏收起态', () => {
  it('初始身份卡为 inert，悬停展开后解除，离开收起时恢复', async () => {
    const wrapper = await mountShell()
    const owner = wrapper.get('.nexus-bar__row-owner')
    expect(owner.attributes('inert')).toBeDefined()
    expect(owner.get('button[aria-label="换一条"]').exists()).toBe(true)
    expect(owner.get('a[href="https://github.com/example"]').text()).toBe('代码')
    expect(wrapper.get('.nexus-bar__row-nav').attributes('inert')).toBeUndefined()
    vi.useFakeTimers()
    await wrapper.get('.nexus-bar__avatar-wrap').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(120)
    expect(owner.attributes('inert')).toBeUndefined()
    expect(wrapper.get('.nexus-bar').classes()).toContain('is-expanded')
    await wrapper.get('.nexus-bar').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(150)
    expect(owner.attributes('inert')).toBeDefined()
    expect(wrapper.get('.nexus-bar').classes()).not.toContain('is-expanded')
  })

  it('展开时键盘焦点进入导航会立即恢复导航可见性，且保留当前焦点', async () => {
    const wrapper = await mountShell()
    expanded.value = true
    await nextTick()
    const link = wrapper.get<HTMLAnchorElement>('#site-navigation a[href="/archive"]')
    link.element.focus()
    await nextTick()
    expect(document.activeElement).toBe(link.element)
    expect(wrapper.get('.nexus-bar__row-owner').attributes('inert')).toBeDefined()
    expect(wrapper.get('.nexus-bar').classes()).not.toContain('is-expanded')
  })

  it('悬停展开尚未执行时键盘进入导航，会取消展开而不让获焦链接随后透明', async () => {
    const wrapper = await mountShell()
    vi.useFakeTimers()
    await wrapper.get('.nexus-bar__avatar-wrap').trigger('mouseenter')
    const link = wrapper.get<HTMLAnchorElement>('#site-navigation a[href="/archive"]')
    link.element.focus()
    await nextTick()
    await vi.advanceTimersByTimeAsync(120)
    expect(document.activeElement).toBe(link.element)
    expect(wrapper.get('.nexus-bar__row-owner').attributes('inert')).toBeDefined()
    expect(wrapper.get('.nexus-bar').classes()).not.toContain('is-expanded')
  })

  it('头像短暂经过后离开不会迟到展开，卸载也会取消未完成的展开计时', async () => {
    const wrapper = await mountShell()
    vi.useFakeTimers()
    await wrapper.get('.nexus-bar__avatar-wrap').trigger('mouseenter')
    await wrapper.get('.nexus-bar').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(150)
    expect(wrapper.get('.nexus-bar__row-owner').attributes('inert')).toBeDefined()
    await wrapper.get('.nexus-bar__avatar-wrap').trigger('mouseenter')
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    await vi.advanceTimersByTimeAsync(150)
    expect(expanded.value).toBe(false)
  })
})

describe('Nexus 底栏交互与监听清理', () => {
  function mockLoggedIn() {
    mocks.currentUser.mockReturnValue({
      isLoggedIn: ref(true),
      currentUser: ref({ nickname: '山间笔记', email: 'note@example.com' }),
      logout: vi.fn(),
    })
  }

  it('打开用户菜单后挂载外部点击监听，关闭时移除', async () => {
    mockLoggedIn()
    const wrapper = await mountShell()
    vi.useFakeTimers()
    const addListener = vi.spyOn(document, 'addEventListener')
    const removeListener = vi.spyOn(document, 'removeEventListener')

    await wrapper.get('.nexus-bar__login').trigger('click')
    await nextTick()
    await vi.advanceTimersByTimeAsync(1)
    expect(addListener).toHaveBeenCalledWith('click', expect.any(Function))

    await wrapper.get('.nexus-bar__login').trigger('click')
    await nextTick()
    expect(removeListener).toHaveBeenCalledWith('click', expect.any(Function))
    expect(wrapper.find('.nexus-bar').exists()).toBe(true)
  })

  it('延迟监听尚未挂载即卸载时取消计时器，不残留 document 监听', async () => {
    mockLoggedIn()
    const wrapper = await mountShell()
    vi.useFakeTimers()
    const addListener = vi.spyOn(document, 'addEventListener')
    const clickAddsBefore = addListener.mock.calls.filter(([type]) => type === 'click').length

    await wrapper.get('.nexus-bar__login').trigger('click')
    await nextTick()
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    await vi.advanceTimersByTimeAsync(10)

    expect(addListener.mock.calls.filter(([type]) => type === 'click')).toHaveLength(clickAddsBefore)
  })

  it('用户菜单按 Escape 或点击菜单项关闭时，焦点归还触发按钮', async () => {
    mockLoggedIn()
    const wrapper = await mountShell()
    const trigger = wrapper.get<HTMLButtonElement>('.nexus-bar__login')

    await trigger.trigger('click')
    const menuItem = wrapper.get<HTMLButtonElement>('.nexus-bar__user-menu button[role="menuitem"]')
    menuItem.element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.nexus-bar__user-menu').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await wrapper.get<HTMLButtonElement>('.nexus-bar__user-menu button[role="menuitem"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.nexus-bar__user-menu').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })
})

describe('Nexus 底栏英文界面', () => {
  const i18n = () => useNuxtApp().$i18n

  it('切到英文后导航、进度、头像链接与一言按钮的可访问名称为英文', async () => {
    await i18n().setLocale('en')
    try {
      mocks.scrollProgress.mockReturnValue({
        scrollProgress: ref(42),
        scrollResetFn: ref(null),
        scrollDirection: ref('down'),
      })
      const wrapper = await mountShell()
      expect(wrapper.get('#site-navigation').attributes('aria-label')).toBe('Site navigation')
      expect(wrapper.get('.nexus-bar__progress').attributes('aria-label')).toBe('Jump to bottom, 42% read')
      expect(wrapper.get('.nexus-bar__avatar-wrap').attributes('aria-label')).toBe(
        'Back to home. Current: 山间笔记, status: 在线',
      )
      expect(wrapper.get('.nexus-bar__login').attributes('aria-label')).toBe('Sign in')
      expect(wrapper.find('button[aria-label="Show another"]').exists()).toBe(true)
    } finally {
      await i18n().setLocale('zh-CN')
    }
  })
})
