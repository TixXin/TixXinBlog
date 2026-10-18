/**
 * @file tabSettings.test.ts
 * @description 标签页设置的存储兼容、跨组件共享和分组恢复默认
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { TAB_SETTINGS_DEFAULTS, useTabSettings } from '../../app/composables/useTabSettings'

const storageKey = 'tab-settings'
const wrappers: { unmount(): void }[] = []
const originalStorageMethods = { getItem: localStorage.getItem, setItem: localStorage.setItem }

function restoreStorageMethods() {
  // HappyDOM 的 Storage 代理隐藏方法描述符，不能只依赖 spy 的自动还原。
  for (const [method, value] of Object.entries(originalStorageMethods)) {
    Object.defineProperty(localStorage, method, { configurable: true, writable: true, value })
  }
}

async function setup(reset = true) {
  let state!: ReturnType<typeof useTabSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          if (reset) clearNuxtState('tab-settings')
          state = useTabSettings()
          return () => h('div')
        },
      }),
    ),
  )
  return state
}

beforeEach(() => {
  localStorage.removeItem(storageKey)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  restoreStorageMethods()
  localStorage.removeItem(storageKey)
})

describe('标签页设置', () => {
  it.each([null, '{invalid'])('缺失或损坏的设置 %s 使用完整默认值', async (raw) => {
    if (raw !== null) localStorage.setItem(storageKey, raw)

    const state = await setup()

    expect(state.settings.value).toEqual(TAB_SETTINGS_DEFAULTS)
  })

  it('读取受限时使用默认值，不阻断组件挂载', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('浏览器禁止访问存储', 'SecurityError')
    })

    const state = await setup()

    expect(state.settings.value).toEqual(TAB_SETTINGS_DEFAULTS)
  })

  it('旧版部分设置覆盖对应默认值，未保存的新字段补齐', async () => {
    const saved = { iconSize: 64, searchEngine: 'bing', wallpaperLight: { kind: 'solid', solidColor: '#123456' } }
    localStorage.setItem(storageKey, JSON.stringify(saved))

    const state = await setup()

    expect(state.settings.value).toEqual({ ...TAB_SETTINGS_DEFAULTS, ...saved })
    expect(state.settings.value.faviconAutoFetch).toBe(true)
  })

  it('更新单项保留其他自定义字段，跨组件共享并写入完整配置', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ searchEngine: 'bing', iconSize: 64 }))
    const first = await setup()
    const second = await setup(false)

    first.update('viewMode', 'list')

    expect(second.settings.value).toMatchObject({ searchEngine: 'bing', iconSize: 64, viewMode: 'list' })
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(first.settings.value)
  })

  it('恢复图标分组只重置该组字段，保留布局和搜索偏好', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        iconSize: 64,
        showIconName: false,
        faviconProvider: 'icon-horse',
        viewMode: 'list',
        searchEngine: 'bing',
      }),
    )
    const state = await setup()

    state.resetSection('icon')

    expect(state.settings.value).toEqual({ ...TAB_SETTINGS_DEFAULTS, viewMode: 'list', searchEngine: 'bing' })
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state.settings.value)
  })

  it('恢复壁纸分组同时恢复亮暗壁纸及效果，保留其他分组', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        wallpaperLight: { kind: 'solid', solidColor: '#123456' },
        wallpaperDark: { kind: 'url', url: 'https://example.com/wallpaper.webp' },
        wallpaperIndependent: true,
        wallpaperBlur: 10,
        wallpaperNoise: true,
        showSeconds: true,
      }),
    )
    const state = await setup()

    state.resetSection('wallpaper')

    expect(state.settings.value).toEqual({ ...TAB_SETTINGS_DEFAULTS, showSeconds: true })
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state.settings.value)
  })

  it('未知分组不改变设置也不写入存储', async () => {
    const state = await setup()
    state.update('viewMode', 'compact')
    const previous = state.settings.value
    const write = vi.spyOn(localStorage, 'setItem')

    state.resetSection('unknown')

    expect(state.settings.value).toBe(previous)
    expect(write).not.toHaveBeenCalled()
  })

  it('写入失败仍保留当前会话偏好，存储恢复后可再次持久化', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ viewMode: 'list' }))
    const state = await setup()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('存储空间不足', 'QuotaExceededError')
    })

    expect(() => state.update('viewMode', 'cards')).not.toThrow()
    expect(state.settings.value.viewMode).toBe('cards')
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({ viewMode: 'list' })
    write.mockRestore()
    restoreStorageMethods()
    state.update('showSeconds', true)

    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ viewMode: 'cards', showSeconds: true })
  })
})
