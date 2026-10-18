/** @vitest-environment node */
/** @file themeCookie.test.ts @description 主题引擎 cookie 读写与服务端、客户端初值一致性的单元回归 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { themeEngineOptions, themeEngineThemeNames, themeEngineThemes } from '#build/theme-engine.options.mjs'

type ThemeEngine = ReturnType<
  typeof import('@tixxin/nuxt-theme-engine/runtime/composables/useThemeEngine.js').useThemeEngine
>

const require = createRequire(import.meta.url)
const enginePath = require.resolve('@tixxin/nuxt-theme-engine/runtime/composables/useThemeEngine.js')
// 与 manifestLifecycle 用例相同，执行安装包原实现，仅注入模块边界和编译环境常量。
// 此处覆盖 SSR 分支的状态决策，不代替真实浏览器的服务端渲染与水合验收。
const environmentKey = ['import', 'meta'].join('.')
const source = readFileSync(enginePath, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll(`${environmentKey}.client`, 'isClient')
  .replaceAll(`${environmentKey}.server`, '!isClient')
  .replace('export function useThemeEngine()', 'function useThemeEngine()')
const loadThemeEngine = new Function(
  'computed',
  'readonly',
  'watch',
  'useCookie',
  'useRoute',
  'useState',
  'themeEngineOptions',
  'themeEngineThemeNames',
  'themeEngineThemes',
  'isClient',
  'window',
  `${source}\nreturn useThemeEngine`,
)
const themeIds = ['nexus', 'dock', 'aurora'] as const
const scopes: ReturnType<typeof effectScope>[] = []

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

function setup(options: { client: boolean; cookie?: unknown; query?: unknown; storage?: string; payload?: string }) {
  const cookieValue = ref(options.cookie)
  const cookieWrites: unknown[] = []
  const cookie = computed({
    get: () => cookieValue.value,
    set: (value) => {
      cookieWrites.push(value)
      cookieValue.value = value
    },
  })
  const useCookie = vi.fn((_key: string) => cookie)
  const states = new Map<string, Ref<string>>()
  if (options.payload !== undefined) states.set('theme-engine:current-theme', ref(options.payload))
  const useState = (key: string, initialize: () => string) => {
    if (!states.has(key)) states.set(key, ref(initialize()))
    return states.get(key)!
  }
  const storage = {
    getItem: vi.fn(() => options.storage ?? null),
    setItem: vi.fn(),
  }
  const useEngine = loadThemeEngine(
    computed,
    readonly,
    watch,
    useCookie,
    () => ({ query: { theme: options.query } }),
    useState,
    themeEngineOptions,
    themeEngineThemeNames,
    themeEngineThemes,
    options.client,
    options.client ? { localStorage: storage } : undefined,
  ) as () => ThemeEngine
  const scope = effectScope()
  scopes.push(scope)
  const engine = scope.run(useEngine)!
  return { engine, cookieValue, cookieWrites, useCookie, storage }
}

it('沿用项目配置的 cookie 键、默认主题和三个正式主题', () => {
  expect(themeEngineOptions.cookieKey).toBe('blog-layout-theme')
  expect(themeEngineOptions.defaultTheme).toBe('nexus')
  expect([...themeEngineThemeNames].sort()).toEqual([...themeIds].sort())
})

describe.each([
  { name: '服务端', client: false },
  { name: '客户端', client: true },
])('$name 读取主题 cookie', ({ client }) => {
  it.each(themeIds)('有效的 %s cookie 决定初值，优先于旧的本地存储', (theme) => {
    const state = setup({ client, cookie: theme, storage: theme === 'dock' ? 'aurora' : 'dock' })

    expect(state.engine.currentTheme.value).toBe(theme)
    expect(state.useCookie).toHaveBeenCalledWith('blog-layout-theme')
    expect(state.useCookie.mock.calls.every(([key]) => key === 'blog-layout-theme')).toBe(true)
    expect(state.storage.getItem).not.toHaveBeenCalled()
    if (client) {
      expect(state.cookieWrites).toEqual([theme])
      expect(state.storage.setItem).toHaveBeenCalledWith('theme-engine:storage', theme)
    } else {
      expect(state.cookieWrites).toEqual([])
      expect(state.storage.setItem).not.toHaveBeenCalled()
    }
  })

  it.each([
    { label: '缺失', value: undefined },
    { label: '空值', value: null },
    { label: '空字符串', value: '' },
    { label: '未知主题', value: 'unknown-theme' },
    { label: '大小写不符', value: 'NEXUS' },
    { label: '带空格', value: ' dock ' },
    { label: '数组', value: ['aurora'] },
    { label: '对象', value: { theme: 'dock' } },
    { label: '数字', value: 42 },
    { label: '布尔值', value: true },
  ])('$label cookie 在没有旧存储时回退到 nexus', ({ value }) => {
    const state = setup({ client, cookie: value })

    expect(state.engine.currentTheme.value).toBe('nexus')
    expect(state.cookieWrites).toEqual(client ? ['nexus'] : [])
  })

  it('合法 URL 主题优先于 cookie，非法 URL 主题仍使用 cookie', () => {
    expect(setup({ client, query: 'aurora', cookie: 'dock' }).engine.currentTheme.value).toBe('aurora')
    expect(setup({ client, query: 'unknown-theme', cookie: 'dock' }).engine.currentTheme.value).toBe('dock')
    expect(setup({ client, query: ['aurora'], cookie: 'dock' }).engine.currentTheme.value).toBe('dock')
  })
})

it.each(['dock', 'aurora'])('客户端切换到 %s 后写回 cookie，新的页面读取同一主题', async (theme) => {
  const state = setup({ client: true, cookie: 'nexus' })
  state.cookieWrites.length = 0
  state.storage.setItem.mockClear()

  expect(state.engine.setTheme(theme)).toBe(true)
  await nextTick()

  expect(state.engine.currentTheme.value).toBe(theme)
  expect(state.cookieWrites).toEqual([theme])
  expect(state.cookieValue.value).toBe(theme)
  expect(state.storage.setItem).toHaveBeenCalledExactlyOnceWith('theme-engine:storage', theme)
  expect(setup({ client: true, cookie: state.cookieValue.value }).engine.currentTheme.value).toBe(theme)
})

it.each(['', 'unknown-theme', 'DOCK', ' aurora ', '__proto__'])('拒绝非法切换 %j，不污染有效 cookie', async (theme) => {
  const state = setup({ client: true, cookie: 'dock' })
  state.cookieWrites.length = 0
  state.storage.setItem.mockClear()

  expect(state.engine.setTheme(theme)).toBe(false)
  await nextTick()

  expect(state.engine.currentTheme.value).toBe('dock')
  expect(state.cookieValue.value).toBe('dock')
  expect(state.cookieWrites).toEqual([])
  expect(state.storage.setItem).not.toHaveBeenCalled()
})

it('重复选择当前主题不会重复写入 cookie', async () => {
  const state = setup({ client: true, cookie: 'dock' })
  state.cookieWrites.length = 0
  state.storage.setItem.mockClear()

  expect(state.engine.setTheme('dock')).toBe(true)
  await nextTick()

  expect(state.cookieWrites).toEqual([])
  expect(state.storage.setItem).not.toHaveBeenCalled()
})

it.each([...themeIds, undefined, 'unknown-theme'])('相同 cookie %j 在 SSR 与客户端恢复时得到一致初值', (cookie) => {
  const server = setup({ client: false, cookie })
  const client = setup({ client: true, cookie, payload: server.engine.currentTheme.value })

  expect(client.engine.currentTheme.value).toBe(server.engine.currentTheme.value)
  expect(server.cookieWrites).toEqual([])
  expect(server.storage.getItem).not.toHaveBeenCalled()
  expect(server.storage.setItem).not.toHaveBeenCalled()
})
