/**
 * @file motionLifecycle.test.ts
 * @description 动效中断回归：旧颜色事务不得清理新事务，卸载中的入场必须只收尾一次
 * @author TixXin
 * @since 2026-09-07
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useTheme } from '../../app/composables/useTheme'
import { usePostListAnimation } from '../../app/composables/usePostListAnimation'

const wrappers: { unmount(): void }[] = []
const pendingFinishes: (() => void)[] = []
const nativeTransition = Object.getOwnPropertyDescriptor(document, 'startViewTransition')
beforeAll(() => {
  if (!nativeTransition)
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('测试中必须提供ViewTransition替身')
      },
    })
})
afterAll(() => {
  if (nativeTransition) Object.defineProperty(document, 'startViewTransition', nativeTransition)
  else Reflect.deleteProperty(document, 'startViewTransition')
})
afterEach(async () => {
  pendingFinishes.splice(0).forEach((finish) => finish())
  await flushPromises()
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  delete document.documentElement.dataset.colorModeAnim
  delete document.documentElement.dataset.colorModeAnimDir
})

describe('动效中断', () => {
  it('较早的ViewTransition结束不能清理较新的颜色事务', async () => {
    const finishes: (() => void)[] = []
    const transitions: { skipTransition: ReturnType<typeof vi.fn> }[] = []
    let change!: ReturnType<typeof useTheme>['setTheme']
    let initialize!: () => void
    wrappers.push(
      await mountSuspended(
        defineComponent({
          setup() {
            const colorMode = useColorMode()
            const preset = useState('appearance-color-mode-transition-preset')
            initialize = () => {
              colorMode.preference = 'dark'
              preset.value = 'circle'
            }
            change = useTheme().setTheme
            return () => h('div')
          },
        }),
      ),
    )
    initialize()
    await flushPromises()
    const start = vi.fn((update: () => Promise<void>) => {
      const updateCallbackDone = Promise.resolve().then(update)
      const transition = {
        ready: updateCallbackDone,
        updateCallbackDone,
        finished: new Promise<void>((resolve) => {
          finishes.push(resolve)
          pendingFinishes.push(resolve)
        }),
        skipTransition: vi.fn(),
      }
      transitions.push(transition)
      return transition
    })
    vi.spyOn(document, 'startViewTransition').mockImplementation(start as typeof document.startViewTransition)
    vi.spyOn(document.documentElement, 'animate').mockReturnValue({
      cancel: vi.fn(),
      finished: new Promise(() => {}),
    } as unknown as Animation)
    change('light')
    await flushPromises()
    change('dark')
    await flushPromises()
    expect(start).toHaveBeenCalledTimes(2)
    finishes[0]!()
    await flushPromises()
    expect(document.documentElement.dataset.colorModeAnim).toBe('circle')
    finishes[1]!()
    await flushPromises()
    expect(document.documentElement.dataset.colorModeAnim).toBeUndefined()
  })

  it('列表入场尚未完成就卸载时立即收尾且迟到完成不重复回调', async () => {
    let enter!: ReturnType<typeof usePostListAnimation>['onItemEnter']
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          enter = usePostListAnimation(ref(0)).onItemEnter
          return () => h('div', { 'data-index': 0 })
        },
      }),
    )
    const done = vi.fn()
    let resolveAnimation!: () => void
    const animation = {
      cancel: vi.fn(),
      finished: new Promise<void>((resolve) => {
        resolveAnimation = resolve
      }),
    }
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 200, 100))
    vi.spyOn(wrapper.element, 'animate').mockReturnValue(animation as unknown as Animation)
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(100001)
    enter(wrapper.element, done)
    expect(done).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(done).toHaveBeenCalledTimes(1)
    resolveAnimation()
    await flushPromises()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('离屏新增条目直接完成，不创建入场任务', async () => {
    let enter!: ReturnType<typeof usePostListAnimation>['onItemEnter']
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          enter = usePostListAnimation(ref(0)).onItemEnter
          return () => h('div', { 'data-index': 0 })
        },
      }),
    )
    wrappers.push(wrapper)
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 8000, 200, 100))
    const animate = vi.spyOn(wrapper.element, 'animate')
    const done = vi.fn()
    enter(wrapper.element, done)
    expect(done).toHaveBeenCalledTimes(1)
    expect(animate).not.toHaveBeenCalled()
  })
})
