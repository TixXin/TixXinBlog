/** @file adminPresenceSettings.test.ts @description 后台实时在线开关：读取、切换即保存（含隐身）、失败时恢复原值并提示 */
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PresenceSettings from '../../app/components/admin/PresenceSettings.vue'

const api = vi.hoisted(() => vi.fn())
mockNuxtImport('useAdminApi', () => () => api)
const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  api.mockReset()
})

async function mountSettings() {
  const wrapper = await mountSuspended(PresenceSettings)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

it('读取当前开关与最后在线时间，切换后只提交改动的开关', async () => {
  api.mockResolvedValueOnce({ autoPresence: true, publicStats: true, ownerLastSeenAt: '2026-11-05T01:02:00Z' })
  const wrapper = await mountSettings()
  const [auto, stats] = wrapper.findAll('input[type="checkbox"]')
  expect((auto!.element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.find('.presence-settings__meta').text()).toContain('最后在线')
  api.mockResolvedValueOnce({ autoPresence: true, publicStats: false, ownerLastSeenAt: '2026-11-05T01:02:00Z' })
  ;(stats!.element as HTMLInputElement).checked = false
  await stats!.trigger('change')
  await flushPromises()
  expect(api).toHaveBeenLastCalledWith('/admin/presence', { method: 'PATCH', body: { publicStats: false } })
  expect((stats!.element as HTMLInputElement).checked).toBe(false)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

it('保存失败时恢复原值并显示错误；从未在线时提示尚无记录', async () => {
  api.mockResolvedValueOnce({ autoPresence: true, publicStats: true, ownerLastSeenAt: null })
  const wrapper = await mountSettings()
  expect(wrapper.find('.presence-settings__meta').text()).toBe('尚无在线记录')
  api.mockRejectedValueOnce(new Error('网络异常'))
  const auto = wrapper.findAll('input[type="checkbox"]')[0]!
  ;(auto.element as HTMLInputElement).checked = false
  await auto.trigger('change')
  await flushPromises()
  expect((auto.element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.find('[role="alert"]').text()).toBe('网络异常')
})

it('隐身开关读取当前值，切换后只提交隐身字段', async () => {
  api.mockResolvedValueOnce({ autoPresence: true, publicStats: true, invisible: false, ownerLastSeenAt: null })
  const wrapper = await mountSettings()
  const invisible = wrapper.findAll('input[type="checkbox"]')[2]!
  expect((invisible.element as HTMLInputElement).checked).toBe(false)
  api.mockResolvedValueOnce({ autoPresence: true, publicStats: true, invisible: true, ownerLastSeenAt: null })
  ;(invisible.element as HTMLInputElement).checked = true
  await invisible.trigger('change')
  await flushPromises()
  expect(api).toHaveBeenLastCalledWith('/admin/presence', { method: 'PATCH', body: { invisible: true } })
  expect((invisible.element as HTMLInputElement).checked).toBe(true)
})
