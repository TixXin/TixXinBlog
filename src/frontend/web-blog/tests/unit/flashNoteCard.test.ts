/**
 * @file flashNoteCard.test.ts
 * @description 闪念真实组件的 Boolean 缺省、公开互动与只读/忙碌限制回归
 * @author TixXin
 * @since 2026-09-07
 */
import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FlashNoteCard from '../../app/components/flash/FlashNoteCard.vue'
import type { FlashNote } from '../../app/features/flash/types'

mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {} }))

const note: FlashNote = {
  id: 'public-note',
  userId: 'owner',
  content: '公开闪念',
  tags: [],
  images: [],
  type: 'memo',
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  likes: 0,
  comments: [],
}

describe('闪念公开互动', () => {
  it('不传 interactive 时访客可点赞和打开评论，但没有管理按钮', async () => {
    const wrapper = await mountSuspended(FlashNoteCard, { props: { note, readOnly: true } })
    expect(wrapper.get('button[aria-label="点赞"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="评论"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button[aria-label="编辑闪念"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="点赞"]').trigger('click')
    expect(wrapper.emitted('toggle-like')).toEqual([['public-note']])
    wrapper.unmount()
  })

  it.each([
    { interactive: false },
    { busy: true },
    { note: { ...note, isDraft: true } },
    { note: { ...note, isArchived: true } },
  ])('显式只读、在途、草稿或归档仍然阻止互动：%o', async (overrides) => {
    const wrapper = await mountSuspended(FlashNoteCard, { props: { note, ...overrides } })
    expect(wrapper.get('button[aria-label="点赞"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="评论"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
