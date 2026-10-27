/** @file galleryFormCharacterization.test.ts @description 图库编辑表单的渲染表征：恢复副本、旧副本、服务器版本、外链与媒体两种来源及保存信息的结构快照与事件转发，拆分区块前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import GalleryForm from '../../app/components/admin/GalleryForm.vue'
import { galleryForm, type GalleryRecovery } from '../../app/features/gallery/editor'
import type { GalleryEditable, ManagedPhoto } from '../../app/features/gallery/types'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }) }))

const mediaId = '12345678-1234-4123-a123-123456789abc'
const slotStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const imageStub = defineComponent({
  props: ['src', 'alt', 'width', 'height', 'fit', 'loading'],
  emits: ['state'],
  setup:
    (props, { emit }) =>
    () =>
      h('img', {
        src: props.src,
        alt: props.alt,
        width: props.width,
        height: props.height,
        onLoad: () => emit('state', 'ready'),
      }),
})
const mediaPickerStub = defineComponent({
  name: 'AdminMediaPicker',
  props: ['open'],
  emits: ['selected', 'update:open'],
  setup: (props) => () => h('div', { 'data-open': String(props.open) }),
})
const relationsStub = defineComponent({
  emits: ['choose', 'remove', 'move', 'search', 'page', 'type', 'query', 'resolve'],
  setup: () => () => h('div', { class: 'relations' }),
})
const photo = (patch: Partial<ManagedPhoto> = {}): ManagedPhoto => ({
  ...galleryForm(),
  id: 36,
  title: '山间暮色',
  description: '第一行\n第二行',
  mediaId,
  externalUrl: null,
  src: '/mountain.webp',
  srcLarge: '/mountain.webp',
  width: 1600,
  height: 900,
  category: '风景',
  takenOn: '2026-10-01',
  location: '黄山',
  device: 'X100V',
  status: 'published',
  sortOrder: 3,
  date: '2026-10-10',
  revision: 2,
  createdAt: '2026-10-10',
  updatedAt: '2026-10-11',
  publishedAt: '2026-10-12',
  ...patch,
})
const recovery = (title: string): GalleryRecovery => ({
  version: 2,
  context: '',
  id: 36,
  revision: 2,
  requestId: '12345678-1234-4123-a123-123456789abd',
  form: { ...galleryForm(), title, mediaId },
  pendingCreate: null,
  savedAt: '2026-10-20 08:00',
})

type FormProps = InstanceType<typeof GalleryForm>['$props']
const wrappers: { unmount(): void }[] = []
async function setup(value: Partial<GalleryEditable> = {}, props: Partial<FormProps> = {}) {
  const wrapper = await mountSuspended(GalleryForm, {
    props: {
      value: { ...galleryForm(), title: '雨后的街角', mediaId, ...value },
      id: null,
      saved: null,
      serverVersion: null,
      recovery: null,
      previousRecoveries: [],
      ready: true,
      loading: false,
      saving: false,
      dirty: false,
      error: '',
      notice: '',
      localError: '',
      ...props,
    },
    global: {
      stubs: {
        AdminBackLink: slotStub,
        AdminActionBar: slotStub,
        CommonTooltip: slotStub,
        CommonImageFrame: imageStub,
        AdminMediaPicker: mediaPickerStub,
        AdminContentRelations: relationsStub,
        ClientOnly: slotStub,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
/** 去掉 scoped 样式标记与随机生成的标识，只比较结构、属性与文字 */
const markup = (html: string) =>
  html.replace(/ data-v-[a-f0-9]+(="")?/g, '').replace(/(id|for|aria-[a-z]+)="(v|el|reka|radix)-[^"]*"/g, '$1="<id>"')

beforeEach(() => {
  mocks.api
    .mockReset()
    .mockImplementation(async (path: string) => (path.endsWith('/resolve') ? [] : { items: [], total: 0 }))
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('新建：媒体来源未选图，未保存', async () => {
  const wrapper = await setup({ mediaId: '' })
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('编辑：恢复副本、旧副本、服务器版本、提示与已保存信息', async () => {
  const saved = photo()
  const wrapper = await setup(
    { ...saved },
    {
      id: 36,
      saved,
      serverVersion: photo({ revision: 3, title: '暮色新版', category: '', takenOn: null, location: '', device: '' }),
      recovery: recovery('本机副本'),
      previousRecoveries: [{ key: 'old', value: recovery('更早的副本') }],
      dirty: true,
      error: '保存失败',
      notice: '已保存',
      localError: '本机保存失败',
    },
  )
  expect(markup(wrapper.html())).toMatchSnapshot()
  for (const text of [
    '重新读取',
    '重试保存恢复副本',
    '恢复输入',
    '移除恢复副本',
    '保留副本并载入服务器版本',
    '保留输入，按最新版本继续合并',
  ]) {
    const target = wrapper.findAll('button').find((candidate) => candidate.text() === text)
    expect(target, text).toBeDefined()
    await target!.trigger('click')
  }
  expect(
    Object.keys(wrapper.emitted())
      .filter((name) => ['reload', 'persist', 'restore', 'discard', 'merge'].includes(name))
      .sort(),
  ).toEqual(['discard', 'merge', 'persist', 'reload', 'restore'])
  expect(wrapper.emitted('reload')).toHaveLength(2)
})

it('外链来源：非法地址、合法地址预览与加载状态', async () => {
  const invalid = await setup({ source: 'external', externalUrl: 'ftp://example.com/a.webp', mediaId: '' })
  expect(markup(invalid.html())).toMatchSnapshot()
  const valid = await setup({ source: 'external', externalUrl: 'https://images.example.com/a.webp', mediaId: '' })
  expect(markup(valid.html())).toMatchSnapshot()
  await valid.get('img').trigger('load')
  expect(markup(valid.html())).toMatchSnapshot()
})

it('来源切换、选图与字段变更都向上转发 change', async () => {
  const wrapper = await setup()
  await wrapper.get('select[aria-label="图片来源"]').setValue('external')
  await wrapper
    .findAll('button')
    .find((candidate) => candidate.text() === '选择或上传图片')!
    .trigger('click')
  const picker = wrapper.findComponent({ name: 'AdminMediaPicker' })
  expect(picker.props('open')).toBe(true)
  picker.vm.$emit('selected', { id: 'abcdefab-1234-4123-a123-123456789abc', width: 800, height: 600 })
  await wrapper.setProps({ value: { ...wrapper.props('value'), mediaId: 'abcdefab-1234-4123-a123-123456789abc' } })
  expect(wrapper.get('img').attributes()).toMatchObject({ width: '800', height: '600' })
  expect(wrapper.emitted('change')).toEqual([
    [{ source: 'external' }],
    [{ mediaId: 'abcdefab-1234-4123-a123-123456789abc' }],
  ])
})
