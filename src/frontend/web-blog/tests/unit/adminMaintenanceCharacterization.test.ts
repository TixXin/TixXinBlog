/** @file adminMaintenanceCharacterization.test.ts @description 备份与维护页的渲染表征：诊断、导入预览、导入结果与最近记录各状态的结构快照及事件接线，拆分区块前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MaintenancePage from '../../app/pages/admin/maintenance.vue'
import type { ContentImportView } from '../../app/features/backup/types'

const at = '2026-10-19T08:30:00.000Z'
const state = vi.hoisted(() => ({
  backup: {} as Record<string, unknown>,
  diagnostics: {} as Record<string, unknown>,
}))
mockNuxtImport('useContentBackup', () => () => state.backup)
mockNuxtImport('useMaintenanceDiagnostics', () => () => state.diagnostics)

const previewJob = (): ContentImportView => ({
  ticket: 'ticket-preview',
  confirmation: 'b'.repeat(64),
  strategy: 'copy',
  includeSettings: true,
  createdAt: at,
  expiresAt: at,
  started: false,
  completed: false,
  expired: false,
  error: '目标内容或配置已变化，请重新预览后确认',
  settingsPreview: undefined,
  gallerySettingsPreview: { gear: [{ icon: 'lucide:camera', name: 'X100V', description: '日常' }] },
  linkSettingsPreview: { rules: ['互换前请先添加本站', '站点需可正常访问'] },
  plan: {
    ready: true,
    omittedRelations: 3,
    errors: ['缺少媒体 m1 的文件', '关联内容 post:7 去重后会指向自身'],
    posts: [
      { sourceId: 1, title: '春日', skip: false, slug: 'spring', reason: '新建草稿' },
      { sourceId: 2, title: '夏夜', skip: true, slug: '', reason: '跳过相同内容' },
    ],
    flashes: [{ sourceId: 'f1', title: '随手记', skip: false, reason: '新建闪念草稿' }],
    moments: [{ sourceId: 'm1', title: '晚霞', skip: false, reason: '新建朋友圈草稿' }],
    guestbook: [{ sourceId: 3, title: '你好', skip: false, reason: '作为待审核留言迁入' }],
    gallery: [{ sourceId: 4, title: '海边', skip: false, reason: '新建图库草稿' }],
    projects: [{ sourceId: 5, title: '工具箱', skip: false, reason: '新建项目草稿' }],
    links: [{ sourceId: 6, title: '友站', skip: true, reason: '跳过相同地址' }],
    prompts: [{ sourceId: 8, title: '晨雾山谷', skip: false, reason: '新建草稿' }],
    subscriptions: [{ sourceId: 9, title: '云服务', skip: false, reason: '新建草稿' }],
    counts: {
      posts: 1,
      flashes: 1,
      moments: 1,
      guestbook: 1,
      gallery: 1,
      projects: 1,
      links: 0,
      prompts: 1,
      subscriptions: 1,
      comments: 6,
      skipped: 2,
      media: 4,
      files: 3,
      settings: true,
    },
  },
})

const resultJob = (): ContentImportView => ({
  ...previewJob(),
  ticket: 'ticket-done',
  strategy: 'skip',
  includeSettings: false,
  started: true,
  completed: true,
  error: undefined,
  plan: { ...previewJob().plan, omittedRelations: 0, errors: [] },
  result: {
    relations: { applied: 4, omitted: 1 },
    posts: [
      { sourceId: 1, id: 41 },
      { sourceId: 3, id: 42 },
    ],
    flashes: [{ sourceId: 'f1', id: 'fa' }],
    moments: [{ sourceId: 'm1', id: 'ma' }],
    guestbook: [{ sourceId: 3, id: 13 }],
    gallery: [{ sourceId: 4, id: 14 }],
    projects: [{ sourceId: 5, id: 15 }],
    links: [{ sourceId: 6, id: 16 }],
    prompts: [{ sourceId: 8, id: 18 }],
    subscriptions: [{ sourceId: 9, id: 19 }],
    comments: 6,
    media: 4,
    files: 3,
    settings: false,
  },
})

function backup(overrides: Record<string, unknown> = {}) {
  return {
    pending: ref(false),
    error: ref(''),
    mediaIncluded: ref(true),
    file: ref(null),
    strategy: ref('skip'),
    includeSettings: ref(false),
    requestId: ref(''),
    job: ref(null),
    acknowledgement: ref(''),
    recent: ref([]),
    recentError: ref(''),
    exportPackage: vi.fn(),
    choose: vi.fn(),
    preview: vi.fn(),
    read: vi.fn(),
    repreview: vi.fn(),
    execute: vi.fn(),
    loadRecent: vi.fn(),
    ...overrides,
  }
}

function diagnostics(overrides: Record<string, unknown> = {}) {
  return {
    pending: ref(false),
    error: ref(''),
    data: ref(null),
    media: ref(null),
    load: vi.fn(),
    checkMedia: vi.fn(),
    ...overrides,
  }
}

/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  state.backup = backup()
  state.diagnostics = diagnostics()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
async function mountPage() {
  const wrapper = await mountSuspended(MaintenancePage)
  wrappers.push(wrapper)
  return wrapper
}

it('空闲状态：诊断待加载、无票据、最近记录为空', async () => {
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('诊断结果、媒体问题、已选文件与处理中提示', async () => {
  state.diagnostics = diagnostics({
    pending: ref(true),
    error: ref('诊断失败'),
    data: ref({
      checkedAt: at,
      databaseReachable: false,
      pendingMigrations: 0,
      schemaDrift: true,
      storage: { readable: true, writable: false, cleaned: true },
      mediaRecords: 3,
      contentContextRequired: false,
      runtime: { node: 'v26.1.0', nodeSupported: true, environment: 'development' },
    }),
    media: ref({
      checkedAt: at,
      checked: 2,
      problems: [
        { id: 'gone', deleted: false, reason: '文件缺失' },
        { id: 'old', deleted: true, reason: '哈希不一致' },
      ],
    }),
  })
  state.backup = backup({
    pending: ref(true),
    error: ref('上传失败'),
    mediaIncluded: ref(false),
    file: ref(new File(['x'.repeat(2048)], 'blog.json')),
    strategy: ref('copy'),
    includeSettings: ref(true),
    requestId: ref('request-1'),
    recentError: ref('最近记录读取失败'),
  })
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('导入预览：计划明细、设置预览、确认输入与操作接线', async () => {
  const read = vi.fn()
  const execute = vi.fn()
  const repreview = vi.fn()
  state.backup = backup({
    job: ref(previewJob()),
    acknowledgement: ref('导入为新草稿'),
    requestId: ref('ticket-preview'),
    recent: ref([
      { ticket: 'ticket-preview', createdAt: at, completed: false, expired: false },
      { ticket: 'ticket-old', createdAt: at, completed: false, expired: true },
      { ticket: 'ticket-done', createdAt: at, completed: true, expired: false },
    ]),
    read,
    execute,
    repreview,
  })
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
  const job = wrapper.get('section[aria-label="内容导入预览"]')
  const buttons = job.findAll('button')
  expect(buttons.map((button) => button.text())).toEqual(['确认导入预览内容', '重新生成此票据的预览', '查询导入结果'])
  await buttons[0]!.trigger('click')
  await buttons[1]!.trigger('click')
  await buttons[2]!.trigger('click')
  expect(execute).toHaveBeenCalledOnce()
  expect(repreview).toHaveBeenCalledOnce()
  expect(read).toHaveBeenCalledWith()
  await wrapper.get('section[aria-label="最近导入记录"] li:nth-child(2) button').trigger('click')
  expect(read).toHaveBeenLastCalledWith('ticket-old')
})

it('导入结果：数量、关联、检查入口与票据读取', async () => {
  state.backup = backup({ job: ref(resultJob()) })
  const wrapper = await mountPage()
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('导出与选择文件把事件交给组合函数', async () => {
  const exportPackage = vi.fn()
  const choose = vi.fn()
  const preview = vi.fn()
  const read = vi.fn()
  const file = new File(['{}'], 'blog.json')
  state.backup = backup({
    exportPackage,
    choose,
    preview,
    read,
    file: ref(file),
    requestId: ref('request-2'),
  })
  const wrapper = await mountPage()
  await wrapper.get('section[aria-label="导出内容包"] button').trigger('click')
  expect(exportPackage).toHaveBeenCalledOnce()
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file] })
  await input.trigger('change')
  expect(choose).toHaveBeenCalledWith(file)
  const actions = wrapper.get('section[aria-label="选择内容包"] .maintenance__actions').findAll('button')
  await actions[0]!.trigger('click')
  await actions[1]!.trigger('click')
  expect(preview).toHaveBeenCalledOnce()
  expect(read).toHaveBeenCalledWith('request-2')
})
