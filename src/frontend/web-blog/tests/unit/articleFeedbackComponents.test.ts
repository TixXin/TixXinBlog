/** @file articleFeedbackComponents.test.ts @description 文章导航和评论失败统一反馈、保留内容与重试按钮行为 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ArticleNav from '../../app/components/article/ArticleNav.vue'
import CommentSection from '../../app/components/article/CommentSection.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import { createCommentController } from '../../app/features/post/commentController'
import type { CommentList } from '../../app/features/post/commentController'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
it('相邻文章读取失败使用统一反馈，保留可用链接并发出重试事件', async () => {
  const wrapper = await mountSuspended(ArticleNav, {
    props: {
      prev: { id: '42', title: '已有文章', date: '2026-10-18', category: '生活' },
      next: null,
      error: true,
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.getComponent(RequestFeedback).text()).toContain('相邻文章和相关推荐')
  expect(wrapper.get('a').text()).toContain('已有文章')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
  await wrapper.setProps({ pending: true })
  expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
  await wrapper.setProps({ error: false, pending: false })
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.get('a').text()).toContain('已有文章')
})
it('评论错误只保留一个重试入口，加载期间禁止重复重试并保留草稿和旧评论', async () => {
  const wrapper = await mountSuspended(CommentSection, {
    props: {
      modelValue: '尚未提交的草稿',
      comments: [{ id: 1, author: '访客', avatar: '', content: '旧评论', time: '2026-10-18', likes: 0 }],
      total: 1,
      replyTarget: null,
      submitting: false,
      loading: false,
      busy: false,
      canSubmit: true,
      submitError: '',
      loadError: '评论已发表，但列表刷新失败，请重试加载',
      likeError: '',
      pendingLikes: [],
    },
    global: { stubs: { ArticleCommentBubble: true } },
  })
  wrappers.push(wrapper)
  const feedback = wrapper.getComponent(RequestFeedback)
  expect(feedback.text()).toContain('评论已发表')
  expect(wrapper.find('.comment-section__refresh').exists()).toBe(false)
  expect(wrapper.get('textarea').element.value).toBe('尚未提交的草稿')
  expect(wrapper.findAll('.comment-section__thread')).toHaveLength(1)
  expect(wrapper.find('.comment-section__empty').exists()).toBe(false)
  await feedback.get('button').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
  await wrapper.setProps({ busy: true, loading: true })
  await feedback.get('button').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
  await wrapper.setProps({ loadError: '', busy: false, loading: false })
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.get('.comment-section__refresh').text()).toContain('刷新评论')
  expect(wrapper.get('textarea').element.value).toBe('尚未提交的草稿')
})

function pendingComments() {
  let resolve!: (value: CommentList) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<CommentList>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function setupCommentHost() {
  const initial: CommentList = {
    items: [{ id: 1, author: '访客', avatar: '', content: '旧评论', time: '2026-10-18', likes: 0 }],
    total: 1,
  }
  const load = vi.fn<() => Promise<CommentList>>()
  const state = createCommentController({ load, create: vi.fn(), like: vi.fn() }, initial)
  state.draft.value = '尚未提交的草稿'
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(CommentSection, {
            modelValue: state.draft.value,
            comments: state.comments.value,
            total: state.total.value,
            replyTarget: state.replyTarget.value,
            submitting: state.submitting.value,
            loading: state.loading.value,
            busy: state.busy.value,
            canSubmit: state.canSubmit.value,
            submitError: state.submitError.value,
            submitNotice: state.submitNotice.value,
            loadError: state.loadError.value,
            likeError: state.likeError.value,
            pendingLikes: state.pendingLikes.value,
            onRetry: state.reload,
          })
      },
    }),
    { attachTo: document.body, global: { stubs: { ArticleCommentBubble: true } } },
  )
  wrappers.push(wrapper)
  return { wrapper, load, initial }
}
it('真实父组件切换评论读取状态时，将焦点从刷新交给重试并在成功后交回', async () => {
  const { wrapper, load, initial } = await setupCommentHost()
  const failedRequest = pendingComments()
  load.mockReturnValueOnce(failedRequest.promise)
  const refresh = wrapper.get<HTMLButtonElement>('.comment-section__refresh')
  refresh.element.focus()
  await refresh.trigger('click')
  failedRequest.reject(new Error('offline'))
  await flushPromises()
  const retry = wrapper.get<HTMLButtonElement>('.request-feedback button')
  expect(document.activeElement).toBe(retry.element)
  expect(wrapper.find('.comment-section__refresh').exists()).toBe(false)

  const recoveredRequest = pendingComments()
  load.mockReturnValueOnce(recoveredRequest.promise)
  await retry.trigger('click')
  expect(document.activeElement).toBe(retry.element)
  recoveredRequest.resolve(initial)
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('.comment-section__refresh').element)
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.get('textarea').element.value).toBe('尚未提交的草稿')
})
it('评论请求期间用户移到草稿框后，失败或恢复都不抢回焦点', async () => {
  const { wrapper, load, initial } = await setupCommentHost()
  const failedRequest = pendingComments()
  load.mockReturnValueOnce(failedRequest.promise)
  const refresh = wrapper.get<HTMLButtonElement>('.comment-section__refresh')
  refresh.element.focus()
  await refresh.trigger('click')
  const input = wrapper.get<HTMLTextAreaElement>('textarea').element
  input.focus()
  failedRequest.reject(new Error('offline'))
  await flushPromises()
  expect(document.activeElement).toBe(input)

  const recoveredRequest = pendingComments()
  load.mockReturnValueOnce(recoveredRequest.promise)
  const retry = wrapper.get<HTMLButtonElement>('.request-feedback button')
  retry.element.focus()
  await retry.trigger('click')
  input.focus()
  recoveredRequest.resolve(initial)
  await flushPromises()
  expect(document.activeElement).toBe(input)
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
})
