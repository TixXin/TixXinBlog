/**
 * @file layoutTheme.test.ts
 * @description 主题门面回归：元信息单一事实源、切换事务（预热→提交→回滚→提示）、并发/迟到选择、
 *              滚动焦点恢复、预热错误记录与非法主题回退
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useNuxtApp, useState } from '#app'
import { useLayoutTheme } from '../../app/composables/useLayoutTheme'
import { themeHostConfigs } from '../../app/features/appearance/themeRegistry'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    currentTheme: ref('nexus'),
    availableThemes: ref<string[]>(['nexus', 'aurora', 'dock']),
    setTheme: vi.fn<(id: string) => boolean>(),
    isPreview: vi.fn<() => boolean>(),
    preload: vi.fn<(id: string) => Promise<void>>(),
    capture: vi.fn(() => ({ windowY: 480, scrollTops: [120, 0], focusKey: 'search', focusId: 'search-input' })),
    restore: vi.fn(),
    error: vi.fn(),
  }
})

// 主题偏好由宿主 useThemeRuntime 持有；这里替换为可控 ref，专注门面的事务与元信息
vi.mock('~/composables/useThemeRuntime', () => ({
  useThemeRuntime: () => ({
    currentTheme: mocks.currentTheme,
    currentSource: { value: 'cookie' },
    availableThemes: mocks.availableThemes,
    setTheme: mocks.setTheme,
    isPreview: mocks.isPreview,
  }),
}))
vi.mock('~/utils/themeRuntime', () => ({ preloadLayoutTheme: mocks.preload }))
vi.mock('~/utils/themeSwitchScroll', () => ({
  captureThemeSwitchSnapshot: mocks.capture,
  restoreThemeSwitchSnapshot: mocks.restore,
}))
mockNuxtImport('useToast', () => () => ({ error: mocks.error }))

const stateKeys = [
  'layout-theme-switch-state',
  'layout-theme-switch-version',
  'layout-theme-preload-errors',
  'app-theme-switch-loading',
]

const zhMessages = {
  loadFailed: '主题加载失败，当前布局已保留。恢复网络后请刷新重试。',
  preloadFailed: '主题资源未就绪，切换失败时请刷新重试。',
}

beforeEach(() => {
  clearNuxtState(stateKeys)
  mocks.currentTheme.value = 'nexus'
  mocks.availableThemes.value = ['nexus', 'aurora', 'dock']
  mocks.preload.mockReset().mockResolvedValue(undefined)
  mocks.setTheme.mockReset().mockImplementation((id: string) => {
    mocks.currentTheme.value = id
    return true
  })
  mocks.isPreview.mockReset().mockReturnValue(false)
  mocks.capture.mockClear()
  mocks.restore.mockReset()
  mocks.error.mockReset()
})

afterEach(() => {
  clearNuxtState(stateKeys)
})

function setup() {
  return useNuxtApp().runWithContext(() => useLayoutTheme())
}

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const isLoading = () => useState<boolean>('app-theme-switch-loading').value

describe('主题元信息', () => {
  it('按宿主登记顺序展示引擎与宿主共同注册的主题，名称/介绍/版本/图标只来自 theme.json', () => {
    const state = setup()
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['nexus', 'aurora', 'dock'])
    expect(state.activeTheme.value).toEqual({
      id: 'nexus',
      name: 'Nexus 三栏',
      description: '经典三栏 App-Shell：左侧导航 + 中间内容 + 右侧侧边栏',
      version: '2.0.0',
      icon: 'lucide:layout-dashboard',
      capabilities: themeHostConfigs.nexus!.capabilities,
    })
    expect(state.availableThemes.value.find((theme) => theme.id === 'aurora')).toMatchObject({
      name: 'Aurora 双栏',
      version: '2.0.0',
      icon: 'lucide:sunrise',
      capabilities: themeHostConfigs.aurora!.capabilities,
    })
    expect(state.availableThemes.value.find((theme) => theme.id === 'dock')).toMatchObject({
      name: 'Dock 浮岛',
      version: '2.0.0',
      icon: 'lucide:panel-bottom',
      capabilities: themeHostConfigs.dock!.capabilities,
    })
  })

  it('只展示运行时可用且宿主已登记的主题，列表跟随运行时变化', () => {
    mocks.availableThemes.value = ['aurora', 'unregistered-theme']
    const state = setup()
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['aurora'])
    mocks.availableThemes.value = ['nexus', 'dock']
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['nexus', 'dock'])
  })

  it('当前主题非法或未注册时回退默认主题 nexus 的元信息', () => {
    mocks.currentTheme.value = 'unknown-theme'
    const state = setup()
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.activeTheme.value.id).toBe('nexus')
    expect(state.activeTheme.value.capabilities).toEqual(themeHostConfigs.nexus!.capabilities)
  })
})

describe('主题名称跟随界面语言', () => {
  const i18n = () => useNuxtApp().$i18n

  // 首次切到 en 会按需编译整份英文词典；冷启动耗时放在 hook 里，不让业务断言吃单个用例的 5s 超时
  beforeAll(async () => {
    await i18n().setLocale('en')
  }, 30000)

  afterAll(async () => {
    await i18n().setLocale('zh-CN')
  })

  // 首次按需编译整份语言词典在并行门禁下可超过默认 5s；这是环境冷启动成本，不是业务校验放宽
  it('theme.json 写字典 key 时按当前语言翻译，切回中文逐字恢复', async () => {
    const state = setup()
    expect(state.availableThemes.value.map((theme) => theme.name)).toEqual([
      'Nexus three-column',
      'Aurora two-column',
      'Dock floating bar',
    ])
    expect(state.activeTheme.value.description).toBe(
      'Classic three-column app shell: navigation on the left, content in the middle, sidebar on the right',
    )
    await i18n().setLocale('zh-CN')
    expect(state.activeTheme.value.name).toBe('Nexus 三栏')
    await i18n().setLocale('en')
  }, 30000)

  it('英文界面下切换失败与预热失败提示为英文', async () => {
    mocks.preload.mockRejectedValueOnce(new Error('资源不可用'))
    const state = setup()
    await expect(state.setLayoutTheme('dock')).resolves.toBe(false)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
      "Couldn't load the theme, so the current layout was kept. Refresh to try again once you're back online.",
    )
    mocks.preload.mockRejectedValueOnce(new Error('资源不可用'))
    state.preloadTheme('aurora')
    await flushPromises()
    expect(state.preloadErrors.value).toEqual({
      aurora: "Theme resources aren't ready yet. If switching fails, refresh and try again.",
    })
  }, 30000)
})

describe('主题切换事务', () => {
  it('切换成功返回 true：先预热再提交，并恢复切换前的滚动与焦点', async () => {
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const switching = state.setLayoutTheme('dock')
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('loading')
    expect(isLoading()).toBe(true)
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('dock')
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.capture).toHaveBeenCalledTimes(1)
    expect(mocks.restore).not.toHaveBeenCalled()
    pending.resolve()
    await expect(switching).resolves.toBe(true)
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('dock')
    expect(state.currentThemeId.value).toBe('dock')
    expect(state.activeTheme.value.id).toBe('dock')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    expect(mocks.restore).toHaveBeenCalledExactlyOnceWith(mocks.capture.mock.results[0]!.value)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('重复选择当前主题直接成功，不预热、不提交、不进入加载态', async () => {
    const state = setup()
    await expect(state.setLayoutTheme('nexus')).resolves.toBe(true)
    expect(mocks.preload).not.toHaveBeenCalled()
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it.each(['unknown-theme', ''])('非法选择 %j 回退默认主题 nexus 并在资源就绪后生效', async (id) => {
    mocks.currentTheme.value = 'dock'
    const state = setup()
    await expect(state.setLayoutTheme(id)).resolves.toBe(true)
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(state.currentThemeId.value).toBe('nexus')
  })

  it('停用当前主题回到默认 nexus', async () => {
    mocks.currentTheme.value = 'aurora'
    const state = setup()
    state.disableCurrentTheme()
    await vi.waitFor(() => expect(state.switchingState.value).toBe('idle'))
    expect(state.currentThemeId.value).toBe('nexus')
    expect(isLoading()).toBe(false)
  })
})

describe('主题切换失败与恢复', () => {
  it('预热失败返回 false，保留原主题、提示错误且不恢复滚动快照', async () => {
    mocks.preload.mockRejectedValueOnce(new Error('资源不可用'))
    const state = setup()
    await expect(state.setLayoutTheme('dock')).resolves.toBe(false)
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('dock')
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('error')
    expect(isLoading()).toBe(false)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(zhMessages.loadFailed)
  })

  it('失败后 resetSwitchState 清掉错误态，重试成功恢复 idle', async () => {
    mocks.preload.mockRejectedValueOnce(new Error('资源不可用'))
    const state = setup()
    await expect(state.setLayoutTheme('dock')).resolves.toBe(false)
    expect(state.switchingState.value).toBe('error')
    state.resetSwitchState()
    expect(state.switchingState.value).toBe('idle')
    await expect(state.setLayoutTheme('dock')).resolves.toBe(true)
    expect(state.currentThemeId.value).toBe('dock')
    expect(state.switchingState.value).toBe('idle')
    expect(state.preloadErrors.value).toEqual({})
  })

  it('引擎拒绝提交（返回 false）时不改变主题，返回 false 并提示', async () => {
    mocks.setTheme.mockImplementationOnce(() => false)
    const state = setup()
    await expect(state.setLayoutTheme('dock')).resolves.toBe(false)
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('dock')
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('error')
    expect(isLoading()).toBe(false)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(zhMessages.loadFailed)
  })

  it('引擎提交后才抛错时回滚到上一主题', async () => {
    mocks.setTheme.mockImplementationOnce((id: string) => {
      mocks.currentTheme.value = id
      throw new Error('主题提交失败')
    })
    const state = setup()
    await expect(state.setLayoutTheme('dock')).resolves.toBe(false)
    expect(mocks.setTheme.mock.calls).toEqual([['dock'], ['nexus']])
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('error')
    expect(isLoading()).toBe(false)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(zhMessages.loadFailed)
  })
})

describe('并发与迟到选择', () => {
  it.each(['resolve', 'reject'])('旧的预热请求迟到 %s 不覆盖较新的选择', async (result) => {
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const previous = state.setLayoutTheme('dock')
    await expect(state.setLayoutTheme('aurora')).resolves.toBe(true)
    if (result === 'resolve') pending.resolve()
    else pending.reject(new Error('旧资源失败'))
    await expect(previous).resolves.toBe(false)
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('aurora')
    expect(mocks.restore).toHaveBeenCalledTimes(1)
    expect(state.currentThemeId.value).toBe('aurora')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('旧请求结束时不关闭仍在等待的新请求提示', async () => {
    const previousPreload = deferred()
    const currentPreload = deferred()
    mocks.preload.mockReturnValueOnce(previousPreload.promise).mockReturnValueOnce(currentPreload.promise)
    const first = setup()
    const second = setup()
    const previous = first.setLayoutTheme('dock')
    const current = second.setLayoutTheme('aurora')
    previousPreload.resolve()
    await expect(previous).resolves.toBe(false)
    expect(first.switchingState.value).toBe('loading')
    expect(second.switchingState.value).toBe('loading')
    expect(isLoading()).toBe(true)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    currentPreload.resolve()
    await expect(current).resolves.toBe(true)
    expect(first.currentThemeId.value).toBe('aurora')
    expect(first.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it('等待期间重新选择当前布局会取消旧意图，迟到资源不再切走主题', async () => {
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const previous = state.setLayoutTheme('dock')
    await expect(state.setLayoutTheme('nexus')).resolves.toBe(true)
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    pending.resolve()
    await expect(previous).resolves.toBe(false)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(state.currentThemeId.value).toBe('nexus')
    expect(mocks.error).not.toHaveBeenCalled()
  })
})

describe('主题预热与错误记录', () => {
  it('预热失败按主题记录，成功后只清理该主题的错误', async () => {
    mocks.preload
      .mockRejectedValueOnce(new Error('Dock 资源不可用'))
      .mockRejectedValueOnce(new Error('Aurora 资源不可用'))
    const state = setup()
    state.preloadTheme('dock')
    state.preloadTheme('aurora')
    await flushPromises()
    expect(state.preloadErrors.value).toEqual({
      dock: zhMessages.preloadFailed,
      aurora: zhMessages.preloadFailed,
    })
    state.preloadTheme('dock')
    await flushPromises()
    expect(state.preloadErrors.value).toEqual({ aurora: zhMessages.preloadFailed })
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('未知主题预热使用默认主题资源', async () => {
    const state = setup()
    state.preloadTheme('missing-theme')
    await flushPromises()
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(state.preloadErrors.value).toEqual({})
  })
})
