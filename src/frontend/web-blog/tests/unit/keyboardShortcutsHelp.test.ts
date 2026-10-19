/** @file keyboardShortcutsHelp.test.ts @description 公开站点快捷键帮助的触发边界、现有快捷键与模态焦点回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useKeyboardShortcuts } from '../../app/composables/useKeyboardShortcuts'
import KeyboardShortcutsHelp from '../../app/components/common/KeyboardShortcutsHelp.vue'

const mocks = vi.hoisted(() => ({
  // query 供 i18n 插件在测试应用启动时读取路由，缺失会导致界面语言未安装
  route: { path: '/', name: 'index', params: {} as Record<string, string>, query: {} },
  drawer: { value: false },
  settings: { value: { commandPaletteEnabled: true } },
  closeDrawer: vi.fn(),
  search: vi.fn(),
  palette: vi.fn(),
  info: vi.fn(),
  scroll: vi.fn(),
}))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useAppearanceSettings', () => () => ({
  isDrawerOpen: mocks.drawer,
  closeDrawer: mocks.closeDrawer,
}))
mockNuxtImport('useToast', () => () => ({ info: mocks.info }))
mockNuxtImport('useTabCommandPalette', () => () => ({ open: mocks.palette }))
mockNuxtImport('useTabSettings', () => () => ({ settings: mocks.settings }))
vi.mock('../../app/utils/scrollRoot', () => ({
  resolveScrollRoot: () => null,
  scrollToRoot: (...args: unknown[]) => mocks.scroll(...args),
}))

const wrappers: { unmount(): void }[] = []
const ownedElements: HTMLElement[] = []
beforeEach(() => {
  vi.clearAllMocks()
  mocks.route = reactive({ path: '/', name: 'index', params: {}, query: {} })
  mocks.drawer = ref(false)
  mocks.settings = ref({ commandPaletteEnabled: true })
  // DOM 单测没有布局；只补尺寸可见性，保留真实模态焦点、背景隔离和事件监听逻辑。
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    new DOMRect(0, 0, 100, 40),
  ] as unknown as DOMRectList)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  ownedElements.splice(0).forEach((element) => element.remove())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function appendElement(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  ownedElements.push(host)
  return host
}

function press(target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

async function setup() {
  let state!: ReturnType<typeof useKeyboardShortcuts>
  const host = appendElement('')
  host.setAttribute('aria-hidden', 'false')
  host.inert = false
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useKeyboardShortcuts({ open: mocks.search })
        return () =>
          h('div', [
            h('button', { type: 'button', 'data-help-origin': '' }, '页面操作'),
            h(KeyboardShortcutsHelp, {
              visible: state.isShortcutHelpOpen.value,
              'onUpdate:visible': (visible: boolean) => (state.isShortcutHelpOpen.value = visible),
            }),
          ])
      },
    }),
    {
      attachTo: host,
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<slot />' },
        },
      },
    },
  )
  wrappers.push(wrapper)
  await nextTick()
  const origin = wrapper.get<HTMLButtonElement>('[data-help-origin]').element
  origin.focus()
  return { wrapper, state, host, origin }
}

function dialog() {
  const element = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
  expect(element).not.toBeNull()
  return element!
}

describe('快捷键帮助的触发边界', () => {
  it.each([false, true])('公开页面按 ? 打开帮助，兼容 Shift=%s', async (shiftKey) => {
    const { state, origin } = await setup()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(press(origin, { shiftKey }).defaultPrevented).toBe(true)
    expect(state.isShortcutHelpOpen.value).toBe(true)
    await nextTick()
    expect(dialog().textContent).toContain('键盘快捷键')
  })

  it.each([
    '<input />',
    '<textarea></textarea>',
    '<select><option>选项</option></select>',
    '<div contenteditable="true"><span data-target>正文</span></div>',
    '<div contenteditable=""><span data-target>正文</span></div>',
    '<div contenteditable="plaintext-only"><span data-target>正文</span></div>',
    '<div role="textbox"><span data-target>正文</span></div>',
    '<div role="combobox"><span data-target>选项</span></div>',
  ])('在编辑区域输入 ? 不打开帮助：%s', async (html) => {
    const { state } = await setup()
    const host = appendElement(html)
    const target = host.querySelector('[data-target]') ?? host.firstElementChild!
    expect(press(target).defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
  })

  it.each<KeyboardEventInit>([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { repeat: true },
  ])('忽略组合键、输入法和重复按键：%o', async (init) => {
    const { state, origin } = await setup()
    expect(press(origin, init).defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
  })

  it('不处理已消费的事件或 AltGraph 输入', async () => {
    const { state, origin } = await setup()
    const consumed = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true })
    consumed.preventDefault()
    origin.dispatchEvent(consumed)
    expect(state.isShortcutHelpOpen.value).toBe(false)
    const altGraph = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true })
    vi.spyOn(altGraph, 'getModifierState').mockImplementation((key) => key === 'AltGraph')
    origin.dispatchEvent(altGraph)
    expect(altGraph.defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
  })

  it.each(['/admin', '/admin/', '/admin/posts/1'])('后台路由 %s 不打开帮助', async (path) => {
    mocks.route.path = path
    const { state, origin } = await setup()
    expect(press(origin).defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
  })

  it.each([
    '<div role="dialog" aria-modal="true"><button>已有弹层</button></div>',
    '<dialog open><button>已有弹层</button></dialog>',
  ])('已有模态弹层时不抢占焦点：%s', async (html) => {
    const { state } = await setup()
    const existing = appendElement(html).querySelector('button')!
    existing.focus()
    expect(press(existing).defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(document.activeElement).toBe(existing)
  })

  it('外观抽屉已打开时不叠加帮助', async () => {
    const { state, origin } = await setup()
    mocks.drawer.value = true
    expect(press(origin).defaultPrevented).toBe(false)
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(mocks.closeDrawer).not.toHaveBeenCalled()
  })

  it('路径改变时关闭帮助并释放背景', async () => {
    const { state, host, origin } = await setup()
    press(origin)
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(true)
    mocks.route.path = '/posts/archive'
    await nextTick()
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(host.inert).toBe(false)
    expect(host.getAttribute('aria-hidden')).toBe('false')
  })
})

describe('既有快捷键与帮助内容', () => {
  it.each<KeyboardEventInit>([{ ctrlKey: true }, { metaKey: true }])('输入框内仍可打开站内搜索：%o', async (init) => {
    await setup()
    const input = appendElement('<input />').querySelector('input')!
    expect(press(input, { key: 'k', ...init }).defaultPrevented).toBe(true)
    expect(mocks.search).toHaveBeenCalledOnce()
    expect(mocks.palette).not.toHaveBeenCalled()
  })

  it.each([true, false])('/tabs 仅在命令面板启用=%s 时使用书签命令面板', async (enabled) => {
    mocks.route.path = '/tabs'
    mocks.settings.value.commandPaletteEnabled = enabled
    const { origin } = await setup()
    press(origin, { key: 'k', ctrlKey: true })
    expect(mocks.palette).toHaveBeenCalledTimes(enabled ? 1 : 0)
    expect(mocks.search).toHaveBeenCalledTimes(enabled ? 0 : 1)
  })

  it('帮助打开后阻止搜索与文章滚动快捷键穿透，关闭后恢复', async () => {
    mocks.route.path = '/articles/1'
    mocks.route.name = 'articles-id'
    mocks.route.params = { id: '1' }
    const { state, origin } = await setup()
    press(origin)
    await nextTick()
    const close = dialog().querySelector<HTMLButtonElement>('[aria-label="关闭快捷键帮助"]')!
    press(close, { key: 'k', ctrlKey: true })
    press(close, { key: 'k', metaKey: true })
    for (const key of ['j', 'k', 't']) press(close, { key })
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.palette).not.toHaveBeenCalled()
    expect(mocks.scroll).not.toHaveBeenCalled()
    press(close, { key: 'Escape' })
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(false)
    press(origin, { key: 'j' })
    expect(mocks.scroll).toHaveBeenCalledWith(null, 100)
  })

  it('只列出现有快捷键，并解释书签命令、演示文章和主题切换的适用范围', async () => {
    const { origin } = await setup()
    press(origin)
    await nextTick()
    const help = dialog()
    const text = help.textContent ?? ''
    for (const label of ['搜索', '命令面板', '需在书签设置中启用', '关闭时打开站内搜索', 'Esc', '演示', '主题']) {
      expect(text).toContain(label)
    }
    const keys = [...help.querySelectorAll('kbd')].map((element) => element.textContent?.trim())
    for (const key of ['?', 'Ctrl / Cmd + K', 'j / k', 't', '[ / ]', '↑ / ↓', 'Enter']) expect(keys).toContain(key)
    expect(text).toMatch(/主题[\s\S]*(没有|暂无|未设置|无独立)/)
  })
})

describe('快捷键帮助的模态可访问性', () => {
  it('初始关闭入口停留后，一次 Esc 即可关闭帮助', async () => {
    const { state, origin } = await setup()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    press(origin)
    await nextTick()
    // 覆盖曾被关闭按钮提示浮层截获 Escape 的场景，不替换真实提示组件。
    await vi.advanceTimersByTimeAsync(250)
    press(document.activeElement!, { key: 'Escape' })
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(origin)
  })

  it('关联标题与说明、进入焦点、双向 Tab 循环、阻止焦点逃逸，Esc 后归还焦点', async () => {
    const overflow = document.body.style.overflow
    const { state, host, origin } = await setup()
    press(origin)
    await nextTick()
    await nextTick()
    const help = dialog()
    const title = document.getElementById(help.getAttribute('aria-labelledby') ?? '')
    const description = document.getElementById(help.getAttribute('aria-describedby') ?? '')
    expect(title?.textContent).toBe('键盘快捷键')
    expect(description?.textContent?.trim()).toBeTruthy()
    expect(host.contains(help)).toBe(false)
    expect(host.inert).toBe(true)
    expect(host.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    const buttons = [...help.querySelectorAll<HTMLButtonElement>('button')]
    const first = buttons[0]!
    const last = buttons.at(-1)!
    expect(help.contains(document.activeElement)).toBe(true)
    last.focus()
    expect(press(last, { key: 'Tab' }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    expect(press(first, { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    origin.focus()
    expect(help.contains(document.activeElement)).toBe(true)
    expect(press(document.activeElement!, { key: 'Escape' }).defaultPrevented).toBe(true)
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(host.inert).toBe(false)
    expect(host.getAttribute('aria-hidden')).toBe('false')
    expect(document.body.style.overflow).toBe(overflow)
  })

  it('关闭按钮更新 v-model，卸载清理快捷键和模态状态', async () => {
    const overflow = document.body.style.overflow
    const { wrapper, state, host, origin } = await setup()
    press(origin)
    await nextTick()
    dialog().querySelector<HTMLButtonElement>('[aria-label="关闭快捷键帮助"]')!.click()
    await nextTick()
    expect(state.isShortcutHelpOpen.value).toBe(false)
    expect(document.activeElement).toBe(origin)
    press(origin)
    await nextTick()
    wrapper.unmount()
    wrappers.pop()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(host.inert).toBe(false)
    expect(host.getAttribute('aria-hidden')).toBe('false')
    expect(document.body.style.overflow).toBe(overflow)
    expect(press().defaultPrevented).toBe(false)
    expect(press(document.body, { key: 'k', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(mocks.search).not.toHaveBeenCalled()
    const outside = appendElement('<button>页面按钮</button>').querySelector('button')!
    outside.focus()
    expect(document.activeElement).toBe(outside)
    expect(press(outside, { key: 'Tab' }).defaultPrevented).toBe(false)
  })
})
