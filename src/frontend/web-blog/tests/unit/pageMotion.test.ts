/** @file pageMotion.test.ts @description 页面入场事务回归：取消、减动效与卸载仍完成焦点交接，迟到动画不影响新导航 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useNuxtApp, useState } from '#app'
import type { NavigationGuard, NavigationHookAfter, Router } from 'vue-router'
import { usePageMotion } from '../../app/composables/usePageMotion'

const mocks = vi.hoisted(() => ({ enabled: false, router: {} as Router }))
mockNuxtImport('useRouter', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.router : actual.useRouter())
})
const wrappers: { unmount(): void }[] = []
let before!: NavigationGuard
let after!: NavigationHookAfter
let pageFinish!: () => void | Promise<void>
let appError!: () => void
const animations: { resolve(): void; cancel: ReturnType<typeof vi.fn>; duration: number }[] = []
const location = (path: string) => ({ path, fullPath: path }) as Router['currentRoute']['value']

beforeEach(() => {
  mocks.enabled = true
  animations.length = 0
  useState('motion-reduced').value = false
  useState('appearance-content-transition-preset').value = 'vertical-slide'
  useState('page-transition-current').value = false
  useState('page-motion-completed').value = 0
  mocks.router = {
    currentRoute: ref(location('/')),
    beforeEach: (callback: NavigationGuard) => {
      before = callback
      return () => {}
    },
    afterEach: (callback: NavigationHookAfter) => {
      after = callback
      return () => {}
    },
    onError: () => () => {},
  } as unknown as Router
  const app = useNuxtApp()
  const originalHook = app.hook.bind(app)
  vi.spyOn(app, 'hook').mockImplementation((name, callback, ...args) => {
    if (name === 'page:finish') {
      pageFinish = callback as typeof pageFinish
      return () => {}
    }
    if (name === 'app:error') {
      appError = callback as typeof appError
      return () => {}
    }
    return originalHook(name, callback, ...args)
  })
  vi.spyOn(Element.prototype, 'animate').mockImplementation((_frames, options) => {
    let resolve!: () => void
    const finished = new Promise<Animation>((done) => {
      resolve = () => done(animation)
    })
    const cancel = vi.fn()
    const animation = { finished, cancel } as unknown as Animation
    animations.push({ resolve, cancel, duration: typeof options === 'object' ? Number(options.duration) : 0 })
    return animation
  })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  animations.forEach((animation) => animation.resolve())
  await flushPromises()
  mocks.enabled = false
  vi.restoreAllMocks()
})

async function setup() {
  let state!: ReturnType<typeof usePageMotion>
  const page = ref('home')
  const wrapper = mount(
    defineComponent({
      setup() {
        const host = ref<HTMLElement | null>(null)
        state = usePageMotion(host)
        return () =>
          h('div', { ref: host }, [
            h('section', { key: page.value, 'data-page-frame': '', 'data-page-header-key': page.value }, [
              h('header', { 'data-page-header': '' }, '标题'),
              h('div', { 'data-page-body-frame': '' }, [h('div', { 'data-page-body': '' }, '正文')]),
            ]),
          ])
      },
    }),
  )
  wrappers.push(wrapper)
  await nextTick()
  async function begin(path: string) {
    await before(location(path), mocks.router.currentRoute.value, () => {})
  }
  async function commit(path: string) {
    mocks.router.currentRoute.value = location(path)
    page.value = path
    await nextTick()
    await pageFinish()
  }
  return { state, wrapper, begin, commit }
}
const completed = () => useState<number>('page-motion-completed').value

it('等待期间保留正文，提交后仅播放标题和正文入场并只完成一次', async () => {
  const { state, wrapper, begin, commit } = await setup()
  const previous = wrapper.find('section').element
  const clone = vi.spyOn(previous, 'cloneNode')
  await begin('/archive')
  expect(state.pending.value).toBe(true)
  expect(wrapper.find('section').element).toBe(previous)
  expect(animations).toHaveLength(0)
  expect(clone).not.toHaveBeenCalled()
  await commit('/archive')
  expect(animations.map((animation) => animation.duration)).toEqual([120, 150])
  expect(completed()).toBe(0)
  animations.forEach((animation) => animation.resolve())
  await flushPromises()
  expect(completed()).toBe(1)
  expect(state.pending.value).toBe(false)
  expect(useState('page-transition-current').value).toBe(false)
  wrapper.unmount()
  expect(completed()).toBe(1)
})

it.each(['none', 'reduce'])('%s 模式仍在内容提交后发布完成信号', async (mode) => {
  if (mode === 'none') useState('appearance-content-transition-preset').value = 'none'
  else useState('motion-reduced').value = true
  const { state, begin, commit } = await setup()
  await begin('/archive')
  expect(completed()).toBe(0)
  await commit('/archive')
  expect(state.pending.value).toBe(false)
  expect(animations).toHaveLength(0)
  expect(completed()).toBe(1)
})

it('旧动画迟到完成不能清理正在等待的新导航', async () => {
  const { state, begin, commit } = await setup()
  await begin('/archive')
  await commit('/archive')
  const previous = [...animations]
  await begin('/projects')
  previous.forEach((animation) => animation.resolve())
  await flushPromises()
  expect(state.pending.value).toBe(true)
  expect(completed()).toBe(0)
  await commit('/projects')
  animations.slice(previous.length).forEach((animation) => animation.resolve())
  await flushPromises()
  expect(completed()).toBe(1)
})

it('运行中开启减动效立即结束入场，迟到结束事件不能重复收尾', async () => {
  const { wrapper, begin, commit } = await setup()
  await begin('/archive')
  await commit('/archive')
  useState('motion-reduced').value = true
  expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
  expect(completed()).toBe(1)
  appError()
  wrapper.unmount()
  animations.forEach((animation) => animation.resolve())
  await flushPromises()
  expect(completed()).toBe(1)
})

it.each(['error', 'unmount'])('%s 在等待新内容时仍清除等待并发布完成信号', async (reason) => {
  const { state, wrapper, begin } = await setup()
  await begin('/archive')
  expect(state.pending.value).toBe(true)
  expect(completed()).toBe(0)
  if (reason === 'error') appError()
  else wrapper.unmount()
  expect(state.pending.value).toBe(false)
  expect(useState('page-transition-current').value).toBe(false)
  expect(completed()).toBe(1)
  await pageFinish()
  expect(completed()).toBe(1)
})

it('被拒绝导航清除等待并保持原正文，之后可正常导航', async () => {
  const { state, wrapper, begin, commit } = await setup()
  const previous = wrapper.find('section').element
  await begin('/archive')
  after(location('/archive'), location('/'), { type: 4 } as Parameters<NavigationHookAfter>[2])
  expect(state.pending.value).toBe(false)
  expect(wrapper.find('section').element).toBe(previous)
  expect(completed()).toBe(1)
  await begin('/projects')
  await commit('/projects')
  animations.forEach((animation) => animation.resolve())
  await flushPromises()
  expect(completed()).toBe(2)
})
