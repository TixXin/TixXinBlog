/**
 * @file adminCommandPalette.test.ts
 * @description 后台命令面板与快捷键：命令匹配、方向键与回车跳转、文章标题搜索的防抖与失败兜底，
 *              Ctrl/⌘ + K 开关面板，/ 与 n 只在未输入、无模态层时生效
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CommandPalette from '../../app/components/admin/CommandPalette.vue'
import { useAdminShortcuts } from '../../app/composables/useAdminShortcuts'
import { adminStaticCommands, matchCommands } from '../../app/features/admin/commands'

const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('navigateTo', () => mocks.navigate)

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.api.mockReset().mockResolvedValue({
    items: [
      { id: 7, title: 'Nuxt 部署笔记' },
      { id: 9, title: 'Nuxt 主题引擎' },
    ],
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('命令匹配', () => {
  const commands = adminStaticCommands((key) => ({ 'admin-system.nav.posts': '文章管理' })[key] ?? key)
  it('空查询返回全部，新建在前；按名称或路径不区分大小写匹配', () => {
    expect(matchCommands(commands, '')).toEqual(commands)
    expect(commands[0]!.group).toBe('create')
    expect(matchCommands(commands, '文章').map((item) => item.to)).toContain('/admin/posts')
    expect(matchCommands(commands, ' ADMIN/POSTS ').map((item) => item.to)).toEqual([
      '/admin/posts/new',
      '/admin/posts',
    ])
    expect(matchCommands(commands, '不存在的页面')).toEqual([])
  })
})

async function mountPalette() {
  const open = ref(true)
  const wrapper = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(CommandPalette, { open: open.value, 'onUpdate:open': (value: boolean) => (open.value = value) }),
    }),
    { attachTo: document.body, global: { stubs: { Icon: true } } },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, open }
}
const input = () => document.querySelector<HTMLInputElement>('.admin-command input')!
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
async function key(name: string) {
  input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await nextTick()
}

describe('命令面板', () => {
  it('打开即聚焦输入框，组合框指向当前选项；方向键循环，回车跳转并关闭', async () => {
    const { open } = await mountPalette()
    expect(document.activeElement).toBe(input())
    expect(document.querySelector('[role="dialog"]')!.getAttribute('aria-modal')).toBe('true')
    const first = options()[0]!
    expect(first.getAttribute('aria-selected')).toBe('true')
    expect(input().getAttribute('aria-activedescendant')).toBe(first.id)
    await key('ArrowUp')
    expect(options().at(-1)!.getAttribute('aria-selected')).toBe('true')
    await key('ArrowDown')
    await key('ArrowDown')
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true')
    await key('Enter')
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/moments/new')
    expect(open.value).toBe(false)
  })

  it('输入后 250ms 搜索文章标题，只取最多 5 篇，点选打开编辑页', async () => {
    vi.useFakeTimers()
    await mountPalette()
    input().value = 'Nuxt'
    input().dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.querySelector('.admin-command__note')!.textContent).toContain('正在搜索文章')
    await vi.advanceTimersByTimeAsync(249)
    expect(mocks.api).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(mocks.api).toHaveBeenCalledWith('/admin/posts', { query: { search: 'Nuxt', page: 1, pageSize: 5 } })
    const titles = options().map((item) => item.textContent?.trim())
    expect(titles).toEqual(['Nuxt 部署笔记', 'Nuxt 主题引擎'])
    options()[1]!.click()
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/posts/9')
  })

  it('文章搜索失败只提示，页面与新建结果照常可用', async () => {
    vi.useFakeTimers()
    mocks.api.mockRejectedValue(new Error('offline'))
    await mountPalette()
    input().value = '文章'
    input().dispatchEvent(new Event('input'))
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('文章搜索失败')
    expect(options().map((item) => item.textContent?.trim())).toContain('新建文章')
  })
})

describe('后台快捷键', () => {
  async function mountShortcuts(markup = '') {
    const palette = ref(false)
    document.body.insertAdjacentHTML('beforeend', `<main class="admin-main" id="shortcut-host">${markup}</main>`)
    const wrapper = await mountSuspended(defineComponent({ setup: () => (useAdminShortcuts(palette), () => h('div')) }))
    wrappers.push({ unmount: () => (wrapper.unmount(), document.getElementById('shortcut-host')?.remove()) })
    return palette
  }
  const press = (init: KeyboardEventInit, target: EventTarget = document.body) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  it('Ctrl/⌘ + K 开关面板并阻止全站搜索', async () => {
    const palette = await mountShortcuts()
    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(palette.value).toBe(true)
    press({ key: 'K', metaKey: true })
    expect(palette.value).toBe(false)
    press({ key: 'k', ctrlKey: true, shiftKey: true })
    expect(palette.value).toBe(false)
  })

  it('/ 聚焦筛选栏搜索框，n 触发页头主操作；输入中、修饰键或模态层打开时不生效', async () => {
    await mountShortcuts(
      `<header class="admin-page-header"><button class="admin-btn--primary" id="create">新建</button></header>
       <form class="admin-filter-bar"><input type="search" id="search" /></form>`,
    )
    const create = vi.fn()
    document.getElementById('create')!.addEventListener('click', create)
    const search = document.getElementById('search') as HTMLInputElement
    expect(press({ key: '/' }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(search)
    expect(press({ key: 'n' }, search).defaultPrevented).toBe(false)
    expect(create).not.toHaveBeenCalled()
    search.blur()
    press({ key: 'n', ctrlKey: true })
    expect(create).not.toHaveBeenCalled()
    press({ key: 'n' })
    expect(create).toHaveBeenCalledTimes(1)
    document.body.insertAdjacentHTML('beforeend', '<div aria-modal="true" id="modal"></div>')
    press({ key: 'n' })
    expect(create).toHaveBeenCalledTimes(1)
    document.getElementById('modal')!.remove()
  })

  it('页面没有筛选栏或主操作时不拦截按键', async () => {
    await mountShortcuts()
    expect(press({ key: '/' }).defaultPrevented).toBe(false)
    expect(press({ key: 'n' }).defaultPrevented).toBe(false)
  })
})
