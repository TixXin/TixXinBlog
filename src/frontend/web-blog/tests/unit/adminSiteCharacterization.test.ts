/** @file adminSiteCharacterization.test.ts @description 站点设置页的渲染表征：资料与搜索区块、冲突与保留副本、历史分页与历史预览的结构快照及事件接线，拆分区块前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import SitePage from '../../app/pages/admin/site.vue'
import { defaultSiteSettings, type SiteSettingsData } from '../../app/features/site/settings'

const state = vi.hoisted(() => ({ editor: {} as Record<string, unknown> }))
mockNuxtImport('useSiteSettingsEditor', () => () => state.editor)

const at = '2026-10-19T08:30:00.000Z'
const settings = (overrides: Partial<SiteSettingsData> = {}): SiteSettingsData => ({
  ...structuredClone(defaultSiteSettings),
  revision: 7,
  updatedAt: at,
  name: '山间小站',
  description: '记录写作与生活',
  ownerName: '林间',
  ownerTitle: '写字的人',
  avatar: '/media/avatar.webp',
  avatarAlt: '头像',
  presenceLabel: '在线',
  presenceSignature: '慢慢来',
  presenceStatus: 'online',
  announcement: '本周更新照片',
  seoTitle: '山间小站 · 博客',
  seoDescription: '写作、摄影与项目',
  searchIndexing: true,
  ...overrides,
})

function editor(overrides: Record<string, unknown> = {}) {
  return {
    draft: ref(settings()),
    ready: ref(true),
    conflict: ref(null),
    historical: ref(null),
    preserved: ref(null),
    submission: ref(null),
    checkSubmission: vi.fn(),
    pending: ref(false),
    error: ref(''),
    dirty: computed(() => true),
    history: ref([]),
    historyPage: ref(1),
    historyTotal: ref(0),
    historyPending: ref(false),
    historyError: ref(''),
    load: vi.fn(),
    save: vi.fn(),
    loadHistory: vi.fn(),
    inspect: vi.fn(),
    loadHistorical: vi.fn(),
    restoreHistorical: vi.fn(),
    mergeConflict: vi.fn(),
    recoverPreserved: vi.fn(),
    ...overrides,
  }
}

/** 去掉 scoped 样式标记与随机生成的标识，只比较结构、属性与文字 */
const markup = (html: string) =>
  html.replace(/ data-v-[a-f0-9]+(="")?/g, '').replace(/(id|for|aria-[a-z]+)="(v|el|reka|radix)-[^"]*"/g, '$1="<id>"')

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  state.editor = editor()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
async function mountPage() {
  const wrapper = await mountSuspended(SitePage)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

it('读取失败且无草稿：只有错误提示与重试', async () => {
  const load = vi.fn()
  state.editor = editor({ draft: ref(null), error: ref('读取失败'), load })
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
  await wrapper.get('p[role="alert"] button').trigger('click')
  expect(load).toHaveBeenCalledOnce()
})

it('编辑状态：资料、社交、搜索、导航、关于与预览', async () => {
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('冲突、待核对提交、保留副本与历史预览', async () => {
  const handlers = {
    checkSubmission: vi.fn(),
    mergeConflict: vi.fn(),
    recoverPreserved: vi.fn(),
    loadHistory: vi.fn(),
    inspect: vi.fn(),
    loadHistorical: vi.fn(),
    restoreHistorical: vi.fn(),
  }
  state.editor = editor({
    ...handlers,
    conflict: ref(settings({ revision: 8, name: '新站名' })),
    preserved: ref(settings({ name: '保留的站名' })),
    historical: ref(settings({ revision: 5, name: '旧站名' })),
    submission: ref({ revision: 7 }),
    history: ref([
      { revision: 6, reason: '修改公告', createdAt: at },
      { revision: 5, reason: '更换头像', createdAt: at },
    ]),
    historyPage: ref(2),
    historyTotal: ref(45),
    historyError: ref('历史读取失败'),
  })
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
  await wrapper.get('p[role="status"] button').trigger('click')
  expect(handlers.checkSubmission).toHaveBeenCalledOnce()
  const history = wrapper.get('section.admin-site__history')
  const buttons = history.findAll('button')
  for (const button of buttons) await button.trigger('click')
  expect(handlers.loadHistory.mock.calls).toEqual([[], [1], [3]])
  expect(handlers.inspect.mock.calls).toEqual([[6], [5]])
})

it('提交前校验导航与页脚，通过后保存；选择头像回填地址与替代文字', async () => {
  const save = vi.fn()
  state.editor = editor({ save })
  const wrapper = await mountPage()
  await wrapper.get('form').trigger('submit')
  expect(save).toHaveBeenCalledOnce()
  await wrapper.get('button.admin-site__pick').trigger('click')
  const picker = wrapper.findComponent({ name: 'AdminMediaPicker' })
  expect(picker.props('open')).toBe(true)
  picker.vm.$emit('selected', { url: '/media/new.webp', alt: '新头像' })
  await flushPromises()
  const draft = (state.editor.draft as { value: SiteSettingsData }).value
  expect([draft.avatar, draft.avatarAlt]).toEqual(['/media/new.webp', '新头像'])
})
