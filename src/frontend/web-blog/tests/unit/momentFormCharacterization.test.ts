/** @file momentFormCharacterization.test.ts @description 动态编辑表单的渲染表征：空表单、恢复副本与服务器版本、配图、文章引用与外链字段的结构快照，以及引用类型在父组件不回写时的本地状态，拆分区块前后必须一致 */
import { afterEach, expect, it } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MomentForm from '../../app/components/admin/MomentForm.vue'
import { momentForm } from '../../app/features/moment/editor'
import type { ManagedMoment, MomentEditable } from '../../app/features/moment/types'

const SlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const MediaPicker = defineComponent({
  name: 'AdminMediaPicker',
  props: ['open'],
  emits: ['selected', 'update:open'],
  setup: (props) => () => h('div', { 'data-open': String(props.open) }),
})
const serverVersion: ManagedMoment = {
  id: 'moment-42',
  content: '服务器上的另一段记录\n第二行',
  status: 'archived',
  revision: 7,
  topics: ['摄影', '散步'],
  linkedArticleId: null,
  createdAt: '2026-10-10',
  updatedAt: '2026-10-18',
  date: '2026-10-10',
  likes: 0,
  isLiked: false,
}

type FormProps = InstanceType<typeof MomentForm>['$props']
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function mountForm(patch: Partial<MomentEditable>, props: Partial<FormProps> = {}, sync = true) {
  const value = reactive({ ...momentForm(), content: '晚风吹过河岸', ...patch })
  const wrapper = await mountSuspended(MomentForm, {
    props: {
      value,
      id: null,
      ready: true,
      loading: false,
      saving: false,
      dirty: false,
      saved: null,
      serverVersion: null,
      recovery: null,
      error: '',
      notice: '',
      localError: '',
      articleChoices: [],
      articlesPending: false,
      articlesError: '',
      ...(sync ? { onChange: (change: Partial<MomentEditable>) => Object.assign(value, change) } : {}),
      ...props,
    },
    global: {
      stubs: {
        AdminBackLink: { template: '<a class="back"><slot /></a>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        AdminActionBar: SlotStub,
        CommonTooltip: SlotStub,
        ClientOnly: SlotStub,
        AdminMediaPicker: MediaPicker,
      },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, value }
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

it('空表单与载入中的结构', async () => {
  const empty = await mountForm({ content: '' }, { dirty: true })
  const loading = await mountForm({}, { loading: true, ready: false, saving: true })
  expect([markup(empty.wrapper.html()), markup(loading.wrapper.html())]).toMatchSnapshot()
})

it('已发布动态带恢复副本、服务器版本、配图、文章引用与提示时的结构', async () => {
  const { wrapper } = await mountForm(
    {
      topics: ['夜跑', '城市'],
      images: ['/a.webp', '/b.webp'],
      location: '江边',
      device: 'X100V',
      mood: '平静',
      linkedArticleId: 12,
      status: 'published',
      isPinned: true,
    },
    {
      id: 'moment-42',
      saved: { ...serverVersion, status: 'published' },
      serverVersion,
      recovery: {
        version: 1,
        id: 'moment-42',
        revision: 6,
        requestId: 'r',
        form: { ...momentForm(), content: '本机副本'.repeat(50) },
        savedAt: '2026-10-20 08:00',
      },
      dirty: true,
      error: '版本冲突',
      notice: '已保留当前输入',
      localError: '恢复副本写入失败',
      articleChoices: [
        { id: 12, title: '城市夜跑笔记' },
        { id: 13, title: '江边散步' },
      ],
      articlesPending: true,
      articlesError: '文章搜索失败',
    },
  )
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('外链字段的结构与补全', async () => {
  const { wrapper } = await mountForm({ linkedLink: { url: 'https://example.com/', title: '示例', siteName: '例站' } })
  const trace: unknown[] = [markup(wrapper.get('fieldset').html())]
  await wrapper.get('[aria-label="引用链接地址"]').setValue('https://example.com/a')
  trace.push(wrapper.emitted('change'))
  expect(trace).toMatchSnapshot()
})

it('父组件不回写时，引用类型与文章搜索词保留在表单本地', async () => {
  const { wrapper } = await mountForm({}, {}, false)
  const select = wrapper.get('[aria-label="动态引用类型"]')
  await select.setValue('article')
  const search = wrapper.get('input[type="search"]')
  await search.setValue('夜跑')
  const trace: unknown[] = [
    (select.element as HTMLSelectElement).value,
    markup(wrapper.get('fieldset').html()),
    wrapper.emitted('search-articles'),
  ]
  await wrapper.setProps({ articleChoices: [{ id: 3, title: '夜跑' }] })
  trace.push((wrapper.get('input[type="search"]').element as HTMLInputElement).value)
  await select.setValue('link')
  trace.push(wrapper.find('input[type="search"]').exists(), (select.element as HTMLSelectElement).value)
  await select.setValue('none')
  trace.push(wrapper.emitted('change'), wrapper.emitted('search-articles'))
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '选择或上传图片')!
    .trigger('click')
  trace.push(wrapper.get('[data-open]').attributes('data-open'))
  expect(trace).toMatchSnapshot()
})
