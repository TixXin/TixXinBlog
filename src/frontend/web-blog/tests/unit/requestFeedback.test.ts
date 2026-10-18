/** @file requestFeedback.test.ts @description 共享请求反馈的读屏状态、原生按钮与重试互斥契约。 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'

it('失败播报原因，重试时保留可聚焦按钮且阻止重复请求', async () => {
  const wrapper = mount(RequestFeedback, {
    props: { title: '内容加载失败', description: '已保留原内容。', compact: true },
    attachTo: document.body,
    global: { stubs: { Icon: true } },
  })
  try {
    expect(wrapper.get('[role="alert"]').text()).toContain('内容加载失败')
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    button.element.focus()
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ pending: true })
    expect(document.activeElement).toBe(button.element)
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ pending: false })
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(2)
  } finally {
    wrapper.unmount()
  }
})
