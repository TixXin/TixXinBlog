/** @file linkEditorForm.test.ts @description 友链表单的原生校验、错误播报、编辑载荷与冲突输入保护 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LinkEditorForm from '../../app/components/admin/LinkEditorForm.vue'
import { linkForm } from '../../app/features/link/editor'
import type { LinkEditable, ManagedLink } from '../../app/features/link/types'
import type { MediaAsset } from '../../app/features/media/types'

const wrappers: { unmount(): void }[] = []
const media: MediaAsset = {
  id: '8b7c145a-50b1-4b98-9867-87de592527ab',
  name: '站点标志.webp',
  url: '/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab.webp',
  alt: '站点标志',
  description: '',
  width: 320,
  height: 320,
  byteSize: 2048,
  mimeType: 'image/webp',
  createdAt: '2026-10-01T00:00:00.000Z',
  deleted: false,
}
const MediaPicker = defineComponent({
  props: { open: Boolean },
  emits: ['selected', 'update:open'],
  setup:
    (props, { emit }) =>
    () =>
      props.open ? h('button', { type: 'button', onClick: () => emit('selected', media) }, '选用站点标志') : null,
})

function managedLink(patch: Partial<ManagedLink> = {}): ManagedLink {
  return {
    ...linkForm(),
    id: 18,
    name: '设计札记',
    description: '关于设计与写作的记录',
    url: 'https://example.com/Notes/?q=1&q=2#Reading',
    domain: 'example.com',
    avatar: null,
    width: null,
    height: null,
    publishedAt: null,
    revision: 3,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...patch,
  }
}

async function setup(
  initial: Partial<LinkEditable> = {},
  props: Partial<Omit<InstanceType<typeof LinkEditorForm>['$props'], 'value' | 'onChange'>> = {},
) {
  const value = reactive(linkForm({ ...managedLink(), ...initial }))
  const wrapper = await mountSuspended(LinkEditorForm, {
    props: {
      value,
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
      // 仅模拟父页面回传编辑值，保存和校验仍由被测组件的真实事件与原生控件执行。
      onChange: (patch) => Object.assign(value, patch),
    },
    attachTo: document.body,
    global: {
      stubs: {
        AdminBackLink: true,
        CommonTooltip: { template: '<span><slot /></span>' },
        CommonImageFrame: true,
        ClientOnly: { template: '<div><slot /></div>' },
        AdminMediaPicker: MediaPicker,
      },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, value }
}

afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('友链表单必填与原生字段约束', () => {
  it.each([{ name: '', url: '' }, { name: '   ' }, { url: '' }, { url: '   ' }])(
    '名称或地址为空白时禁止三种保存入口：%j',
    async (initial) => {
      const { wrapper } = await setup(initial)
      const name = wrapper.get<HTMLInputElement>('[aria-label="友链站点名称"]')
      const url = wrapper.get<HTMLInputElement>('[aria-label="友链站点地址"]')
      expect(name.element.required).toBe(true)
      expect(url.element.required).toBe(true)
      expect(name.element.closest('label')?.textContent).toContain('站点名称')
      expect(url.element.closest('label')?.textContent).toContain('站点地址')
      expect(name.element.maxLength).toBe(80)
      expect(url.element.maxLength).toBe(2048)
      const buttons = wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')
      expect(buttons.map((button) => button.text())).toEqual(['保存友链', '保存草稿', '上架友链'])
      for (const button of buttons) {
        expect(button.element.disabled).toBe(true)
        button.element.click()
      }
      expect(wrapper.emitted('save')).toBeUndefined()
    },
  )

  it.each(['example.com', 'ftp://example.com', 'javascript:alert(1)'])(
    '站点地址 %s 不能通过任一保存入口',
    async (url) => {
      const { wrapper } = await setup({ url })
      const input = wrapper.get<HTMLInputElement>('[aria-label="友链站点地址"]')
      expect(input.attributes('type')).toBe('url')
      expect(input.attributes('pattern')).toBe('https?://.+')
      expect(input.element.checkValidity()).toBe(false)
      for (const button of wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')) await button.trigger('click')
      expect(wrapper.emitted('save')).toBeUndefined()
    },
  )

  it('Logo 允许留空或 HTTPS 地址，拒绝 HTTP 地址且保留输入', async () => {
    const { wrapper, value } = await setup()
    const logo = wrapper.get<HTMLInputElement>('[aria-label="外部Logo地址"]')
    expect(logo.element.required).toBe(false)
    expect(logo.element.checkValidity()).toBe(true)
    await logo.setValue('http://example.com/logo.png')
    expect(logo.element.checkValidity()).toBe(false)
    for (const button of wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')) await button.trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(value.logoUrl).toBe('http://example.com/logo.png')
    await logo.setValue('https://example.com/logo.png')
    expect(logo.element.checkValidity()).toBe(true)
    for (const button of wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')) await button.trigger('click')
    expect(wrapper.emitted('save')).toEqual([['draft'], ['draft'], ['published']])
  })
})

it('输入按字段发出准确的局部载荷，保存只携带目标状态', async () => {
  const { wrapper, value } = await setup()
  await wrapper.get('[aria-label="友链站点名称"]').setValue(' 新的设计札记 ')
  await wrapper.get('[aria-label="友链站点介绍"]').setValue('从日常观察开始写作')
  await wrapper.get('[aria-label="友链站点地址"]').setValue('https://example.com/Other/?a=2&a=1#KeepCase')
  await wrapper.get('[aria-label="友链保存状态"]').setValue('withdrawn')
  await wrapper.get('[aria-label="友链排序值"]').setValue('-8')
  await wrapper.get('[aria-label="推荐友链"]').setValue(true)
  expect(wrapper.emitted('change')).toEqual([
    [{ name: ' 新的设计札记 ' }],
    [{ description: '从日常观察开始写作' }],
    [{ url: 'https://example.com/Other/?a=2&a=1#KeepCase' }],
    [{ status: 'withdrawn' }],
    [{ sortOrder: -8 }],
    [{ isFeatured: true }],
  ])
  expect(value).toEqual({
    name: ' 新的设计札记 ',
    description: '从日常观察开始写作',
    url: 'https://example.com/Other/?a=2&a=1#KeepCase',
    logoMediaId: null,
    logoUrl: null,
    status: 'withdrawn',
    sortOrder: -8,
    isFeatured: true,
  })
  const buttons = wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')
  for (const button of buttons) await button.trigger('click')
  expect(wrapper.emitted('save')).toEqual([['withdrawn'], ['draft'], ['published']])
  expect(value.status).toBe('withdrawn')
})

it('外部 Logo、受管媒体和移除操作明确清空另一来源', async () => {
  const { wrapper, value } = await setup({ logoMediaId: media.id })
  await wrapper.get('[aria-label="外部Logo地址"]').setValue('https://example.com/mark.png')
  const choose = wrapper.findAll('button').find((button) => button.text() === '选择或上传Logo')!
  await choose.trigger('click')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '选用站点标志')!
    .trigger('click')
  expect(value.logoMediaId).toBe(media.id)
  expect(value.logoUrl).toBeNull()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '移除Logo')!
    .trigger('click')
  expect(wrapper.emitted('change')).toEqual([
    [{ logoMediaId: null, logoUrl: 'https://example.com/mark.png' }],
    [{ logoMediaId: media.id, logoUrl: null }],
    [{ logoMediaId: null, logoUrl: null }],
  ])
  expect(value.logoMediaId).toBeNull()
  expect(value.logoUrl).toBeNull()
  expect(wrapper.emitted('save')).toBeUndefined()
})

it('重复地址和恢复副本错误可由读屏播报，重试事件不丢失现有输入', async () => {
  const { wrapper, value } = await setup(
    { description: '仍在编辑的介绍' },
    { error: '站点地址已存在', localError: '恢复副本保存失败', notice: '已保留当前输入' },
  )
  const alerts = wrapper.findAll('[role="alert"]')
  expect(alerts).toHaveLength(2)
  expect(alerts[0]!.text()).toContain('站点地址已存在')
  expect(alerts[1]!.text()).toContain('恢复副本保存失败')
  expect(wrapper.get('[role="status"]').text()).toBe('已保留当前输入')
  await alerts[0]!.get('button').trigger('click')
  await alerts[1]!.get('button').trigger('click')
  expect(wrapper.emitted('reload')).toEqual([[]])
  expect(wrapper.emitted('persist')).toEqual([[]])
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.get<HTMLTextAreaElement>('[aria-label="友链站点介绍"]').element.value).toBe('仍在编辑的介绍')
  expect(value.url).toBe(managedLink().url)
  await wrapper.setProps({ error: '', localError: '', notice: '' })
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})

it('版本冲突展示完整服务器值，合并和重新读取只发事件并保留本地输入', async () => {
  const local = linkForm({
    ...managedLink(),
    name: '本地站点名',
    description: '本地尚未保存的介绍',
    logoUrl: 'https://example.com/local.png',
    sortOrder: 6,
  })
  const server = managedLink({
    name: '服务器站点名',
    description: '服务器完整介绍',
    url: 'https://example.com/Server/?sort=2&sort=1#Exact',
    logoMediaId: media.id,
    status: 'published',
    isFeatured: true,
    sortOrder: 12,
    revision: 4,
  })
  const { wrapper, value } = await setup(local, {
    id: 18,
    saved: managedLink(),
    error: '友链已被修改，请核对服务器版本后合并',
    serverVersion: server,
  })
  const comparison = wrapper.get('[aria-label="友链服务器版本"]')
  expect(comparison.text()).toContain('服务器当前版本 4')
  for (const text of [server.name, server.description, server.url, media.id, '已上架 / 推荐 / 12']) {
    expect(comparison.text()).toContain(text)
  }
  expect(wrapper.get('[role="alert"]').text()).toContain('友链已被修改')
  const buttons = comparison.findAll('button')
  await buttons[1]!.trigger('click')
  expect(wrapper.emitted('merge')).toEqual([[]])
  expect(wrapper.emitted('reload')).toBeUndefined()
  expect(wrapper.emitted('change')).toBeUndefined()
  expect(value).toEqual(local)
  await buttons[0]!.trigger('click')
  expect(wrapper.emitted('reload')).toEqual([[]])
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(value).toEqual(local)
  expect(wrapper.get<HTMLInputElement>('[aria-label="友链站点名称"]').element.value).toBe(local.name)
  expect(wrapper.get<HTMLTextAreaElement>('[aria-label="友链站点介绍"]').element.value).toBe(local.description)
})

it.each([{ ready: false }, { loading: true }, { saving: true }])(
  '未就绪、加载或保存期间禁用保存入口：%j',
  async (props) => {
    const { wrapper } = await setup({}, props)
    for (const button of wrapper.findAll<HTMLButtonElement>('.admin-action-bar button')) {
      expect(button.element.disabled).toBe(true)
      button.element.click()
    }
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[type="submit"]').attributes('aria-busy')).toBe(String('saving' in props && props.saving))
  },
)
