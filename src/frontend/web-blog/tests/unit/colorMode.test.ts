/**
 * @file colorMode.test.ts
 * @description 明暗模式回归：实际持久化、首屏恢复、禁用存储与减少动态效果
 */
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { script, storage, storageKey, preference, fallback } from '#build/color-mode-options.mjs'
import { useTheme } from '../../app/composables/useTheme'
import { hasColorMotion, settleColorMotion } from '../../app/utils/colorMotion'

const wrappers: { unmount(): void }[] = []
let originalPreference: string
let originalPreset: unknown
let originalStored: string | null

beforeEach(() => {
  originalPreference = useColorMode().preference
  originalPreset = useState('appearance-color-mode-transition-preset').value
  originalStored = localStorage.getItem(storageKey)
})

afterEach(async () => {
  // 先结束颜色事务，再恢复 Nuxt 单例，避免下一例继承动画或偏好写入。
  settleColorMotion(document)
  await vi.waitFor(() => expect(hasColorMotion(document)).toBe(false))
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  useColorMode().preference = originalPreference
  useState('appearance-color-mode-transition-preset').value = originalPreset
  await nextTick()
  if (originalStored === null) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, originalStored)
})

async function mountTheme() {
  let theme!: ReturnType<typeof useTheme>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useColorMode().preference = 'light'
          useState('appearance-color-mode-transition-preset').value = 'none'
          theme = useTheme()
          return () => h('span', theme.currentPreference.value)
        },
      }),
    ),
  )
  await nextTick()
  return theme
}

/** 执行模块按本项目配置生成的真实首屏脚本，不复制存储和系统配色判定逻辑。 */
function readStartup(options: { stored?: string; dark?: boolean; unavailable?: boolean } = {}) {
  const page = document.implementation.createHTMLDocument()
  const getItem = vi.fn((key: string) => {
    expect(key).toBe(storageKey)
    if (options.unavailable) throw new DOMException('存储被禁用', 'SecurityError')
    return options.stored ?? null
  })
  const browser = {
    document: page,
    localStorage: { getItem },
    matchMedia: (query: string) => ({
      media: query,
      matches: query === `(prefers-color-scheme:${options.dark ? 'dark' : 'light'})`,
    }),
  }
  runInNewContext(script, { window: browser, document: page })
  const result = browser as typeof browser & { __NUXT_COLOR_MODE__: { preference: string; value: string } }
  return { colorMode: result.__NUXT_COLOR_MODE__, page, getItem }
}

describe('明暗模式首屏恢复', () => {
  it('沿用公开的本地持久化键与深色默认值', () => {
    expect(storage).toBe('localStorage')
    expect(storageKey).toBe('nuxt-color-mode')
    expect(preference).toBe('dark')
    expect(fallback).toBe('dark')
    const { colorMode, page } = readStartup()
    expect(colorMode).toMatchObject({ preference: 'dark', value: 'dark' })
    expect(page.documentElement.className).toBe('dark')
  })

  it.each(['light', 'dark'])('页面重载恢复 %s，覆盖默认值并使用无后缀根类名', (stored) => {
    const { colorMode, page, getItem } = readStartup({ stored })
    expect(colorMode).toMatchObject({ preference: stored, value: stored })
    expect(page.documentElement.className).toBe(stored)
    expect(getItem).toHaveBeenCalledOnce()
  })

  it.each([false, true])('跟随系统保留 system 偏好，系统深色为 %s', (dark) => {
    const { colorMode, page } = readStartup({ stored: 'system', dark })
    expect(colorMode).toMatchObject({ preference: 'system', value: dark ? 'dark' : 'light' })
    expect(page.documentElement.className).toBe(dark ? 'dark' : 'light')
  })

  it('读取存储抛异常时仍以默认深色完成首屏初始化', () => {
    const { colorMode, page, getItem } = readStartup({ unavailable: true })
    expect(getItem).toHaveBeenCalledOnce()
    expect(colorMode).toMatchObject({ preference: 'dark', value: 'dark' })
    expect(page.documentElement.className).toBe('dark')
  })
})

describe('明暗切换与持久化', () => {
  it('light、dark、system 经真实颜色插件写入存储，并在再次读取时恢复', async () => {
    const theme = await mountTheme()
    expect(theme.themeOptions).toEqual(['light', 'system', 'dark'])
    for (const target of ['dark', 'system', 'light'] as const) {
      theme.setTheme(target)
      await nextTick()
      expect(theme.currentPreference.value).toBe(target)
      expect(localStorage.getItem(storageKey)).toBe(target)
      expect(readStartup({ stored: localStorage.getItem(storageKey)! }).colorMode.preference).toBe(target)
    }
  })

  it('重复选择当前模式不会重写存储或创建动效', async () => {
    const theme = await mountTheme()
    const write = vi.spyOn(window.localStorage, 'setItem')
    theme.setTheme('light')
    await nextTick()
    expect(write).not.toHaveBeenCalled()
    expect(hasColorMotion(document)).toBe(false)
  })

  it('存储写入被拒绝时仍可切换，恢复存储后下一次选择继续持久化', async () => {
    const theme = await mountTheme()
    const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('容量已满', 'QuotaExceededError')
    })
    theme.setTheme('dark')
    await nextTick()
    expect(theme.currentPreference.value).toBe('dark')
    expect(useColorMode().value).toBe('dark')
    expect(write).toHaveBeenCalledWith(storageKey, 'dark')
    expect(localStorage.getItem(storageKey)).toBe('light')
    write.mockRestore()
    theme.setTheme('system')
    await nextTick()
    expect(theme.currentPreference.value).toBe('system')
    expect(localStorage.getItem(storageKey)).toBe('system')
  })

  it('减少动态效果时立即应用并持久化偏好，不启动 View Transition', async () => {
    const theme = await mountTheme()
    useState('appearance-color-mode-transition-preset').value = 'circle'
    const originalMatchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const result = originalMatchMedia(query)
      return query === '(prefers-reduced-motion: reduce)' ? { ...result, matches: true } : result
    })
    const start = vi.fn()
    const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition')
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    try {
      theme.setTheme('dark')
      await flushPromises()
      expect(theme.currentPreference.value).toBe('dark')
      expect(localStorage.getItem(storageKey)).toBe('dark')
      expect(start).not.toHaveBeenCalled()
    } finally {
      if (original) Object.defineProperty(document, 'startViewTransition', original)
      else Reflect.deleteProperty(document, 'startViewTransition')
    }
  })
})
