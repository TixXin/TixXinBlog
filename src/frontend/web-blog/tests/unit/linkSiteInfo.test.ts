/** @file linkSiteInfo.test.ts @description 本站资料available门控、剪贴板失败保留及SSR快照边界 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useLinkSiteInfo } from '../../app/composables/useLinkSiteInfo'
import { defaultSiteSettings } from '../../app/features/site/settings'
const wrappers: { unmount(): void }[] = []
const write = vi.fn(),
  actual = {
    ...defaultSiteSettings,
    name: '数据库友链资料',
    description: '真实站点介绍',
    avatar: '/actual-avatar.webp',
  }
let clipboard: PropertyDescriptor | undefined
beforeEach(() => {
  write.mockReset().mockResolvedValue(undefined)
  clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
async function setup(available: boolean) {
  let value!: ReturnType<typeof useLinkSiteInfo>, site!: ReturnType<typeof useSiteSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          clearNuxtState('links-site-info-ssr')
          site = useSiteSettings()
          site.accept(actual)
          site.available.value = available
          site.error.value = available ? '' : '站点资料暂时无法读取'
          useRuntimeConfig().public.siteUrl = 'https://site.example'
          value = useLinkSiteInfo()
          return () => h('div')
        },
      }),
    ),
  )
  return { value, site }
}
it('真实设置不可用时没有可复制资料，不能复制defaults', async () => {
  const { value } = await setup(false)
  expect(value.info.value).toBeNull()
  await value.copy()
  expect(write).not.toHaveBeenCalled()
})
it('剪贴板失败保留准备复制的真实内容，重试不丢字段', async () => {
  const { value } = await setup(true)
  write.mockRejectedValueOnce(new Error('clipboard denied'))
  await value.copy()
  expect(value.copyError.value).toContain('复制失败')
  expect(value.retainedText.value).toContain('数据库友链资料')
  expect(value.retainedText.value).toContain('https://site.example/actual-avatar.webp')
  await value.copy()
  expect(value.notice.value).toBe('本站友链资料已复制')
  expect(write).toHaveBeenCalledTimes(2)
})
it('SSR记录不可用但客户端资料已恢复时，首帧保持SSR，挂载后才展示真实资料', async () => {
  let value!: ReturnType<typeof useLinkSiteInfo>,
    app!: ReturnType<typeof useNuxtApp>,
    oldHydrating = false
  const frames: boolean[] = []
  try {
    wrappers.push(
      await mountSuspended(
        defineComponent({
          setup() {
            app = useNuxtApp()
            oldHydrating = app.isHydrating
            app.isHydrating = true
            useSiteSettings().accept(actual)
            useRuntimeConfig().public.siteUrl = 'https://site.example'
            useState('links-site-info-ssr').value = { info: null, error: 'SSR暂不可用' }
            value = useLinkSiteInfo()
            return () => {
              frames.push(!!value.info.value)
              return h('div', value.info.value?.[0]?.value ?? value.error.value)
            }
          },
        }),
      ),
    )
    expect(frames[0]).toBe(false)
    await vi.waitFor(() => expect(value.info.value?.[0]?.value).toBe('数据库友链资料'))
  } finally {
    if (app) app.isHydrating = oldHydrating
  }
})
