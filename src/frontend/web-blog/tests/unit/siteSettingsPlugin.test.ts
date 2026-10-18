/**
 * @file siteSettingsPlugin.test.ts
 * @description 站点资料插件在水合期间不改写资料，水合完成后再补读，避免后端恢复瞬间的水合不匹配
 */
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import siteSettingsPlugin from '~/plugins/site-settings'

const { site } = vi.hoisted(() => ({
  site: { available: { value: false }, refresh: vi.fn(async () => {}) },
}))
mockNuxtImport('useSiteSettings', () => () => site)

function fakeApp(isHydrating: boolean) {
  const hooks = new Map<string, () => unknown>()
  return {
    app: {
      isHydrating,
      hooks: { hookOnce: vi.fn((name: string, fn: () => unknown) => hooks.set(name, fn)) },
    },
    hooks,
  }
}

type PluginSetup = (app: unknown) => Promise<void>
const runPlugin = siteSettingsPlugin as unknown as PluginSetup

describe('站点资料插件', () => {
  beforeEach(() => {
    site.available.value = false
    site.refresh.mockClear()
  })

  it('SSR 已取得资料时浏览器不重复读取', async () => {
    site.available.value = true
    const { app } = fakeApp(true)
    await runPlugin(app)
    expect(site.refresh).not.toHaveBeenCalled()
    expect(app.hooks.hookOnce).not.toHaveBeenCalled()
  })

  it('SSR 读取失败时等水合完成后才补读，水合期间资料保持服务端结果', async () => {
    const { app, hooks } = fakeApp(true)
    await runPlugin(app)
    expect(site.refresh).not.toHaveBeenCalled()
    expect(app.hooks.hookOnce).toHaveBeenCalledWith('app:suspense:resolve', expect.any(Function))
    await hooks.get('app:suspense:resolve')?.()
    expect(site.refresh).toHaveBeenCalledTimes(1)
  })

  it('没有服务端结果的纯客户端渲染立即读取', async () => {
    const { app } = fakeApp(false)
    await runPlugin(app)
    expect(site.refresh).toHaveBeenCalledTimes(1)
    expect(app.hooks.hookOnce).not.toHaveBeenCalled()
  })
})
