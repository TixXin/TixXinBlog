/** @file projectFormCharacterization.test.ts @description 项目编辑表单的渲染表征：恢复副本、旧副本、服务器版本、封面尺寸来源、技术与链接区块及保存信息的结构快照，拆分区块前后必须一致 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectForm from '../../app/components/admin/ProjectForm.vue'
import { projectForm, type ProjectRecovery } from '../../app/features/project/editor'
import type { ManagedProject, ProjectEditable } from '../../app/features/project/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn((path: string) => Promise.resolve(path.endsWith('/resolve') ? [] : { items: [], total: 0 })),
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }) }))

const coverId = '12345678-1234-4123-a123-123456789abc'
const otherId = '12345678-1234-4123-a123-123456789abd'
const MediaPicker = defineComponent({
  name: 'AdminMediaPicker',
  props: ['open'],
  emits: ['selected', 'update:open'],
  setup: (props) => () => h('div', { 'data-open': String(props.open) }),
})
const imageStub = defineComponent({
  props: ['src', 'alt', 'width', 'height', 'fit'],
  setup: (props) => () => h('img', { src: props.src, alt: props.alt, width: props.width, height: props.height }),
})
const saved = (patch: Partial<ManagedProject> = {}): ManagedProject => ({
  ...projectForm(),
  id: 9,
  title: '创作工作台',
  description: '整理作品与笔记',
  progress: 'active',
  status: 'published',
  sortOrder: 5,
  coverMediaId: coverId,
  cover: `/api/v1/media/${coverId}.webp`,
  width: 1200,
  height: 800,
  tags: [{ label: 'Vue', color: 'emerald' }],
  links: [{ kind: 'source', href: 'https://example.com/source' }],
  relatedContent: [{ type: 'post', id: 3 }],
  revision: 3,
  publishedAt: '2026-10-12',
  createdAt: '2026-10-01',
  updatedAt: '2026-10-11',
  ...patch,
})
const recovery = (title: string): ProjectRecovery => ({
  version: 1,
  context: '',
  id: 9,
  revision: 3,
  requestId: '12345678-1234-4123-a123-123456789abe',
  form: projectForm({ title, tags: [{ label: 'Rust', color: 'amber' }] }),
  pendingCreate: null,
  savedAt: '2026-10-20 08:00',
})

type FormProps = InstanceType<typeof ProjectForm>['$props']
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function mountForm(patch: Partial<ProjectEditable>, props: Partial<FormProps> = {}) {
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
      dirty: false,
      error: '',
      notice: '',
      localError: '',
      onChange: (change: Partial<ProjectEditable>) => Object.assign(value, change),
      ...props,
    },
    global: {
      stubs: {
        AdminBackLink: { template: '<a class="back"><slot /></a>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        AdminActionBar: { template: '<div class="bar"><slot /></div>' },
        CommonTooltip: { template: '<span><slot /></span>' },
        ClientOnly: { template: '<div><slot /></div>' },
        AdminMediaPicker: MediaPicker,
        AdminContentRelations: { template: '<div class="relations" />' },
        AdminProjectRecoveryDetails: { props: ['value'], template: '<dl class="recovery">{{ value.title }}</dl>' },
        CommonImageFrame: imageStub,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, value }
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

it('新建空表单与载入中的结构', async () => {
  const empty = await mountForm({ title: '' }, { dirty: true })
  const loading = await mountForm({}, { loading: true, ready: false, saving: true })
  expect([markup(empty.wrapper.html()), markup(loading.wrapper.html())]).toMatchSnapshot()
})

it('已保存项目带恢复副本、旧副本、服务器版本、提示与错误时的结构', async () => {
  const current = saved()
  const { wrapper } = await mountForm(
    {
      ...current,
      tags: [
        { label: 'Vue', color: 'emerald' },
        { label: 'Nuxt', color: 'blue' },
      ],
      links: [
        { kind: 'source', href: 'https://example.com/source' },
        { kind: 'docs', href: 'https://example.com/docs' },
      ],
    },
    {
      id: 9,
      saved: current,
      serverVersion: saved({ title: '服务器项目', revision: 4, tags: [], links: [], cover: null, status: 'draft' }),
      recovery: recovery('本地副本'),
      previousRecoveries: [
        { key: 'a', value: recovery('更早的副本') },
        { key: 'b', value: { ...recovery('最早的副本'), savedAt: '2026-10-18 09:30' } },
      ],
      dirty: true,
      error: '项目已变化',
      notice: '已保留当前输入',
      localError: '恢复副本写入失败',
    },
  )
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('封面尺寸依次取所选媒体、已保存项目，换成其他媒体后不带尺寸', async () => {
  const sizes = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper']) => {
    const image = wrapper.find('section[aria-label="项目封面"] img')
    return image.exists() ? [image.attributes('src'), image.attributes('width'), image.attributes('height')] : null
  }
  const { wrapper } = await mountForm({ coverMediaId: coverId }, { id: 9, saved: saved() })
  const trace: unknown[] = [sizes(wrapper)]
  await wrapper.findAll('section[aria-label="项目封面"] button')[0]!.trigger('click')
  trace.push(wrapper.get('[data-open]').attributes('data-open'))
  wrapper.getComponent(MediaPicker).vm.$emit('selected', { id: otherId, width: 640, height: 480 })
  await flushPromises()
  trace.push(sizes(wrapper))
  wrapper.getComponent(MediaPicker).vm.$emit('selected', { id: coverId, width: 300, height: 200 })
  await flushPromises()
  trace.push(sizes(wrapper))
  await wrapper.setProps({ value: reactive(projectForm({ title: '换图', coverMediaId: otherId })) })
  trace.push(sizes(wrapper))
  await wrapper.findAll('section[aria-label="项目封面"] button')[1]!.trigger('click')
  trace.push(wrapper.emitted('change'))
  expect(trace).toMatchSnapshot()
})

it('技术上限 20、链接上限 4 与用途占用', async () => {
  const kinds = ['source', 'demo', 'docs', 'download'] as const
  const { wrapper } = await mountForm({
    tags: Array.from({ length: 20 }, (_, index) => ({ label: `T${index}`, color: 'blue' as const })),
    links: kinds.map((kind) => ({ kind, href: `https://example.com/${kind}` })),
  })
  const buttons = wrapper.findAll('button').filter((button) => /添加/.test(button.text()))
  expect({
    disabled: buttons.map((button) => [button.text(), button.attributes('disabled') !== undefined]),
    occupied: wrapper
      .findAll('[aria-label="链接用途 2"] option')
      .map((option) => [option.attributes('value'), option.attributes('disabled') !== undefined]),
    noLinks: wrapper.text().includes('还没有'),
  }).toMatchSnapshot()
})
