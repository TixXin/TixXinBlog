/**
 * @file flashNoteList.test.ts
 * @description 闪念列表“加载更多”：按钮状态、失败重试文案与读完后的结束提示
 * @author TixXin
 * @since 2026-10-18
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FlashNoteList from '../../app/components/flash/FlashNoteList.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import type { FlashNote } from '../../app/features/flash/types'

mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {} }))

const notes: FlashNote[] = ['a', 'b'].map((id) => ({
  id,
  userId: 'owner',
  content: `公开闪念 ${id}`,
  tags: [],
  images: [],
  type: 'memo',
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  likes: 0,
  comments: [],
}))

describe('闪念列表加载更多', () => {
  it('还有更多时提供可点击的加载按钮，点击发出 more', async () => {
    const wrapper = await mountSuspended(FlashNoteList, { props: { notes, readOnly: true, hasMore: true } })
    const button = wrapper.get('.flash-note-list__more-button')
    expect(button.text()).toContain('加载更多闪念')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
    expect(wrapper.find('.flash-note-list__end').exists()).toBe(false)
    wrapper.unmount()
  })

  it('加载中不重复发出请求且保留焦点，失败时显示原因并改为重试', async () => {
    const props = reactive({
      notes,
      readOnly: true,
      hasMore: true,
      morePending: true,
      moreError: null as string | null,
    })
    // 由真实父组件更新同一列表实例，核对请求状态改变期间的浏览器焦点。
    const host = await mountSuspended(defineComponent({ setup: () => () => h(FlashNoteList, props) }), {
      attachTo: document.body,
    })
    const wrapper = host.getComponent(FlashNoteList)
    const button = wrapper.get<HTMLButtonElement>('.flash-note-list__more-button')
    button.element.focus()
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.text()).toContain('正在加载')
    await button.trigger('click')
    expect(wrapper.emitted('more')).toBeUndefined()
    Object.assign(props, { morePending: false, moreError: '闪念服务暂时不可用，请稍后重试' })
    await nextTick()
    await nextTick()
    const feedback = wrapper.getComponent(RequestFeedback)
    expect(feedback.get('[role="alert"]').text()).toContain('闪念服务暂时不可用，请稍后重试')
    const retry = feedback.get('button')
    expect(retry.text()).toContain('重试')
    expect(document.activeElement).toBe(retry.element)
    await retry.trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
    Object.assign(props, { morePending: true, moreError: null })
    await nextTick()
    expect(feedback.get('button').attributes('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(retry.element)
    await retry.trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
    Object.assign(props, { morePending: false, hasMore: false })
    await nextTick()
    await nextTick()
    expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.flash-note-list__end').element)
    host.unmount()
  })

  it('全部加载后显示结束提示，空列表不显示', async () => {
    const wrapper = await mountSuspended(FlashNoteList, { props: { notes, readOnly: true, hasMore: false } })
    expect(wrapper.find('.flash-note-list__more').exists()).toBe(false)
    expect(wrapper.get('.flash-note-list__end').text()).toContain('没有更多了')
    await wrapper.setProps({ notes: [] })
    expect(wrapper.find('.flash-note-list__end').exists()).toBe(false)
    wrapper.unmount()
  })
})
