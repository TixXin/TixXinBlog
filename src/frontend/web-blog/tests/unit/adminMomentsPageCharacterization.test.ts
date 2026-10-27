/** @file adminMomentsPageCharacterization.test.ts @description 朋友圈管理页的渲染表征：筛选、动态卡片、分页与评论面板的结构快照，卡片与评论操作的调用参数，以及打开、关闭评论面板时的焦点，拆分区块前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MomentsPage from '../../app/pages/admin/moments/index.vue'
import type { ManagedMoment, MomentCommentItem } from '../../app/features/moment/types'

type State = Record<string, Ref<unknown> | ((...args: unknown[]) => unknown)>
const mocks = vi.hoisted(() => ({ state: {} as State }))
mockNuxtImport('useAdminMoments', () => () => mocks.state)

const note = (id: string, patch: Partial<ManagedMoment> = {}): ManagedMoment => ({
  id,
  content: `动态 ${id}\n第二行`,
  topics: ['散步', '夜跑'],
  status: 'published',
  isPinned: false,
  revision: 1,
  linkedArticleId: null,
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-11T08:00:00.000Z',
  date: '2026-10-10',
  likes: 0,
  isLiked: false,
  ...patch,
})
const comment = (id: string, patch: Partial<MomentCommentItem> = {}): MomentCommentItem => ({
  id,
  author: `访客${id}`,
  avatar: '',
  content: `评论 ${id}\n换行`,
  time: '2026-10-12',
  ...patch,
})

function createState() {
  const fn = (name: string) => vi.fn(() => Promise.resolve(name === 'closeComments' ? true : undefined))
  return {
    restoringPending: ref(false),
    isLoggedIn: ref(true),
    items: ref([
      note('a', { isPinned: true }),
      note('b', { status: 'draft', topics: undefined }),
      note('c', { status: 'archived' }),
    ]),
    total: ref(40),
    pending: ref(false),
    error: ref(''),
    search: ref('夜'),
    status: ref('all'),
    topic: ref(''),
    date: ref(''),
    page: ref(2),
    busyIds: ref<string[]>(['c']),
    commentNote: ref<ManagedMoment | null>(null),
    commentItems: ref([
      comment('1', { moderationStatus: 'published', isOwner: true }),
      comment('2', { moderationStatus: 'hidden' }),
      comment('3', { moderationStatus: 'pending' }),
      comment('4'),
    ]),
    commentTotal: ref(20),
    commentPage: ref(1),
    commentsPending: ref(false),
    commentsError: ref(''),
    commentTargetId: ref<string | null>('3'),
    commentsLinkError: ref(''),
    commentsLinkPending: ref(false),
    commentsFocusVersion: ref(0),
    replyDraft: ref(''),
    replyPending: ref(false),
    ...Object.fromEntries(
      [
        'load',
        'applyFilters',
        'setPage',
        'update',
        'remove',
        'openLinkedComments',
        'openComments',
        'closeComments',
        'moderate',
        'removeComment',
        'reply',
      ].map((name) => [name, fn(name)]),
    ),
  }
}

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.state = createState() as unknown as State
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function mountPage() {
  const wrapper = await mountSuspended(MomentsPage, {
    route: '/admin/moments',
    attachTo: document.body,
    global: {
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        ClientOnly: { template: '<div><slot /></div>' },
        CommonDatePicker: { props: ['modelValue'], template: '<input class="date" :value="modelValue" />' },
        CommonRequestFeedback: {
          props: ['pending', 'compact', 'title'],
          template: '<p class="feedback">{{ title }}</p>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')
const state = () => mocks.state as unknown as ReturnType<typeof createState>
/** 事件对象只记类型，记录项只记编号 */
const argLabel = (arg: unknown) =>
  arg instanceof Event ? `<Event:${arg.type}>` : ((arg as { id?: string } | null)?.id ?? arg)
const calls = (name: string) => vi.mocked(mocks.state[name] as (...args: unknown[]) => unknown).mock.calls

it('列表、分页与评论面板（已发布与未发布）的结构，以及载入、错误与未登录', async () => {
  const wrapper = await mountPage()
  const trace: string[] = [markup(wrapper.html())]
  state().commentNote.value = state().items.value[0]!
  await nextTick()
  trace.push(markup(wrapper.get('.admin-moments__comments').html()))
  state().commentNote.value = state().items.value[1]!
  Object.assign(state(), {})
  state().commentsPending.value = true
  state().commentTotal.value = 3
  await nextTick()
  trace.push(markup(wrapper.get('.admin-moments__comments').html()))
  state().commentNote.value = null
  state().items.value = []
  state().total.value = 0
  state().error.value = '读取失败'
  state().commentsLinkError.value = '定位失败'
  await nextTick()
  trace.push(markup(wrapper.html()))
  state().error.value = ''
  await nextTick()
  trace.push(markup(wrapper.get('section').html()))
  state().isLoggedIn.value = false
  await nextTick()
  trace.push(markup(wrapper.get('section').html()))
  expect(trace).toMatchSnapshot()
})

it('筛选、卡片操作、分页与评论操作的调用参数', async () => {
  const wrapper = await mountPage()
  await wrapper.get('[aria-label="搜索动态"]').setValue('河')
  await wrapper.get('form').trigger('submit')
  const card = (index: number) => wrapper.findAll('.admin-moments__list > li')[index]!
  for (const index of [0, 1, 2]) for (const button of card(index).findAll('button')) await button.trigger('click')
  for (const button of wrapper.findAll('nav button')) await button.trigger('click')
  state().commentNote.value = state().items.value[0]!
  state().replyDraft.value = '谢谢'
  await nextTick()
  const panel = wrapper.get('.admin-moments__comments')
  for (const button of panel.findAll('li button')) await button.trigger('click')
  for (const button of panel.findAll('nav button')) await button.trigger('click')
  await panel.get('form').trigger('submit')
  expect({
    search: state().search.value,
    disabled: [0, 1, 2].map((index) =>
      card(index)
        .findAll('button')
        .map((button) => button.attributes('disabled') !== undefined),
    ),
    ...Object.fromEntries(
      ['applyFilters', 'update', 'remove', 'setPage', 'openComments', 'moderate', 'removeComment', 'reply'].map(
        (name) => [name, calls(name).map((args) => args.map(argLabel))],
      ),
    ),
  }).toMatchSnapshot()
})

it('打开评论面板时焦点移到面板，关闭后回到触发按钮；定位版本变化时聚焦目标评论', async () => {
  const wrapper = await mountPage()
  const trigger = wrapper.findAll('.admin-moments__list > li')[0]!.findAll('button').at(-2)!
  vi.mocked(state().openComments).mockImplementation(() => {
    state().commentNote.value = state().items.value[0]!
    return Promise.resolve()
  })
  await trigger.trigger('click')
  await flushPromises()
  const trace: unknown[] = [document.activeElement?.className]
  state().commentsFocusVersion.value++
  await nextTick()
  await nextTick()
  trace.push((document.activeElement as HTMLElement | null)?.dataset.commentId)
  vi.mocked(state().closeComments).mockImplementation(() => {
    state().commentNote.value = null
    return true
  })
  await wrapper.get('.admin-moments__comments > button').trigger('click')
  await flushPromises()
  trace.push(document.activeElement === trigger.element, calls('closeComments').length)
  expect(trace).toMatchSnapshot()
})
