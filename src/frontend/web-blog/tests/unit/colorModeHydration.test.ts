/** @vitest-environment node */
/**
 * @file colorModeHydration.test.ts
 * @description 执行真实颜色插件，验证服务端默认值、请求隔离与客户端水合时序
 */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Window } from 'happy-dom'
import { computed, effectScope, nextTick, reactive, ref, watch, type EffectScope, type Ref } from 'vue'
import {
  cookieAttrs,
  dataValue,
  disableTransition,
  globalName,
  preference,
  script,
  storage,
  storageKey,
} from '#build/color-mode-options.mjs'

interface ColorModeState {
  preference: string
  value: string
  unknown: boolean
  forced: boolean
}

const moduleUrl = import.meta.resolve('@nuxtjs/color-mode')
const scopes: EffectScope[] = []
const windows: Window[] = []

/** 仅替换模块依赖和编译期测试标记，保留安装版本的初始化、监听与水合实现。 */
function pluginSource(side: 'server' | 'client') {
  return readFileSync(new URL(`./runtime/plugin.${side}.js`, moduleUrl), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replaceAll(['import', 'meta', 'test'].join('.'), 'false')
    .replace('export default defineNuxtPlugin', 'return defineNuxtPlugin')
}

const loadServerPlugin = new Function(
  'reactive',
  'ref',
  'defineNuxtPlugin',
  'useHead',
  'useState',
  'useRouter',
  'useCookie',
  'preference',
  'dataValue',
  'storage',
  'storageKey',
  'window',
  'localStorage',
  'sessionStorage',
  pluginSource('server'),
)
const loadClientPlugin = new Function(
  'computed',
  'reactive',
  'watch',
  'defineNuxtPlugin',
  'useRouter',
  'useHead',
  'useState',
  'useCookie',
  'globalName',
  'storageKey',
  'dataValue',
  'disableTransition',
  'storage',
  'cookieAttrs',
  'window',
  'document',
  pluginSource('client'),
)

afterEach(async () => {
  scopes.splice(0).forEach((scope) => scope.stop())
  await Promise.all(windows.splice(0).map((window) => window.happyDOM.close()))
})

function createApp(payload?: ColorModeState) {
  const states = new Map<string, Ref<ColorModeState>>()
  if (payload) states.set('color-mode', ref(payload))
  const hooks = new Map<string, () => void>()
  const app = {
    provide: vi.fn(),
    hook: (name: string, callback: () => void) => hooks.set(name, callback),
  }
  const useState = (key: string, factory: () => ColorModeState) => {
    if (!states.has(key)) states.set(key, ref(factory()))
    return states.get(key)!
  }
  return {
    app,
    hooks,
    useState,
    useHead: vi.fn(),
    useRouter: () => ({ afterEach: vi.fn() }),
    useCookie: vi.fn(),
    get colorMode() {
      return states.get('color-mode')!.value
    },
  }
}

function renderServer() {
  const context = createApp()
  const browserAccess = vi.fn(() => {
    throw new Error('服务端不得访问浏览器存储')
  })
  const browserOnly = new Proxy({}, { get: browserAccess, set: browserAccess })
  const plugin = loadServerPlugin(
    reactive,
    ref,
    (value: unknown) => value,
    context.useHead,
    context.useState,
    context.useRouter,
    context.useCookie,
    preference,
    dataValue,
    storage,
    storageKey,
    browserOnly,
    browserOnly,
    browserOnly,
  )
  plugin(context.app)
  return { context, browserAccess }
}

function hydrateClient(payload: ColorModeState | undefined, stored: string, dark: boolean) {
  const context = createApp(payload)
  const browserWindow = new Window()
  windows.push(browserWindow)
  const page = browserWindow.document
  const storageData = new Map([[storageKey, stored]])
  const browser = {
    document: page,
    localStorage: {
      getItem: vi.fn((key: string) => storageData.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storageData.set(key, value)),
    },
    matchMedia: vi.fn((query: string) => ({
      matches: query.includes('dark') ? dark : !dark,
      media: query,
      addEventListener: vi.fn(),
    })),
    getComputedStyle: browserWindow.getComputedStyle.bind(browserWindow),
  }
  // 首屏帮助对象由项目生成脚本创建，客户端插件再读取同一对象。
  runInNewContext(script, { window: browser, document: page })
  const plugin = loadClientPlugin(
    computed,
    reactive,
    watch,
    (value: unknown) => value,
    context.useRouter,
    context.useHead,
    context.useState,
    context.useCookie,
    globalName,
    storageKey,
    dataValue,
    disableTransition,
    storage,
    cookieAttrs,
    browser,
    page,
  )
  const scope = effectScope()
  scopes.push(scope)
  scope.run(() => plugin(context.app))
  return { context, browser, page, storageData }
}

describe('明暗模式服务端与客户端状态衔接', () => {
  it('SSR 按项目默认值提供未知的深色状态，且不读取浏览器或存储', () => {
    const { context, browserAccess } = renderServer()
    expect(preference).toBe('dark')
    expect(storage).toBe('localStorage')
    expect(context.colorMode).toEqual({ preference: 'dark', value: 'dark', unknown: true, forced: false })
    expect(context.app.provide).toHaveBeenCalledWith('colorMode', context.colorMode)
    expect(context.useCookie).not.toHaveBeenCalled()
    expect(browserAccess).not.toHaveBeenCalled()
  })

  it('不同 SSR 请求各自持有状态，不传播前一请求的颜色和强制标记', () => {
    const first = renderServer().context
    first.colorMode.preference = 'light'
    first.colorMode.value = 'light'
    first.colorMode.forced = true
    const second = renderServer().context
    expect(second.colorMode).not.toBe(first.colorMode)
    expect(second.colorMode).toEqual({ preference: 'dark', value: 'dark', unknown: true, forced: false })
  })

  it.each([
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('持久化 %s、系统深色 %s：水合前保留 SSR 快照，挂载后恢复 %s', async (stored, dark, expected) => {
    const server = renderServer().context
    const snapshot: ColorModeState = JSON.parse(JSON.stringify(server.colorMode))
    const { context, browser, page, storageData } = hydrateClient(snapshot, stored, dark)

    expect(context.colorMode).toEqual(server.colorMode)
    expect(context.colorMode).not.toBe(server.colorMode)
    expect(context.colorMode.unknown).toBe(true)
    expect(page.documentElement.className).toBe(expected)
    expect(browser.localStorage.getItem).toHaveBeenCalledWith(storageKey)
    expect(context.hooks.has('app:mounted')).toBe(true)

    context.hooks.get('app:mounted')!()
    await nextTick()

    expect(context.colorMode).toEqual({ preference: stored, value: expected, unknown: false, forced: false })
    expect(storageData.get(storageKey)).toBe(stored)
    expect(page.documentElement.className).toBe(expected)
    expect(server.colorMode).toEqual({ preference: 'dark', value: 'dark', unknown: true, forced: false })
  })

  it('没有 SSR 载荷时直接从首屏帮助对象初始化客户端状态', () => {
    const { context } = hydrateClient(undefined, 'light', false)
    expect(context.colorMode).toEqual({ preference: 'light', value: 'light', unknown: false, forced: false })
    context.hooks.get('app:mounted')!()
    expect(context.colorMode).toEqual({ preference: 'light', value: 'light', unknown: false, forced: false })
  })
})
