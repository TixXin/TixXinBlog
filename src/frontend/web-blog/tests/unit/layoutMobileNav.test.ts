/** @file layoutMobileNav.test.ts @description Nexus 与 Aurora 共享移动导航的当前页面、抽屉开合及键盘焦点回归。 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
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
mockNuxtImport('useSiteSettings', () => () => ({
  settings: ref({ name: '山间来信', description: '记录生活与创作', announcement: '', announcementUpdatedAt: '' }),
  available: ref(true),
  refresh: vi.fn().mockResolvedValue(undefined),
}))

const stubs = {
  Icon: true,
  BlogThemeSwitcher: true,
  BlogAppearanceEntry: true,
  CommonContextDrawer: ContextDrawer,
}
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []

beforeAll(() => {
  // 初始化失败会让后续组件回归失真，不能只依赖测试断言通过。
  const error = useNuxtApp().payload.error
  if (error) throw error
})

beforeEach(() => {
  mocks.currentThemeId = ref('aurora')
  mocks.openLogin.mockReset()
  // 单元 DOM 不做布局；只模拟可见矩形，焦点进入、约束与归还均使用真实实现。
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => {
    const rects = [new DOMRect(0, 0, 100, 24)]
    return Object.assign(rects, { item: (index: number) => rects[index] ?? null })
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

async function mountMobile(theme: string, route = '/archive') {
  mocks.currentThemeId.value = theme
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
  const wrapper = mount(MobileNav, { attachTo: host, global: { stubs, plugins: [router] } })
  wrappers.push(wrapper)
  return { wrapper, host }
}

describe.each(['nexus', 'aurora'])('%s 共享移动导航', (theme) => {
  it.each([
    ['/archive?page=2', '/archive'],
    ['/archive/', '/archive'],
    ['/moments', '/'],
    ['/moments/', '/'],
  ])('路由 %s 在快捷入口及全部页面中都标记唯一的当前页面', async (route, currentHref) => {
    const { wrapper } = await mountMobile(theme, route)
    expect(wrapper.get('nav').attributes('aria-label')).toBe('移动导航')
    expect(wrapper.findAll('.mobile-nav__list > li > a')).toHaveLength(4)
    expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(1)
    expect(wrapper.get('[aria-current="page"]').attributes('href')).toBe(currentHref)

    await wrapper.get('.context-entry__button').trigger('click')
    await nextTick()
    const menu = document.querySelector('.mobile-menu')!
    expect(menu.getAttribute('aria-label')).toBe('全部页面')
    expect(menu.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(menu.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(currentHref)
    expect(menu.querySelector('a[href="/links"]')?.textContent).toContain('友链')
  })

  it('开合状态、初始焦点、双向 Tab 约束和 Escape 归还入口保持一致', async () => {
    const { wrapper, host } = await mountMobile(theme)
    const trigger = wrapper.get<HTMLButtonElement>('.context-entry__button')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    await trigger.trigger('click')
    await nextTick()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="关闭更多导航"]')!
    const last = dialog.querySelector<HTMLButtonElement>('.mobile-menu__settings button')!
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('更多导航')
    expect(document.activeElement).toBe(close)
    expect(host.inert).toBe(true)
    expect(host.getAttribute('aria-hidden')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(close)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(host.inert).toBe(false)
    expect(host.hasAttribute('aria-hidden')).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('关闭按钮与导航链接均可收起菜单，再次打开仍可恢复初始焦点', async () => {
    const { wrapper } = await mountMobile(theme)
    const trigger = wrapper.get<HTMLButtonElement>('.context-entry__button')
    await trigger.trigger('click')
    await nextTick()
    document.querySelector<HTMLButtonElement>('[aria-label="关闭更多导航"]')!.click()
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(document.querySelector('[aria-label="关闭更多导航"]'))
    // 选择当前页面仍会触发真正的链接关闭事件，不依赖路由变化才收起。
    document.querySelector<HTMLAnchorElement>('.mobile-menu a[href="/archive"]')!.click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })
})
