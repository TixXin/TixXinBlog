/** @file publicReadSsr.test.ts @description 独立Nuxt请求中的SSR并发读取、完成结果复用及显式刷新边界 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, reactive, shallowReactive } from 'vue'
import type { Component } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createNuxtApp } from '#app/nuxt'
import type { NuxtApp } from '#app'
import { usePublicReadData } from '~/composables/usePublicReadData'

const key = 'public-ssr-prefetch-unit'
const requests: NuxtApp[] = []
let requestSequence = 0
let originalApp: NuxtApp
beforeEach(() => {
  originalApp = useNuxtApp()
})
afterEach(() => {
  requests.splice(0).forEach((app) => app._scope.stop())
  originalApp.runWithContext(() => {})
})

function request(component: Component) {
  const vueApp = createSSRApp(component)
  const app = createNuxtApp({
    id: `public-ssr-request-${++requestSequence}`,
    vueApp,
    ssrContext: {
      url: '/moments',
      runtimeConfig: originalApp.$config,
      payload: { config: originalApp.$config },
    } as NonNullable<NuxtApp['ssrContext']>,
  })
  // 测试环境已启动另一个客户端应用；每个模拟HTTP请求使用独立的真实Nuxt数据容器。
  app.isHydrating = false
  app.payload.serverRendered = true
  app.payload.data = shallowReactive({})
  app.payload.state = reactive({})
  app.payload._errors = shallowReactive({})
  requests.push(app)
  return { app, render: () => app.runWithContext(() => renderToString(vueApp)) }
}

it('SSR预取、布局和页面并发订阅同键只发起一次请求', async () => {
  let finish!: (value: { title: string }) => void
  let signal!: AbortSignal
  const loader = vi.fn((_app: NuxtApp, options: { signal: AbortSignal }) => {
    signal = options.signal
    return new Promise<{ title: string }>((resolve) => {
      finish = resolve
    })
  })
  const context = request(
    defineComponent({
      async setup() {
        const subscriptions = Array.from({ length: 3 }, () =>
          usePublicReadData(key, loader, { domain: 'post-summary', kind: 'metadata' }),
        )
        await Promise.all(subscriptions)
        return () => h('p', subscriptions.map((entry) => entry.data.value?.title).join('|'))
      },
    }),
  )
  const rendering = context.render()
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(loader).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)
  finish({ title: '共享公开统计' })
  expect(await rendering).toContain('共享公开统计|共享公开统计|共享公开统计')
})

it('SSR预取完成后布局和页面依次订阅复用同一完成结果', async () => {
  const loader = vi.fn(async () => ({ title: '预取已完成' }))
  const child = defineComponent({
    async setup() {
      const value = await usePublicReadData(key, loader, { domain: 'post-summary', kind: 'metadata' })
      return () => h('span', value.data.value?.title)
    },
  })
  const context = request(
    defineComponent({
      async setup() {
        await usePublicReadData(key, loader, { domain: 'post-summary', kind: 'metadata' })
        return () => h(child)
      },
    }),
  )
  expect(await context.render()).toContain('预取已完成')
  expect(loader).toHaveBeenCalledTimes(1)
})

it('两个并行SSR请求不共享同键Promise或完成数据', async () => {
  const finishes: ((value: { title: string }) => void)[] = []
  const loader = vi.fn(
    () =>
      new Promise<{ title: string }>((resolve) => {
        finishes.push(resolve)
      }),
  )
  const component = defineComponent({
    async setup() {
      const value = await usePublicReadData(key, loader, { domain: 'post-summary', kind: 'metadata' })
      return () => h('p', value.data.value?.title)
    },
  })
  const first = request(component),
    second = request(component)
  const firstRender = first.render(),
    secondRender = second.render()
  await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
  finishes[1]!({ title: '请求乙' })
  finishes[0]!({ title: '请求甲' })
  expect(await firstRender).toContain('请求甲')
  expect(await secondRender).toContain('请求乙')
  expect(first.app.payload.data[key]).toEqual({ title: '请求甲' })
  expect(second.app.payload.data[key]).toEqual({ title: '请求乙' })
})

it('SSR手动刷新和app:data:refresh都重新读取，不复用旧payload', async () => {
  const loader = vi.fn().mockResolvedValueOnce({ title: '手动读取' }).mockResolvedValueOnce({ title: '钩子读取' })
  const context = request(
    defineComponent({
      async setup() {
        const result = await usePublicReadData<{ title: string }>(key, loader, {
          domain: 'post-summary',
          kind: 'metadata',
        })
        expect(result.data.value?.title).toBe('旧payload')
        expect(loader).not.toHaveBeenCalled()
        await result.refresh()
        expect(result.data.value?.title).toBe('手动读取')
        await app.hooks.callHook('app:data:refresh', [key])
        expect(result.data.value?.title).toBe('钩子读取')
        return () => h('p', result.data.value?.title)
      },
    }),
  )
  const app = context.app
  app.payload.data[key] = { title: '旧payload' }
  expect(await context.render()).toContain('钩子读取')
  expect(loader).toHaveBeenCalledTimes(2)
})
