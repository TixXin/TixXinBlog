/** @file galleryForm.test.ts @description 图库表单的必填约束、错误关联、变更载荷与冲突输入保留 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import GalleryForm from '../../app/components/admin/GalleryForm.vue'
import { galleryForm } from '../../app/features/gallery/editor'
import type { GalleryEditable, ManagedPhoto } from '../../app/features/gallery/types'
import type { MediaAsset } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as { currentUser: ReturnType<typeof ref<{ id: string } | null>> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

const wrappers: { unmount(): void }[] = []
const mediaId = '12345678-1234-4123-a123-123456789abc'
const slotStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const imageStub = defineComponent({
  props: ['src', 'alt', 'width', 'height'],
  emits: ['state'],
  setup: (props) => () => h('img', { src: props.src, alt: props.alt, width: props.width, height: props.height }),
})
const mediaPickerStub = defineComponent({
  props: ['open'],
  emits: ['selected', 'update:open'],
  setup: () => () => h('div'),
})
const relationsStub = defineComponent({
  emits: ['choose', 'remove', 'move', 'search', 'page', 'type', 'query', 'resolve'],
  setup: () => () => h('div'),
})
const photo = (patch: Partial<ManagedPhoto> = {}): ManagedPhoto => ({
  ...galleryForm(),
  id: 36,
  title: '山间暮色',
  mediaId,
  externalUrl: null,
  src: '/mountain.webp',
  srcLarge: '/mountain.webp',
  date: '2026-10-10',
  revision: 2,
  createdAt: '2026-10-10',
  updatedAt: '2026-10-11',
  ...patch,
})
type FormProps = InstanceType<typeof GalleryForm>['$props']
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
      dirty: true,
      error: '',
      notice: '',
      localError: '',
      ...props,
    },
    attachTo: document.body,
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
type FormWrapper = Awaited<ReturnType<typeof setup>>
const button = (wrapper: FormWrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)!
const saveButtons = (wrapper: FormWrapper) => [
  wrapper.get<HTMLButtonElement>('button[type="submit"]'),
  button(wrapper, '保存草稿'),
  button(wrapper, '发布作品'),
]
beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'owner' }) }
  mocks.api
    .mockReset()
    .mockImplementation(async (path: string) => (path.endsWith('/resolve') ? [] : { items: [], total: 0 }))
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('图库表单输入与提交', () => {
  it.each([
    ['空标题', { title: '' }],
    ['纯空白标题', { title: '   ' }],
    ['未选择媒体', { mediaId: '' }],
    ['空外链', { source: 'external', externalUrl: '' }],
    ['危险协议', { source: 'external', externalUrl: 'javascript:alert(1)' }],
  ] satisfies [string, Partial<GalleryEditable>][])('%s时禁用全部保存入口，快捷键也不提交', async (_name, value) => {
    const wrapper = await setup(value)
    expect(wrapper.get('[aria-label="作品标题"]').attributes('required')).toBeDefined()
    for (const action of saveButtons(wrapper)) {
      expect((action.element as HTMLButtonElement).disabled).toBe(true)
      await action.trigger('click')
    }
    await wrapper.get('[aria-label="作品标题"]').trigger('keydown', { key: 's', ctrlKey: true })
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('非法外链将错误文本关联到输入，修正后移除错误关联并恢复保存', async () => {
    const wrapper = await setup({ source: 'external', externalUrl: 'https://user:secret@example.com/photo.webp' })
    const input = wrapper.get('[aria-label="外部图片地址"]')
    const error = wrapper.get('#gallery-url-error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toBe('地址不完整或含有凭据')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')?.split(' ')).toEqual(['gallery-url-help', 'gallery-url-error'])
    expect(wrapper.get('#gallery-url-help').text()).toContain('地址不会被服务器下载或检查')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)

    const validUrl = 'https://images.example.com/Street.webp?signature=Ab%2Fc'
    await input.setValue(validUrl)
    expect(wrapper.emitted('change')).toEqual([[{ externalUrl: validUrl }]])
    await wrapper.setProps({ value: { ...wrapper.props('value'), externalUrl: validUrl } })
    expect(input.attributes('aria-invalid')).toBe('false')
    expect(input.attributes('aria-describedby')).toBe('gallery-url-help')
    expect(wrapper.find('#gallery-url-error').exists()).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false)
  })

  it('外链预览失败只提示显示问题，合法地址仍可按当前状态提交', async () => {
    const wrapper = await setup({ source: 'external', externalUrl: 'https://images.example.com/street.webp' })
    wrapper.getComponent(imageStub).vm.$emit('state', 'error')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('也可以保存此合法地址')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([['draft']])
  })

  it('每个原生字段发出局部变更，日期清空为null、排序为数字且不改写props', async () => {
    const wrapper = await setup({ source: 'external', externalUrl: 'https://images.example.com/original.webp' })
    const original = structuredClone(wrapper.props('value'))
    const fields: [string, string, Partial<GalleryEditable>][] = [
      ['作品标题', ' 清晨的街角 ', { title: ' 清晨的街角 ' }],
      ['作品说明', '保留完整说明\n第二行', { description: '保留完整说明\n第二行' }],
      ['外部图片地址', 'https://images.example.com/new.webp', { externalUrl: 'https://images.example.com/new.webp' }],
      ['作品分类', '街头', { category: '街头' }],
      ['拍摄日期', '2026-10-12', { takenOn: '2026-10-12' }],
      ['拍摄日期', '', { takenOn: null }],
      ['拍摄地点', '老城', { location: '老城' }],
      ['拍摄器材', '定焦镜头', { device: '定焦镜头' }],
      ['作品保存状态', 'withdrawn', { status: 'withdrawn' }],
      ['作品排序值', '-12', { sortOrder: -12 }],
      ['图片来源', 'media', { source: 'media' }],
    ]
    for (const [label, value, patch] of fields) {
      await wrapper.get(`[aria-label="${label}"]`).setValue(value)
      expect(wrapper.emitted('change')?.at(-1)).toEqual([patch])
    }
    expect(wrapper.emitted('change')).toHaveLength(fields.length)
    expect(wrapper.props('value')).toEqual(original)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('选择媒体仅发出媒体编号，关联选择仅发出有序类型与编号', async () => {
    const wrapper = await setup({ relatedContent: [{ type: 'post', id: 3 }] })
    const asset: MediaAsset = {
      id: '12345678-1234-4123-a123-123456789def',
      name: 'morning.webp',
      url: '/morning.webp',
      alt: '清晨的街角',
      description: '',
      width: 1200,
      height: 800,
      byteSize: 2048,
      mimeType: 'image/webp',
      createdAt: '2026-10-12',
      deleted: false,
    }
    await button(wrapper, '选择或上传图片').trigger('click')
    expect(wrapper.getComponent(mediaPickerStub).props('open')).toBe(true)
    wrapper.getComponent(mediaPickerStub).vm.$emit('selected', asset)
    wrapper.getComponent(relationsStub).vm.$emit('choose', { type: 'project', id: 7, title: '晨光项目' })
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('change')).toEqual([
      [{ mediaId: asset.id }],
      [
        {
          relatedContent: [
            { type: 'post', id: 3 },
            { type: 'project', id: 7 },
          ],
        },
      ],
    ])
    await wrapper.setProps({ value: { ...wrapper.props('value'), mediaId: asset.id } })
    expect(wrapper.getComponent(imageStub).props()).toMatchObject({
      src: `/api/v1/media/${asset.id}.webp`,
      width: 1200,
      height: 800,
    })
  })

  it('切换图片来源保留两套输入，组件不自行清空另一来源', async () => {
    const externalUrl = 'https://images.example.com/street.webp'
    const wrapper = await setup({ externalUrl })
    await wrapper.get('[aria-label="图片来源"]').setValue('external')
    expect(wrapper.emitted('change')).toEqual([[{ source: 'external' }]])
    await wrapper.setProps({ value: { ...wrapper.props('value'), source: 'external' } })
    expect(wrapper.get<HTMLInputElement>('[aria-label="外部图片地址"]').element.value).toBe(externalUrl)
    await wrapper.get('[aria-label="图片来源"]').setValue('media')
    await wrapper.setProps({ value: { ...wrapper.props('value'), source: 'media' } })
    expect(wrapper.emitted('change')).toEqual([[{ source: 'external' }], [{ source: 'media' }]])
    expect(wrapper.props('value')).toMatchObject({ mediaId, externalUrl })
    expect(wrapper.getComponent(imageStub).props('src')).toBe(`/api/v1/media/${mediaId}.webp`)
  })

  it('提交当前状态与草稿、发布动作分别发出单一状态参数', async () => {
    const wrapper = await setup({ status: 'withdrawn' })
    await wrapper.get('form').trigger('submit')
    await button(wrapper, '保存草稿').trigger('click')
    await button(wrapper, '发布作品').trigger('click')
    expect(wrapper.emitted('save')).toEqual([['withdrawn'], ['draft'], ['published']])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.props('value').status).toBe('withdrawn')
  })

  it.each([
    [1000001, 'rangeOverflow'],
    [-1000001, 'rangeUnderflow'],
    [1.5, 'stepMismatch'],
  ] as const)('排序值 %s 违反原生 %s 约束时，主提交、草稿与发布均不保存', async (sortOrder, validityKey) => {
    const wrapper = await setup({ sortOrder })
    const input = wrapper.get<HTMLInputElement>('[aria-label="作品排序值"]')
    expect(input.element.validity[validityKey]).toBe(true)
    wrapper
      .get<HTMLFormElement>('form')
      .element.requestSubmit(wrapper.get<HTMLButtonElement>('button[type="submit"]').element)
    expect(wrapper.emitted('save')).toBeUndefined()
    await button(wrapper, '保存草稿').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await button(wrapper, '发布作品').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it.each([-1000000, 1000000])('排序合法边界 %s 允许按当前状态、草稿与发布保存', async (sortOrder) => {
    const wrapper = await setup({ sortOrder, status: 'withdrawn' })
    expect(wrapper.get<HTMLInputElement>('[aria-label="作品排序值"]').element.validity.valid).toBe(true)
    wrapper
      .get<HTMLFormElement>('form')
      .element.requestSubmit(wrapper.get<HTMLButtonElement>('button[type="submit"]').element)
    await button(wrapper, '保存草稿').trigger('click')
    await button(wrapper, '发布作品').trigger('click')
    expect(wrapper.emitted('save')).toEqual([['withdrawn'], ['draft'], ['published']])
  })

  it.each([
    ['尚未就绪', { ready: false }],
    ['读取中', { loading: true }],
    ['保存中', { saving: true }],
  ])('%s时阻止按钮与快捷键重复提交', async (_name, props) => {
    const wrapper = await setup({}, props)
    for (const action of saveButtons(wrapper)) {
      expect((action.element as HTMLButtonElement).disabled).toBe(true)
      await action.trigger('click')
    }
    await wrapper.get('[aria-label="作品标题"]').trigger('keydown', { key: 's', metaKey: true })
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe(String(!!props.saving))
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('冲突展示服务器完整资料，合并与重读只发出对应事件并保留本地输入', async () => {
    const local = galleryForm({
      title: '本地尚未保存的标题',
      description: '本地说明',
      source: 'external',
      externalUrl: 'https://images.example.com/local.webp',
      mediaId,
      category: '本地分类',
      takenOn: '2026-10-09',
      location: '本地地点',
      device: '本地器材',
      status: 'draft',
      sortOrder: 8,
      relatedContent: [{ type: 'post', id: 3 }],
    })
    const server = photo({
      title: '服务器的山间暮色',
      description: '服务器保留的完整说明',
      category: '山野',
      takenOn: '2026-10-08',
      location: '山谷',
      device: '长焦镜头',
      status: 'withdrawn',
      sortOrder: 23,
      revision: 5,
      relatedContent: [
        { type: 'project', id: 7 },
        { type: 'gallery', id: 8 },
      ],
    })
    const wrapper = await setup(local, { id: 36, saved: photo() })
    await wrapper.setProps({ error: '作品已被其他窗口修改，请核对后合并', serverVersion: server })
    expect(wrapper.get('[role="alert"]').text()).toContain('作品已被其他窗口修改')
    const comparison = wrapper.get('[aria-label="作品服务器版本"]')
    for (const text of [
      '版本 5',
      server.title,
      server.description,
      '已撤回',
      '排序 23',
      '山野',
      '2026-10-08',
      '山谷',
      '长焦镜头',
      '项目 #7 → 图库 #8',
    ])
      expect(comparison.text()).toContain(text)
    expect(comparison.get('img').attributes('src')).toBe(server.src)
    expect(wrapper.get<HTMLInputElement>('[aria-label="作品标题"]').element.value).toBe(local.title)
    expect(wrapper.get<HTMLTextAreaElement>('[aria-label="作品说明"]').element.value).toBe(local.description)
    expect(wrapper.get<HTMLInputElement>('[aria-label="外部图片地址"]').element.value).toBe(local.externalUrl)
    await button(wrapper, '保留输入，按最新版本继续合并').trigger('click')
    await button(wrapper, '保留副本并载入服务器版本').trigger('click')
    expect(wrapper.emitted('merge')).toEqual([[]])
    expect(wrapper.emitted('reload')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.props('value')).toEqual(local)
    await wrapper.setProps({ saving: true })
    expect((button(wrapper, '保留输入，按最新版本继续合并').element as HTMLButtonElement).disabled).toBe(true)
    expect((button(wrapper, '保留副本并载入服务器版本').element as HTMLButtonElement).disabled).toBe(true)
  })
})
