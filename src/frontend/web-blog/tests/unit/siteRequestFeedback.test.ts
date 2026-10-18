/** @file siteRequestFeedback.test.ts @description 三主题共用布局暴露站点读取失败，重试保留资料并防止重复请求。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import DefaultLayout from '../../app/layouts/default.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import { useSiteSettings } from '../../app/composables/useSiteSettings'
import { defaultSiteSettings } from '../../app/features/site/settings'

mockNuxtImport('usePageMotion', () => () => {})
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  clearNuxtState(['site-settings', 'site-settings-available', 'site-settings-error', 'site-settings-pending'])
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

it('任一公开页面均可恢复站点资料，失败和重试期间保留正文与已有资料', async () => {
  let site!: ReturnType<typeof useSiteSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          site = useSiteSettings()
          return () => h('div')
        },
      }),
    ),
  )
  site.accept({ ...structuredClone(defaultSiteSettings), name: '晨间札记' })
  const request = vi.spyOn($fetch, 'raw').mockRejectedValueOnce(new Error('offline'))
  await site.refresh()
  expect(site.pending.value).toBe(false)
  expect(site.settings.value.name).toBe('晨间札记')

  const wrapper = await mountSuspended(DefaultLayout, {
    shallow: true,
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        CommonRequestFeedback: RequestFeedback,
        NuxtPage: { template: '<article>当前页面正文</article>' },
      },
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('[role="alert"]').text()).toContain('站点资料暂时无法读取')
  expect(wrapper.get('.request-feedback').attributes('data-page-motion-status')).toBeDefined()
  expect(wrapper.get('.page-motion-host > :not([data-page-motion-status])').text()).toBe('当前页面正文')
  expect(wrapper.text()).toContain('当前页面正文')

  let finish!: () => void
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            _data: { data: { ...structuredClone(defaultSiteSettings), name: '更新后的札记' } },
            headers: new Headers(),
          } as Awaited<ReturnType<typeof $fetch.raw>>)
      }),
  )
  await wrapper.get('.request-feedback button').trigger('click')
  expect(site.pending.value).toBe(true)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
  await wrapper.get('.request-feedback button').trigger('click')
  // 进行中的重复调用共享同一请求，等待方在真实结果写入后才继续。
  let joinedSettled = false
  const joined = site.refresh().then(() => {
    joinedSettled = true
  })
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(2)
  expect(joinedSettled).toBe(false)
  expect(site.settings.value.name).toBe('晨间札记')
  finish()
  await joined
  expect(site.settings.value.name).toBe('更新后的札记')
  await flushPromises()
  expect(site.pending.value).toBe(false)
  expect(site.error.value).toBe('')
  expect(site.settings.value.name).toBe('更新后的札记')
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.text()).toContain('当前页面正文')
})
