/** @file publicListFeedback.test.ts @description 文章、动态与评论读取失败统一反馈，保留已读内容和输入。 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PostCardList from '../../app/components/blog/PostCardList.vue'
import MomentList from '../../app/components/moment/MomentList.vue'
import MomentCommentSection from '../../app/components/moment/MomentCommentSection.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import type { PostItem } from '../../app/features/post/types'
import type { MomentItem } from '../../app/features/moment/types'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const post: PostItem = {
  id: 1,
  title: '晨间笔记',
  summary: '记录一些想法',
  tags: [],
  category: 'life',
  readTime: 1,
  likes: 0,
  views: 2,
  comments: 0,
  date: '2026-10-18',
  folder: '随笔',
}
const moment: MomentItem = {
  id: 'morning',
  content: '窗外天晴',
  date: '2026-10-18',
  likes: 0,
  isLiked: false,
}
const global = {
  renderStubDefaultSlot: true,
  stubs: { CommonRequestFeedback: RequestFeedback },
}

describe('公开列表的失败反馈', () => {
  it('文章刷新失败保留原卡片，可重试且不会显示空列表', async () => {
    const wrapper = await mountSuspended(PostCardList, {
      shallow: true,
      global,
      props: {
        posts: [post],
        activeTab: 'all',
        total: 1,
        currentPage: 1,
        displayMode: 'pagination',
        pending: false,
        errorMessage: '文章加载失败，请重试',
      },
    })
    wrappers.push(wrapper)
    expect(wrapper.findAll('theme-component-stub')).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('仍显示上次成功加载的文章')
    expect(wrapper.find('.post-list__empty').exists()).toBe(false)
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ pending: true })
    expect(wrapper.find('.request-feedback button').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('正在加载文章')
    await wrapper.setProps({ pending: false, errorMessage: '' })
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
    expect(wrapper.findAll('theme-component-stub')).toHaveLength(1)
  })

  it('动态追加失败仍显示原动态并提供统一重试，加载时不显示空态', async () => {
    const wrapper = await mountSuspended(MomentList, {
      shallow: true,
      global,
      props: {
        moments: [moment],
        ownerProfile: { name: '博主', avatar: '' },
        states: {},
        pending: false,
        errorMessage: '动态读取失败',
        hasMore: true,
      },
    })
    wrappers.push(wrapper)
    expect(wrapper.findAll('moment-card-stub')).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('仍显示上次成功加载的动态')
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.get('.moment-list__more').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ pending: true })
    expect(wrapper.find('.request-feedback button').exists()).toBe(false)
    expect(wrapper.find('common-state-block-stub').exists()).toBe(false)
    await wrapper.setProps({ pending: false, errorMessage: '' })
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
    expect(wrapper.get('.moment-list__more').attributes('disabled')).toBeUndefined()
  })

  it('评论重试保留输入，忙碌期间不重复触发，恢复后回到原有加载更多按钮', async () => {
    const wrapper = await mountSuspended(MomentCommentSection, {
      shallow: true,
      global,
      props: { comments: [], draft: '尚未发送的想法', hasMore: true, loadError: '评论读取失败' },
    })
    wrappers.push(wrapper)
    expect(wrapper.get('input').element.value).toBe('尚未发送的想法')
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
    await wrapper.setProps({ loading: true })
    expect(wrapper.get('.request-feedback button').attributes('aria-disabled')).toBe('true')
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
    expect(wrapper.get('input').element.value).toBe('尚未发送的想法')
    await wrapper.setProps({ loading: false, loadError: '' })
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
    expect(wrapper.get('.moment-comments__expand').text()).toBe('查看更多评论')
  })
})
