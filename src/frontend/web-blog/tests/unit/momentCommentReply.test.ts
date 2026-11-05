/**
 * @file momentCommentReply.test.ts
 * @description 朋友圈评论回复：回复按钮与提示条、提交携带目标、成功后回到直接评论、不可见目标的展示
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import MomentCommentSection from '../../app/components/moment/MomentCommentSection.vue'
import type { MomentCommentItem } from '../../app/features/moment/types'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

const comment = (patch: Partial<MomentCommentItem>): MomentCommentItem => ({
  id: 'c-1',
  author: '远山',
  avatar: '',
  content: '晚霞真好',
  time: '刚刚',
  moderationStatus: 'published',
  ...patch,
})

async function setup(comments: MomentCommentItem[], draft = '回一句') {
  const wrapper = await mountSuspended(MomentCommentSection, {
    attachTo: document.body,
    props: { comments, draft },
    global: {
      stubs: { MomentUserPopover: { template: '<div><slot /></div>' }, CommonContentImage: true, Icon: true },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('朋友圈评论回复', () => {
  it('点回复显示提示条并聚焦输入框，提交带上 replyToId，可取消改为直接评论', async () => {
    const wrapper = await setup([comment({})])
    await wrapper.get('[aria-label="回复 远山"]').trigger('click')
    expect(wrapper.get('.moment-reply-bar').text()).toContain('回复 远山')
    expect(document.activeElement).toBe(wrapper.get('input[aria-label="动态评论内容"]').element)
    expect(wrapper.get('input[aria-label="动态评论内容"]').attributes('placeholder')).toBe('回复 远山…')
    await wrapper.get('button.moment-comments__send').trigger('click')
    expect(wrapper.emitted('submit')!.at(-1)![0]).toMatchObject({ replyToId: 'c-1' })
    await wrapper.get('[aria-label="取消回复，改为直接评论"]').trigger('click')
    expect(wrapper.find('.moment-reply-bar').exists()).toBe(false)
    await wrapper.get('button.moment-comments__send').trigger('click')
    expect(wrapper.emitted('submit')!.at(-1)![0]).not.toHaveProperty('replyToId')
  })

  it('发送成功清空草稿后回到直接评论，失败时保留回复对象', async () => {
    const wrapper = await setup([comment({})])
    await wrapper.get('[aria-label="回复 远山"]').trigger('click')
    await wrapper.setProps({ submitting: true })
    await wrapper.setProps({ submitting: false, submitError: '网络失败' })
    expect(wrapper.find('.moment-reply-bar').exists()).toBe(true)
    await wrapper.setProps({ submitting: true, submitError: '' })
    await wrapper.setProps({ submitting: false, draft: '' })
    expect(wrapper.find('.moment-reply-bar').exists()).toBe(false)
  })

  it('显示“A 回复 B”，目标不可见时只说明回复了不可见的评论；待审评论没有回复入口', async () => {
    const wrapper = await setup([
      comment({ id: 'c-2', author: '读者', replyTo: { id: 'c-1', author: '远山' } }),
      comment({ id: 'c-3', author: '路人', replyTo: { id: null, author: null } }),
      comment({ id: 'c-4', author: '新访客', moderationStatus: 'pending' }),
    ])
    const items = wrapper.findAll('.moment-comments__item')
    expect(items[0]!.text()).toContain('读者回复远山')
    expect(items[1]!.text()).toContain('路人回复了一条不可见的评论')
    expect(items[2]!.find('.moment-comments__reply').exists()).toBe(false)
  })
})
