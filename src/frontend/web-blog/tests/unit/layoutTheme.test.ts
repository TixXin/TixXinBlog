/** @file layoutTheme.test.ts @description 主题元信息、切换事务、资源预热与并发选择的单元回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useNuxtApp, useState } from '#app'
import { useLayoutTheme } from '../../app/composables/useLayoutTheme'
import { themeHostConfigs } from '../../app/features/appearance/themeRegistry'

interface ThemeDefinition {
  name: string
  label?: string
  description?: string
  meta?: { version?: string; icon?: string }
}

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    currentTheme: ref('nexus'),
    engineThemeIds: ref<string[]>([]),
    definitions: ref<ThemeDefinition[]>([]),
    setTheme: vi.fn<(id: string) => Promise<boolean>>(),
    preload: vi.fn<(id: string) => Promise<void>>(),
    error: vi.fn(),
  }
})

mockNuxtImport('useThemeEngine', () => () => ({
  currentTheme: mocks.currentTheme,
  availableThemes: mocks.engineThemeIds,
  themeDefinitions: mocks.definitions,
  setTheme: mocks.setTheme,
}))
mockNuxtImport('useToast', () => () => ({ error: mocks.error }))
vi.mock('~/utils/themeRuntime', () => ({ preloadLayoutTheme: mocks.preload }))

const stateKeys = [
  'layout-theme-switch-state',
  'layout-theme-switch-version',
  'layout-theme-preload-errors',
  'app-theme-switch-loading',
]

beforeEach(() => {
  clearNuxtState(stateKeys)
  mocks.currentTheme.value = 'nexus'
  mocks.engineThemeIds.value = ['dock', 'nexus', 'aurora']
  mocks.definitions.value = [
    {
      name: 'nexus',
      label: 'Nexus',
      description: '经典三栏',
      meta: { version: '3.0.0', icon: 'lucide:panels-top-left' },
    },
    { name: 'aurora', label: 'Aurora', description: '极光布局' },
    { name: 'dock', label: 'Dock', description: '底部导航' },
  ]
  mocks.preload.mockReset().mockResolvedValue(undefined)
  mocks.setTheme.mockReset().mockImplementation(async (id) => {
    mocks.currentTheme.value = id
    return true
  })
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
  it('按宿主顺序展示三主题，优先读取引擎元信息并保留宿主能力', () => {
    const state = setup()
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['nexus', 'aurora', 'dock'])
    expect(state.activeTheme.value).toEqual({
      id: 'nexus',
      name: 'Nexus',
      description: '经典三栏',
      version: '3.0.0',
      icon: 'lucide:panels-top-left',
      capabilities: themeHostConfigs.nexus!.capabilities,
    })
    expect(state.availableThemes.value.find((theme) => theme.id === 'dock')).toMatchObject({
      version: '2.0.0',
      icon: 'lucide:panel-bottom',
      capabilities: { leftSidebar: false, rightSidebar: false, customizer: ['colorMode', 'contentTransition'] },
    })
  })

  it('仅展示宿主和引擎共同注册的主题，并跟随引擎列表更新', () => {
    mocks.engineThemeIds.value = ['unregistered', 'dock']
    const state = setup()
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['dock'])
    mocks.engineThemeIds.value = ['aurora', 'nexus']
    expect(state.availableThemes.value.map((theme) => theme.id)).toEqual(['nexus', 'aurora'])
  })

  it('引擎缺失定义时使用主题标识和宿主元信息，未知当前主题回退 Nexus', () => {
    mocks.currentTheme.value = 'missing'
    mocks.definitions.value = []
    const state = setup()
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.activeTheme.value).toEqual({
      id: 'nexus',
      name: 'nexus',
      description: '',
      version: '2.0.0',
      icon: 'lucide:layout-dashboard',
      capabilities: themeHostConfigs.nexus!.capabilities,
    })
  })
})

describe('主题切换与回退', () => {
  it.each([
    ['nexus', 'aurora'],
    ['aurora', 'dock'],
    ['dock', 'nexus'],
  ])('从 %s 切换到 %s 时先预热，资源就绪前保留原布局', async (from, to) => {
    mocks.currentTheme.value = from
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const switching = state.setLayoutTheme(to)
    expect(state.currentThemeId.value).toBe(from)
    expect(state.switchingState.value).toBe('loading')
    expect(isLoading()).toBe(true)
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith(to)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    pending.resolve()
    await switching
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith(to)
    expect(state.currentThemeId.value).toBe(to)
    expect(state.activeTheme.value.id).toBe(to)
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('重复选择当前主题不加载资源、不重新激活主题', async () => {
    const state = setup()
    await state.setLayoutTheme('nexus')
    expect(mocks.preload).not.toHaveBeenCalled()
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it.each(['unknown', ''])('非法选择 %j 回退 Nexus，并在资源就绪后生效', async (id) => {
    mocks.currentTheme.value = 'dock'
    const state = setup()
    await state.setLayoutTheme(id)
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(state.currentThemeId.value).toBe('nexus')
  })

  it('停用当前主题回到默认 Nexus', async () => {
    mocks.currentTheme.value = 'aurora'
    const state = setup()
    state.disableCurrentTheme()
    await flushPromises()
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it.each(['preload', 'reject', 'unavailable'])('%s 失败保留原主题并允许重新切换', async (failure) => {
    if (failure === 'preload') mocks.preload.mockRejectedValueOnce(new Error('资源不可用'))
    else if (failure === 'reject') mocks.setTheme.mockRejectedValueOnce(new Error('引擎加载失败'))
    else mocks.setTheme.mockResolvedValueOnce(false)
    const state = setup()
    await state.setLayoutTheme('dock')
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('error')
    expect(isLoading()).toBe(false)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith('主题加载失败，当前布局已保留。恢复网络后请刷新重试。')
    if (failure === 'preload') expect(mocks.setTheme).not.toHaveBeenCalled()
    await state.setLayoutTheme('dock')
    expect(state.currentThemeId.value).toBe('dock')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it('引擎改变当前主题后报错时恢复原可用布局', async () => {
    mocks.setTheme.mockImplementationOnce(async (id) => {
      mocks.currentTheme.value = id
      throw new Error('主题提交失败')
    })
    const state = setup()
    await state.setLayoutTheme('dock')
    expect(mocks.setTheme.mock.calls).toEqual([['dock'], ['nexus']])
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('error')
    expect(isLoading()).toBe(false)
  })
})

describe('主题预热与并发选择', () => {
  it('预热失败按主题记录且不切换布局，重试仅清理成功主题的错误', async () => {
    mocks.preload
      .mockRejectedValueOnce(new Error('Dock 资源不可用'))
      .mockRejectedValueOnce(new Error('Aurora 资源不可用'))
    const state = setup()
    state.preloadTheme('dock')
    state.preloadTheme('aurora')
    await flushPromises()
    expect(state.preloadErrors.value).toEqual({
      dock: '主题资源未就绪，切换失败时请刷新重试。',
      aurora: '主题资源未就绪，切换失败时请刷新重试。',
    })
    state.preloadTheme('dock')
    await flushPromises()
    expect(state.preloadErrors.value).toEqual({ aurora: '主题资源未就绪，切换失败时请刷新重试。' })
    expect(state.currentThemeId.value).toBe('nexus')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('未知主题预热使用默认主题资源', async () => {
    const state = setup()
    state.preloadTheme('missing')
    await flushPromises()
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('nexus')
    expect(state.preloadErrors.value).toEqual({})
  })

  it.each(['resolve', 'reject'])('旧请求预热迟到 %s 不覆盖较新主题或错误状态', async (result) => {
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const previous = state.setLayoutTheme('dock')
    await state.setLayoutTheme('aurora')
    if (result === 'resolve') pending.resolve()
    else pending.reject(new Error('旧资源失败'))
    await previous
    expect(mocks.setTheme).toHaveBeenCalledExactlyOnceWith('aurora')
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
    await previous
    expect(first.switchingState.value).toBe('loading')
    expect(second.switchingState.value).toBe('loading')
    expect(isLoading()).toBe(true)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    currentPreload.resolve()
    await current
    expect(first.currentThemeId.value).toBe('aurora')
    expect(first.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
  })

  it('等待时重新选择当前布局会取消旧意图，迟到资源不会切走当前主题', async () => {
    const pending = deferred()
    mocks.preload.mockReturnValueOnce(pending.promise)
    const state = setup()
    const previous = state.setLayoutTheme('dock')
    await state.setLayoutTheme('nexus')
    expect(state.switchingState.value).toBe('idle')
    expect(isLoading()).toBe(false)
    pending.resolve()
    await previous
    expect(state.currentThemeId.value).toBe('nexus')
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
