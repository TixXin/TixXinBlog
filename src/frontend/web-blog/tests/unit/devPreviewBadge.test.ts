/**
 * @file devPreviewBadge.test.ts
 * @description 开发预览角标：地址带 preview 参数时显示名称，退出时移除 preview 与 preview-* 参数并保留其他查询参数
 * @author TixXin
 * @since 2026-10-20
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DevPreviewBadge from '../../app/components/dev/DevPreviewBadge.vue'

describe('DevPreviewBadge', () => {
  it('没有 preview 参数时不渲染', async () => {
    const wrapper = await mountSuspended(DevPreviewBadge, { route: '/setup' })
    expect(wrapper.find('.dev-preview-badge').exists()).toBe(false)
  })

  it('显示预览名称，退出后去掉预览参数并保留其他参数', async () => {
    const wrapper = await mountSuspended(DevPreviewBadge, {
      route: '/setup?preview=form&preview-submit=fail&from=install',
    })
    expect(wrapper.find('[role="note"]').text()).toContain('预览：form')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ from: 'install' }))
    expect(wrapper.find('.dev-preview-badge').exists()).toBe(false)
  })
})
