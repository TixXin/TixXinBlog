/** @file articleReadingResume.test.ts @description 文章阅读恢复提示的文案、可访问语义和主动恢复事件 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReadingResume from '../../app/components/article/ReadingResume.vue'
import Tooltip from '../../app/components/common/Tooltip.vue'

const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function setup() {
  const wrapper = await mountSuspended(ReadingResume, {
    props: { progress: 42.4, readTime: '12 分钟' },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('文章阅读恢复提示', () => {
  it('展示上次进度与既有预计阅读时长，并随文章信息更新', async () => {
    const wrapper = await setup()
    expect(wrapper.get('[role="status"]').text()).toBe('上次读到 42% 预计阅读 12 分钟')

    await wrapper.setProps({ progress: 67.8, readTime: '约 5 分钟' })
    expect(wrapper.get('[role="status"]').text()).toBe('上次读到 68% 预计阅读 约 5 分钟')
  })

  it('使用具名原生按钮及独立状态区，并通过 CommonTooltip 说明跳转行为', async () => {
    const wrapper = await setup()
    const button = wrapper.get('button')
    const status = wrapper.get('[role="status"]')

    expect(button.text()).toBe('继续上次阅读')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('title')).toBeUndefined()
    expect(button.attributes('aria-describedby')).toBe(status.attributes('id'))
    expect(status.find('button').exists()).toBe(false)
    expect(wrapper.getComponent(Tooltip).props('content')).toBe('跳转到这篇文章上次的阅读位置')
    expect(wrapper.findAll('[aria-hidden="true"]')).toHaveLength(2)

    button.element.focus()
    expect(document.activeElement).toBe(button.element)
  })

  it('挂载时不触发恢复，仅在用户激活按钮后发出无参数事件', async () => {
    const wrapper = await setup()
    expect(wrapper.emitted('resume')).toBeUndefined()

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('resume')).toEqual([[]])
  })
})
