/** @file tabSettingsStorage.test.ts @description 标签页设置的存储读写容错与分组恢复。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { TAB_SETTINGS_DEFAULTS, useTabSettings } from '../../app/composables/useTabSettings'

const wrappers: { unmount(): void }[] = []

async function setup() {
  let state!: ReturnType<typeof useTabSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          state = useTabSettings()
          return () => h('div')
        },
      }),
    ),
  )
  return state
}

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  })
  Reflect.deleteProperty(useNuxtApp().payload.state, '$stab-settings')
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('标签页设置本地存储', () => {
  it('读取已保存的设置并补齐默认项，多实例共享更新且写回存储', async () => {
    localStorage.setItem('tab-settings', JSON.stringify({ viewMode: 'list', iconSize: 64 }))
    const first = await setup()
    const second = await setup()
    expect(first.settings.value).toEqual({ ...TAB_SETTINGS_DEFAULTS, viewMode: 'list', iconSize: 64 })
    first.update('showCounts', false)
    expect(second.settings.value.showCounts).toBe(false)
    expect(JSON.parse(localStorage.getItem('tab-settings')!)).toEqual(first.settings.value)
  })

  it('损坏 JSON 回退默认值且不会覆盖原存储', async () => {
    localStorage.setItem('tab-settings', '{broken')
    const state = await setup()
    expect(state.settings.value).toEqual(TAB_SETTINGS_DEFAULTS)
    expect(localStorage.getItem('tab-settings')).toBe('{broken')
  })

  it('浏览器拒绝存储读取时仍可取得默认设置', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('存储被禁用', 'SecurityError')
    })
    const state = await setup()
    expect(state.settings.value).toEqual(TAB_SETTINGS_DEFAULTS)
  })

  it('访问 localStorage 属性本身被禁止时默认设置和更新均不抛错', async () => {
    const originals = [...new Set([globalThis, window])].map((target) => ({
      target,
      descriptor: Object.getOwnPropertyDescriptor(target, 'localStorage'),
    }))
    try {
      for (const { target } of originals) {
        Object.defineProperty(target, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('浏览器禁止访问 localStorage', 'SecurityError')
          },
        })
      }
      expect(() => window.localStorage).toThrow('浏览器禁止访问 localStorage')
      const state = await setup()
      expect(state.settings.value).toEqual(TAB_SETTINGS_DEFAULTS)
      expect(() => state.update('viewMode', 'list')).not.toThrow()
      expect(state.settings.value.viewMode).toBe('list')
      expect(() => state.resetSection('view')).not.toThrow()
      expect(state.settings.value.viewMode).toBe(TAB_SETTINGS_DEFAULTS.viewMode)
    } finally {
      for (const { target, descriptor } of originals.reverse()) {
        if (descriptor) Object.defineProperty(target, 'localStorage', descriptor)
        else Reflect.deleteProperty(target, 'localStorage')
      }
    }
  })

  it.each(['SecurityError', 'QuotaExceededError'])('%s 写入失败不抛错，当前页面设置仍可调整和恢复', async (name) => {
    const state = await setup()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('存储不可用', name)
    })
    expect(() => state.update('viewMode', 'list')).not.toThrow()
    expect(state.settings.value.viewMode).toBe('list')
    expect(() => state.resetSection('view')).not.toThrow()
    expect(state.settings.value.viewMode).toBe(TAB_SETTINGS_DEFAULTS.viewMode)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('恢复指定分组只改变该组，未知分组不额外写存储', async () => {
    const state = await setup()
    state.update('iconSize', 80)
    state.update('viewMode', 'list')
    state.update('dragEnabled', false)
    state.resetSection('view')
    expect(state.settings.value).toEqual({ ...TAB_SETTINGS_DEFAULTS, iconSize: 80 })
    expect(JSON.parse(localStorage.getItem('tab-settings')!)).toEqual(state.settings.value)
    const write = vi.spyOn(localStorage, 'setItem')
    state.resetSection('unknown')
    expect(write).not.toHaveBeenCalled()
  })
})
