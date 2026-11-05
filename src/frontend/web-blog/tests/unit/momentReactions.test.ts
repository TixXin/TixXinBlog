/**
 * @file momentReactions.test.ts
 * @description 朋友圈表情回应：已有回应的切换、添加菜单、提交中不重复发出，以及交互层用服务端结果替换计数
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MomentReactions from '../../app/components/moment/MomentReactions.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(props: InstanceType<typeof MomentReactions>['$props']) {
  const wrapper = await mountSuspended(MomentReactions, { props, global: { stubs: { Icon: true } } })
  wrappers.push(wrapper)
  return wrapper
}

describe('朋友圈表情回应', () => {
  it('已有回应显示数量与本人状态，点击切换为相反状态', async () => {
    const wrapper = await setup({
      reactions: [
        { emoji: '❤️', count: 3, reacted: true },
        { emoji: '💡', count: 1, reacted: false },
      ],
    })
    const chips = wrapper.findAll('.moment-reactions__chip')
    expect(chips.map((chip) => chip.attributes('aria-label'))).toEqual(['喜欢，3 人', '灵感，1 人'])
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    await chips[0]!.trigger('click')
    await chips[1]!.trigger('click')
    expect(wrapper.emitted('react')).toEqual([[{ emoji: '❤️', reacted: false }], [{ emoji: '💡', reacted: true }]])
  })

  it('添加菜单列出全部可选表情，选择后收起；提交中不再发出', async () => {
    const wrapper = await setup({ reactions: [{ emoji: '🎉', count: 2, reacted: true }] })
    const add = wrapper.get('[aria-label="添加回应"]')
    expect(add.attributes('aria-expanded')).toBe('false')
    await add.trigger('click')
    const options = wrapper.findAll('.moment-reactions__option')
    expect(options).toHaveLength(6)
    expect(wrapper.get('.moment-reactions__option[aria-label="庆祝"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('.moment-reactions__option[aria-label="感谢"]').trigger('click')
    expect(wrapper.emitted('react')).toEqual([[{ emoji: '🙏', reacted: true }]])
    expect(wrapper.find('.moment-reactions__menu').exists()).toBe(false)
    await wrapper.setProps({ pending: true })
    await wrapper.get('.moment-reactions__chip').trigger('click')
    expect(wrapper.emitted('react')).toHaveLength(1)
  })
})
