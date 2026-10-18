/** @file visitorSubmissionForms.test.ts @description 四类访客表单的蜜罐可访问性、原值透传与客户端生命周期 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useVisitorSubmissionForm } from '~/composables/useVisitorSubmissionForm'
import CommentSection from '~/components/article/CommentSection.vue'
import MessageInput from '~/components/guestbook/MessageInput.vue'
import MomentCommentSection from '~/components/moment/MomentCommentSection.vue'
import MomentList from '~/components/moment/MomentList.vue'
import { momentSession, seedMomentState } from '~/features/moment/session'
import FlashNoteCard from '~/components/flash/FlashNoteCard.vue'
import type { FlashCommentSubmission, FlashNote } from '~/features/flash/types'
import type { VisitorSubmissionFields } from '~/features/visitor/types'

mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
const wrappers: VueWrapper[] = []
// 计时使用单调时钟，用例推进 performance.now 模拟填写耗时。
let now = 1_000_000
beforeEach(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
const articleProps = {
  modelValue: '文章回复草稿',
  comments: [],
  total: 0,
  replyTarget: { id: 1, author: '访客' },
  submitting: false,
  loading: false,
  busy: false,
  canSubmit: true,
  submitError: '',
  loadError: '',
  likeError: '',
  pendingLikes: [],
}
const flash: FlashNote = {
  id: 'flash',
  userId: 'owner',
  content: '公开闪念',
  tags: [],
  images: [],
  type: 'memo',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  likes: 0,
  comments: [],
}

describe('公开表单防垃圾字段', () => {
  it.each(['article', 'guestbook', 'moment', 'flash'] as const)(
    '%s 表单隐藏字段不参与焦点且原样发送非空内容',
    async (kind) => {
      const wrapper =
        kind === 'article'
          ? await mountSuspended(CommentSection, { props: articleProps })
          : kind === 'guestbook'
            ? await mountSuspended(MessageInput, {
                props: { draft: '留言草稿', ready: true, submitting: false, identityLabel: '访客' },
              })
            : kind === 'moment'
              ? await mountSuspended(MomentCommentSection, { props: { draft: '朋友圈草稿', comments: [] } })
              : await mountSuspended(FlashNoteCard, { props: { note: flash, readOnly: true } })
      wrappers.push(wrapper)
      if (kind === 'flash') {
        await wrapper.get('button[aria-label="评论"]').trigger('click')
        await wrapper.get('input[aria-label="闪念评论内容"]').setValue('闪念草稿')
      }
      const trap = wrapper.get('input[name="website"]')
      expect(trap.attributes()).toMatchObject({ tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' })
      expect(trap.element.closest('[hidden][aria-hidden="true"]')).not.toBeNull()
      expect((trap.element as HTMLInputElement).value).toBe('')
      await trap.setValue('  robot.example  ')
      if (kind === 'article' || kind === 'flash') await wrapper.get('form').trigger('submit')
      else if (kind === 'guestbook') await wrapper.get('button.message-input__send').trigger('click')
      else await wrapper.get('button[aria-label="发送评论"]').trigger('click')
      const event = kind === 'guestbook' ? 'send' : kind === 'flash' ? 'add-comment' : 'submit'
      expect(wrapper.emitted(event)?.[0]?.[0]).toMatchObject({ website: '  robot.example  ', formElapsedMs: 0 })
    },
  )

  it('文章提交失败保留蜜罐和计时，成功后重置；重新挂载产生新时间', async () => {
    const wrapper = await mountSuspended(CommentSection, { props: articleProps })
    wrappers.push(wrapper)
    await wrapper.get('input[name="website"]').setValue('robot')
    await wrapper.setProps({ submitting: true })
    now += 2000
    await wrapper.setProps({ submitting: false, submitError: '提交失败，请稍后重试' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ website: 'robot', formElapsedMs: 2000 })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('文章回复草稿')
    await wrapper.setProps({ submitting: true, submitError: '' })
    now += 2000
    await wrapper.setProps({ submitting: false, modelValue: '' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[1]?.[0]).toEqual({ website: '', formElapsedMs: 0 })
    now += 2000
    const remounted = await mountSuspended(CommentSection, { props: articleProps })
    wrappers.push(remounted)
    await remounted.get('form').trigger('submit')
    expect(remounted.emitted('submit')?.[0]?.[0]).toMatchObject({ formElapsedMs: 0 })
  })

  it('闪念只从展开时开始计时，失败保留草稿，成功与重新展开重新计时', async () => {
    const wrapper = await mountSuspended(FlashNoteCard, { props: { note: flash, readOnly: true } })
    wrappers.push(wrapper)
    now += 1000
    await wrapper.get('button[aria-label="评论"]').trigger('click')
    await wrapper.get('input[aria-label="闪念评论内容"]').setValue('保留草稿')
    await wrapper.get('input[name="website"]').setValue('robot')
    await wrapper.get('form').trigger('submit')
    const first = wrapper.emitted('add-comment')![0]![0] as FlashCommentSubmission
    expect(first).toMatchObject({ formElapsedMs: 0, website: 'robot' })
    first.complete?.(false)
    await wrapper.vm.$nextTick()
    now += 2000
    await wrapper.get('form').trigger('submit')
    const retry = wrapper.emitted('add-comment')![1]![0] as FlashCommentSubmission
    expect(retry).toMatchObject({ content: '保留草稿', formElapsedMs: 2000, website: 'robot' })
    retry.complete?.(true)
    await wrapper.vm.$nextTick()
    expect((wrapper.get('input[aria-label="闪念评论内容"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[name="website"]').element as HTMLInputElement).value).toBe('')
    await wrapper.get('button[aria-label="评论"]').trigger('click')
    now += 2000
    await wrapper.get('button[aria-label="评论"]').trigger('click')
    await wrapper.get('input[aria-label="闪念评论内容"]').setValue('下一条')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('add-comment')![2]![0] as VisitorSubmissionFields).toMatchObject({
      formElapsedMs: 0,
      website: '',
    })
  })
})

it('朋友圈完整列表经 Card 与表单向页面透传蜜罐字段', async () => {
  const note = {
    id: 'moment',
    content: '动态',
    date: '2026-10-18',
    likes: 0,
    isLiked: false,
    comments: [{ id: 'comment', author: '访客', avatar: '', content: '已公开评论', time: '2026-10-18' }],
  }
  const session = momentSession({})
  const state = seedMomentState(session, note)
  state.draft = '新的评论'
  const wrapper = await mountSuspended(MomentList, {
    props: {
      moments: [note],
      ownerProfile: { name: '博主', avatar: '' },
      states: session.states,
      pending: false,
      hasMore: false,
    },
  })
  wrappers.push(wrapper)
  await wrapper.get('input[name="website"]').setValue(' robot ')
  await wrapper.get('button[aria-label="发送评论"]').trigger('click')
  expect(wrapper.emitted('comment')?.[0]?.[0]).toEqual({ id: 'moment', website: ' robot ', formElapsedMs: 0 })
})

it('表单建立时不生成服务端计时，挂载后才取得客户端时刻', async () => {
  let initial!: VisitorSubmissionFields
  let form!: ReturnType<typeof useVisitorSubmissionForm>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        form = useVisitorSubmissionForm()
        initial = form.fields()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  expect(initial).toEqual({ website: '', formElapsedMs: undefined })
  expect(form.fields()).toEqual({ website: '', formElapsedMs: 0 })
})

it('填写时长只取单调时钟差值，不受设备时间偏差影响，并截断到服务端上限', async () => {
  // 设备时钟比服务端快一天，不应影响上报的填写时长。
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T00:00:00Z'))
  let form!: ReturnType<typeof useVisitorSubmissionForm>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        form = useVisitorSubmissionForm()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  now += 1500.4
  expect(form.fields()).toEqual({ website: '', formElapsedMs: 1500 })
  now += 31 * 24 * 60 * 60 * 1000
  expect(form.fields().formElapsedMs).toBe(30 * 24 * 60 * 60 * 1000)
})
