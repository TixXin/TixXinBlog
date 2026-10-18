/**
 * @file articleCommentSection.test.ts
 * @description 文章评论组件的空态、表单读屏反馈、回复焦点、减少动态效果及嵌套互动回归
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import CommentSection from '../../app/components/article/CommentSection.vue'
import CommentBubble from '../../app/components/article/CommentBubble.vue'
import type { CommentItem } from '../../app/features/post/types'

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

const comment: CommentItem = {
  id: 17,
  author: '林间',
  avatar: '',
  content: '这条路线很适合傍晚散步。',
  time: '刚刚',
  likes: 0,
}

function host() {
  const element = document.createElement('div')
  document.body.append(element)
  hosts.push(element)
  return element
}

async function mountSection(overrides: Partial<InstanceType<typeof CommentSection>['$props']> = {}) {
  const wrapper = await mountSuspended(CommentSection, {
    attachTo: host(),
    props: {
      comments: [],
      total: 0,
      replyTarget: null,
      submitting: false,
      loading: false,
      busy: false,
      canSubmit: false,
      submitError: '',
      loadError: '',
      likeError: '',
      pendingLikes: [],
      modelValue: '',
      ...overrides,
    },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('CommentSection 评论表单', () => {
  it('空态、加载失败与加载中互斥，重试按钮保留可访问名称和忙碌状态', async () => {
    const wrapper = await mountSection()
    expect(wrapper.attributes('aria-label')).toBe('文章评论')
    expect(wrapper.get('h2').text()).toBe('评论 (0)')
    expect(wrapper.get('.comment-section__empty').text()).toBe('暂无评论，来写下第一条吧。')
    await wrapper.setProps({ loading: true, busy: true })
    expect(wrapper.find('.comment-section__empty').exists()).toBe(false)
    expect(wrapper.get('ul').attributes('aria-busy')).toBe('true')
    const retry = wrapper.get<HTMLButtonElement>('.comment-section__refresh')
    expect(retry.text()).toBe('正在加载评论…')
    expect(retry.element.disabled).toBe(true)
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toBeUndefined()
    await wrapper.setProps({ loading: false, busy: false, loadError: '评论暂时无法加载' })
    expect(wrapper.find('.comment-section__empty').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toBe('评论暂时无法加载')
    expect(retry.text()).toBe('重试加载评论')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
  })

  it('输入框由标签命名并关联字数提示，输入与提交事件只交给页面处理', async () => {
    const wrapper = await mountSection()
    const input = wrapper.get<HTMLTextAreaElement>('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('label').text()).toBe('评论内容')
    expect(input.attributes('maxlength')).toBe('1000')
    expect(input.attributes('aria-describedby')).toBe('article-comment-limit')
    input.element.focus()
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    await input.setValue('谢谢分享')
    expect(wrapper.emitted('update:modelValue')).toEqual([['谢谢分享']])
    await wrapper.setProps({ modelValue: '谢谢分享', canSubmit: true })
    expect(wrapper.get('#article-comment-limit').text()).toBe('4 / 1000')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false)
    await wrapper.get('form').trigger('submit')
    // 提交事件携带访客防机器人字段：空蜜罐与表单渲染时间，由页面随请求发送。
    expect(wrapper.emitted('submit')).toEqual([[{ website: '', formRenderedAt: expect.any(Number) }]])
  })

  it('失败原因关联到输入框且优先播报，成功提示使用常驻礼貌播报区', async () => {
    const wrapper = await mountSection({ submitNotice: '评论已提交' })
    expect(wrapper.get('[aria-live="polite"] [role="status"]').text()).toBe('评论已提交')
    await wrapper.setProps({ submitError: '请填写评论内容' })
    const input = wrapper.get('textarea')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')?.split(' ')).toEqual(['article-comment-limit', 'article-comment-error'])
    expect(wrapper.get('#article-comment-error[role="alert"]').text()).toBe('请填写评论内容')
    expect(wrapper.find('[aria-live="polite"] [role="status"]').exists()).toBe(false)
    await wrapper.setProps({ submitError: '', submitNotice: '评论已发表' })
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(input.attributes('aria-describedby')).toBe('article-comment-limit')
    expect(wrapper.get('[aria-live="polite"] [role="status"]').text()).toBe('评论已发表')
  })

  it.each([false, true])('回复时聚焦输入框并遵循减少动态效果设置：%s', async (reduced) => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.spyOn(window, 'matchMedia').mockReturnValue({ ...media, matches: reduced } as MediaQueryList)
    const wrapper = await mountSection()
    const input = wrapper.get<HTMLTextAreaElement>('textarea')
    const scroll = vi.spyOn(input.element, 'scrollIntoView').mockImplementation(() => {})
    await wrapper.setProps({ replyTarget: { id: comment.id, author: comment.author } })
    await flushPromises()
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.get('label').text()).toBe('回复内容')
    expect(wrapper.get('button[type="submit"]').text()).toBe('发表回复')
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
    await wrapper.get('.comment-section__reply-target button').trigger('click')
    expect(wrapper.emitted('cancel-reply')).toEqual([[]])
  })

  it('提交中锁定编辑与取消回复，列表事件携带原始评论及编号', async () => {
    const wrapper = await mountSection({ comments: [comment], total: 1, replyTarget: comment })
    await wrapper.get('button[aria-label="回复 林间的评论"]').trigger('click')
    await wrapper.get('button[aria-label="点赞 林间的评论"]').trigger('click')
    expect(wrapper.emitted('reply')).toEqual([[comment]])
    expect(wrapper.emitted('like')).toEqual([[17]])
    await wrapper.setProps({ submitting: true, busy: true, pendingLikes: [17] })
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('.comment-section__reply-target button').element.disabled).toBe(true)
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button[type="submit"]').text()).toBe('正在发表…')
  })
})

describe('CommentBubble 评论互动', () => {
  it('没有回复时不生成空列表；显示头像替代文本，原生按钮可聚焦并播报点赞状态', async () => {
    const wrapper = await mountSuspended(CommentBubble, {
      props: { comment },
      attachTo: host(),
      global: { stubs: { Icon: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.get('img').attributes('alt')).toBe(comment.author)
    const like = wrapper.get<HTMLButtonElement>('button[aria-label="点赞 林间的评论"]')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.element.tabIndex).toBe(0)
    like.element.focus()
    expect(document.activeElement).toBe(like.element)
    await like.trigger('click')
    expect(wrapper.emitted('like')).toEqual([[17]])
    await wrapper.setProps({ comment: { ...comment, liked: true, likes: 1, isOwner: true } })
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.attributes('aria-label')).toBe('取消点赞 林间的评论')
    expect(like.text()).toBe('1')
    expect(wrapper.get('.comment-bubble__badge').text()).toBe('作者')
  })

  it('嵌套回复事件向上传递，最深层隐藏回复按钮且忙碌状态传播到子评论', async () => {
    const leaf: CommentItem = { ...comment, id: 19, author: '远山', content: '已经记下了。' }
    const reply: CommentItem = { ...comment, id: 18, author: '青木', replies: [leaf] }
    const wrapper = await mountSuspended(CommentBubble, {
      props: { comment: { ...comment, replies: [reply] } },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.findAll('button[aria-label^="回复 "]')).toHaveLength(2)
    expect(wrapper.find('button[aria-label="回复 远山的评论"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('已到最深回复层级')
    await wrapper.get('button[aria-label="回复 青木的评论"]').trigger('click')
    await wrapper.get('button[aria-label="点赞 远山的评论"]').trigger('click')
    expect(wrapper.emitted('reply')).toEqual([[reply]])
    expect(wrapper.emitted('like')).toEqual([[19]])
    await wrapper.setProps({ busy: true, pendingLikes: [19] })
    expect(wrapper.findAll<HTMLButtonElement>('button').every((button) => button.element.disabled)).toBe(true)
    const pending = wrapper.get('button[aria-label="点赞 远山的评论"]')
    expect(pending.attributes('aria-busy')).toBe('true')
    expect(pending.text()).toBe('处理中…')
    await pending.trigger('click')
    expect(wrapper.emitted('like')).toHaveLength(1)
    expect(wrapper.get('button[aria-label="点赞 林间的评论"]').attributes('aria-busy')).toBe('false')
  })
})
