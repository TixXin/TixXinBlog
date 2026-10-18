/** @file projectForm.test.ts @description 项目表单的原生校验、字段事件、保存状态和冲突核查 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectForm from '../../app/components/admin/ProjectForm.vue'
import { projectForm } from '../../app/features/project/editor'
import type { ManagedProject, ProjectEditable } from '../../app/features/project/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

const wrappers: { unmount(): void }[] = []
const MediaPicker = defineComponent({
  name: 'AdminMediaPicker',
  props: ['open'],
  emits: ['selected', 'update:open'],
  template: '<div />',
})
const ContentRelations = defineComponent({
  name: 'AdminContentRelations',
  props: ['selected'],
  emits: ['choose', 'remove', 'move', 'search', 'page', 'type', 'query', 'resolve'],
  template: '<div />',
})
const coverId = '12345678-1234-4123-a123-123456789abc'

beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'owner' }) }
  mocks.api
    .mockReset()
    .mockImplementation((path: string) => Promise.resolve(path.endsWith('/resolve') ? [] : { items: [], total: 0 }))
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(
  patch: Partial<ProjectEditable> = {},
  props: Partial<InstanceType<typeof ProjectForm>['$props']> = {},
) {
  const value = reactive(projectForm({ title: '创作工作台', ...patch }))
  const wrapper = await mountSuspended(ProjectForm, {
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
      onChange: (change: Partial<ProjectEditable>) => Object.assign(value, change),
      ...props,
    },
    attachTo: document.body,
    global: {
      stubs: {
        AdminBackLink: true,
        AdminActionBar: { template: '<div><slot /></div>' },
        CommonTooltip: { template: '<span><slot /></span>' },
        ClientOnly: { template: '<div><slot /></div>' },
        AdminMediaPicker: MediaPicker,
        AdminContentRelations: ContentRelations,
        CommonImageFrame: defineComponent({
          props: ['src', 'alt'],
          setup: (image) => () => h('img', { src: image.src, alt: image.alt }),
        }),
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  const button = (label: string) => wrapper.findAll('button').find((item) => item.text() === label)!
  return { wrapper, value, button }
}

describe('项目表单校验与保存', () => {
  it.each(['', '   '])('标题为 %j 时禁止所有保存入口', async (title) => {
    const { wrapper, button } = await setup({ title })
    const titleInput = wrapper.get<HTMLInputElement>('[aria-label="项目标题"]')
    expect(titleInput.element.required).toBe(true)
    for (const label of ['保存项目', '保存草稿', '发布项目']) {
      expect(button(label).attributes('disabled')).toBeDefined()
      await button(label).trigger('click')
    }
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('主保存入口遵守技术名必填和链接 HTTP(S) 约束，修正后按当前状态提交', async () => {
    const { wrapper, button } = await setup({
      status: 'withdrawn',
      tags: [{ label: '', color: 'blue' }],
      links: [{ kind: 'source', href: '' }],
    })
    const tag = wrapper.get<HTMLInputElement>('[aria-label="技术名称 1"]')
    const link = wrapper.get<HTMLInputElement>('[aria-label="链接地址 1"]')
    expect(tag.element.validity.valueMissing).toBe(true)
    expect(link.element.validity.valueMissing).toBe(true)
    await button('保存项目').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await tag.setValue('Vue')
    await link.setValue('ftp://example.com/source')
    expect(link.element.validity.patternMismatch).toBe(true)
    await button('保存项目').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await link.setValue('https://example.com/source')
    expect(wrapper.get<HTMLFormElement>('form').element.checkValidity()).toBe(true)
    await button('保存项目').trigger('click')
    expect(wrapper.emitted('save')).toEqual([['withdrawn']])
  })

  it.each(['保存草稿', '发布项目'])('%s 也必须通过技术名和链接校验', async (label) => {
    const { wrapper, button } = await setup({
      tags: [{ label: '', color: 'blue' }],
      links: [{ kind: 'docs', href: '' }],
    })
    await button(label).trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[aria-label="技术名称 1"]').setValue('TypeScript')
    await wrapper.get('[aria-label="链接地址 1"]').setValue('ftp://example.com/docs')
    await button(label).trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[aria-label="链接地址 1"]').setValue('https://example.com/docs')
    await button(label).trigger('click')
    expect(wrapper.emitted('save')).toEqual([[label === '保存草稿' ? 'draft' : 'published']])
  })

  it('保存事件只传明确的发布状态，项目进展与当前输入保持独立', async () => {
    const { wrapper, value, button } = await setup({ progress: 'archived', status: 'published' })
    await button('保存项目').trigger('click')
    await button('保存草稿').trigger('click')
    await button('发布项目').trigger('click')
    expect(wrapper.emitted('save')).toEqual([['published'], ['draft'], ['published']])
    expect(value.progress).toBe('archived')
    expect(value.status).toBe('published')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([{ ready: false }, { loading: true }, { saving: true }])('状态 %j 时禁用保存入口', async (props) => {
    const { wrapper, button } = await setup({}, props)
    for (const label of [props.saving ? '正在保存…' : '保存项目', '保存草稿', '发布项目']) {
      expect(button(label).attributes('disabled')).toBeDefined()
      await button(label).trigger('click')
    }
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe(String(!!props.saving))
  })
})

it('编辑字段发出白名单补丁，数字、数组和媒体编号保持约定类型', async () => {
  const { wrapper, value, button } = await setup({
    tags: [{ label: 'Vue', color: 'blue' }],
    links: [{ kind: 'source', href: 'https://example.com/source' }],
  })
  await wrapper.get('[aria-label="项目标题"]').setValue('本地创作工具')
  await wrapper.get('[aria-label="项目介绍"]').setValue('支持整理作品与创作笔记。')
  await wrapper.get('[aria-label="项目进展"]').setValue('archived')
  await wrapper.get('[aria-label="项目保存状态"]').setValue('published')
  await wrapper.get('[aria-label="项目排序值"]').setValue('-12')
  await wrapper.get('[aria-label="技术名称 1"]').setValue('Nuxt')
  await wrapper.get('[aria-label="技术颜色 1"]').setValue('emerald')
  await wrapper.get('[aria-label="链接用途 1"]').setValue('docs')
  await wrapper.get('[aria-label="链接地址 1"]').setValue('https://example.com/docs')
  wrapper.getComponent(MediaPicker).vm.$emit('selected', { id: coverId, width: 800, height: 600 })
  await flushPromises()
  expect(wrapper.emitted('change')).toEqual([
    [{ title: '本地创作工具' }],
    [{ description: '支持整理作品与创作笔记。' }],
    [{ progress: 'archived' }],
    [{ status: 'published' }],
    [{ sortOrder: -12 }],
    [{ tags: [{ label: 'Nuxt', color: 'blue' }] }],
    [{ tags: [{ label: 'Nuxt', color: 'emerald' }] }],
    [{ links: [{ kind: 'docs', href: 'https://example.com/source' }] }],
    [{ links: [{ kind: 'docs', href: 'https://example.com/docs' }] }],
    [{ coverMediaId: coverId }],
  ])
  expect(wrapper.get('img').attributes('src')).toBe(`/api/v1/media/${coverId}.webp`)
  await button('移除封面').trigger('click')
  expect(wrapper.emitted('change')?.at(-1)).toEqual([{ coverMediaId: null }])
  expect(value.coverMediaId).toBeNull()
  expect(wrapper.emitted('save')).toBeUndefined()
})

it('技术和链接增删保留原有条目，新增链接选择未使用的用途', async () => {
  const tags = [{ label: 'Vue', color: 'emerald' }] as const
  const links = [{ kind: 'source', href: 'https://example.com/source' }] as const
  const { wrapper, value, button } = await setup({ tags: [...tags], links: [...links] })
  await button('添加技术标签').trigger('click')
  expect(value.tags).toEqual([...tags, { label: '', color: 'blue' }])
  await button('添加项目链接').trigger('click')
  expect(value.links).toEqual([...links, { kind: 'demo', href: '' }])
  expect(wrapper.get('[aria-label="链接用途 2"] option[value="source"]').attributes('disabled')).toBeDefined()
  await wrapper.get('[aria-label="移除技术 1"]').trigger('click')
  await wrapper.get('[aria-label="移除链接 1"]').trigger('click')
  expect(value.tags).toEqual([{ label: '', color: 'blue' }])
  expect(value.links).toEqual([{ kind: 'demo', href: '' }])
  expect(tags).toEqual([{ label: 'Vue', color: 'emerald' }])
  expect(links).toEqual([{ kind: 'source', href: 'https://example.com/source' }])
})

it('关联选择保持有序编号载荷，不混入候选内容的展示字段', async () => {
  const { wrapper, value } = await setup({ relatedContent: [{ type: 'post', id: 3 }] })
  wrapper.getComponent(ContentRelations).vm.$emit('choose', { type: 'gallery', id: 7, title: '冬日光影' })
  await flushPromises()
  expect(wrapper.emitted('change')).toEqual([
    [
      {
        relatedContent: [
          { type: 'post', id: 3 },
          { type: 'gallery', id: 7 },
        ],
      },
    ],
  ])
  expect(value.relatedContent).toEqual([
    { type: 'post', id: 3 },
    { type: 'gallery', id: 7 },
  ])
  expect(wrapper.emitted('save')).toBeUndefined()
})

it('请求错误与恢复副本错误分别可读播报，并发出对应重试事件', async () => {
  const { wrapper, value, button } = await setup(
    { description: '还未保存的说明' },
    { error: '保存失败，请重新读取', localError: '恢复副本写入失败', notice: '已保留当前输入' },
  )
  const alerts = wrapper.findAll('[role="alert"]')
  expect(alerts).toHaveLength(2)
  expect(alerts[0]?.text()).toContain('保存失败，请重新读取')
  expect(alerts[1]?.text()).toContain('恢复副本写入失败')
  expect(wrapper.get('[role="status"]').text()).toBe('已保留当前输入')
  await button('重新读取').trigger('click')
  await button('重试保存恢复副本').trigger('click')
  expect(wrapper.emitted('reload')).toEqual([[]])
  expect(wrapper.emitted('persist')).toEqual([[]])
  expect(value.description).toBe('还未保存的说明')
  expect(wrapper.emitted('save')).toBeUndefined()
  await wrapper.setProps({ error: '', localError: '', notice: '' })
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})

it('冲突区完整展示服务器版本，合并与重新读取仅发出操作事件并保留本地输入', async () => {
  const server: ManagedProject = {
    ...projectForm(),
    id: 9,
    title: '服务器项目',
    description: '服务器完整介绍\n第二段说明',
    progress: 'active',
    status: 'withdrawn',
    sortOrder: 17,
    coverMediaId: coverId,
    cover: `/api/v1/media/${coverId}.webp`,
    width: 800,
    height: 600,
    tags: [{ label: 'Rust', color: 'amber' }],
    links: [{ kind: 'docs', href: 'https://example.com/docs?version=2' }],
    relatedContent: [
      { type: 'gallery', id: 7 },
      { type: 'post', id: 3 },
    ],
    revision: 4,
    publishedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-18',
  }
  const { wrapper, value, button } = await setup(
    { title: '本地项目', description: '尚未保存的介绍', progress: 'archived' },
    { id: 9, serverVersion: server, error: '项目已变化，请核对服务器版本后合并' },
  )
  const comparison = wrapper.get('[aria-label="项目服务器版本"]')
  for (const text of [
    '服务器当前版本 4',
    '服务器项目',
    '服务器完整介绍',
    '第二段说明',
    '已撤回',
    '维护中',
    '排序 17',
    'Rust',
    '文档：https://example.com/docs?version=2',
    '图库 #7 → 文章 #3',
  ])
    expect(comparison.text()).toContain(text)
  expect(comparison.get('img').attributes()).toMatchObject({ src: server.cover, alt: server.title })
  await button('保留输入，按最新版本继续合并').trigger('click')
  await button('保留副本并载入服务器版本').trigger('click')
  expect(wrapper.emitted('merge')).toEqual([[]])
  expect(wrapper.emitted('reload')).toEqual([[]])
  expect(wrapper.emitted('change')).toBeUndefined()
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(value).toMatchObject({ title: '本地项目', description: '尚未保存的介绍', progress: 'archived' })
  expect(wrapper.get<HTMLInputElement>('[aria-label="项目标题"]').element.value).toBe('本地项目')
  expect(wrapper.get<HTMLTextAreaElement>('[aria-label="项目介绍"]').element.value).toBe('尚未保存的介绍')
})
