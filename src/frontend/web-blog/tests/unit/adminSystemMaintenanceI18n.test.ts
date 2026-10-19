/** @file adminSystemMaintenanceI18n.test.ts @description 备份与维护页切换英文后诊断、导入预览与结果文案随语言变化，默认中文逐字保持原文 */
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MaintenancePage from '../../app/pages/admin/maintenance.vue'
import type { ContentImportView } from '../../app/features/backup/types'

const i18n = () => useNuxtApp().$i18n

const expiresAt = '2026-10-19T08:30:00.000Z'
const job: ContentImportView = {
  ticket: 'ticket-1',
  confirmation: 'a'.repeat(64),
  strategy: 'skip',
  includeSettings: false,
  createdAt: expiresAt,
  expiresAt,
  started: false,
  completed: false,
  expired: false,
  plan: {
    ready: true,
    errors: [],
    omittedRelations: 2,
    posts: [{ sourceId: 7, title: '旅途随笔', skip: false, slug: 'travel-notes', reason: '新建草稿' }],
    flashes: [],
    prompts: [{ sourceId: 3, title: '晨雾山谷', skip: false, reason: '新建草稿' }],
    counts: {
      posts: 1,
      flashes: 0,
      moments: 0,
      comments: 4,
      skipped: 1,
      media: 2,
      files: 3,
      settings: false,
      prompts: 1,
    },
  },
}

mockNuxtImport('useMaintenanceDiagnostics', () => () => ({
  pending: ref(false),
  error: ref(''),
  data: ref({
    checkedAt: expiresAt,
    databaseReachable: true,
    pendingMigrations: 2,
    schemaDrift: false,
    storage: { readable: true, writable: true, cleaned: true },
    mediaRecords: 12,
    contentContextRequired: false,
    runtime: { node: 'v25.0.0', nodeSupported: false, environment: 'production' },
  }),
  media: ref({ checkedAt: expiresAt, checked: 5, problems: [] }),
  load: vi.fn(),
  checkMedia: vi.fn(),
}))
mockNuxtImport('useContentBackup', () => () => ({
  pending: ref(false),
  error: ref(''),
  mediaIncluded: ref(true),
  file: ref(null),
  strategy: ref('skip'),
  includeSettings: ref(false),
  requestId: ref(''),
  job: ref(job),
  acknowledgement: ref(''),
  recent: ref([{ ticket: 'ticket-1', createdAt: expiresAt, completed: true, expired: false }]),
  recentError: ref(''),
  exportPackage: vi.fn(),
  choose: vi.fn(),
  preview: vi.fn(),
  read: vi.fn(),
  repreview: vi.fn(),
  execute: vi.fn(),
  loadRecent: vi.fn(),
}))

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

it('默认中文的诊断、预览与记录逐字保持原文', async () => {
  const wrapper = await mountSuspended(MaintenancePage)
  wrappers.push(wrapper)
  const text = wrapper.text()
  expect(wrapper.get('h1').text()).toBe('备份与维护')
  expect(text).toContain('数据库连接：可用')
  expect(text).toContain('待应用迁移 2 个 · 结构与代码一致')
  expect(text).toContain('媒体存储：读写与清理探测通过 · 12 个登记资源')
  expect(text).toContain('运行环境 production · Node v25.0.0（版本不受支持）')
  expect(text).toContain('已核验 5 个媒体文件，发现 0 项问题。')
  expect(text).toContain('票据 ticket-1 · 跳过相同内容 · 保留当前站点设置')
  expect(text).toContain('计划新建 1 篇文章草稿、0 条闪念草稿、0 条朋友圈草稿，迁入 4 条评论；跳过 1 项相同内容。')
  expect(text).toContain('旅途随笔 · 新建草稿 · 地址标识 travel-notes')
  expect(text).toContain('图片提示词 · 晨雾山谷：新建草稿')
  expect(text).toContain(
    `预览到期：${new Date(expiresAt).toLocaleString('zh-CN', { hour12: false })}。执行时重新校验目标变化`,
  )
  expect(text).toContain('输入“导入为新草稿”确认')
  expect(text).toContain(`${new Date(expiresAt).toLocaleString('zh-CN', { hour12: false })} · 已完成`)
  expect(wrapper.find('section[aria-label="内容导入预览"]').exists()).toBe(true)
})

it('切到英文后维护页关键文案变为英文，确认短语仍按接口协议展示', async () => {
  await i18n().setLocale('en')
  try {
    const wrapper = await mountSuspended(MaintenancePage)
    wrappers.push(wrapper)
    const text = wrapper.text()
    expect(wrapper.get('h1').text()).toBe('Backup & Maintenance')
    expect(text).toContain('Database connection: available')
    expect(text).toContain('Pending migrations: 2 · schema matches code')
    expect(text).toContain('Environment production · Node v25.0.0 (unsupported version)')
    expect(text).toContain('Media files checked: 5. Problems found: 0.')
    expect(text).toContain('Ticket ticket-1 · Skip identical content · Keeps current site settings')
    expect(text).toContain('旅途随笔 · 新建草稿 · slug travel-notes')
    expect(text).toContain(`Preview expires: ${new Date(expiresAt).toLocaleString('en', { hour12: false })}.`)
    expect(text).toContain('Type “导入为新草稿” to confirm')
    expect(text).toContain('Generate import preview')
    expect(text).toContain('Recent imports')
    expect(wrapper.find('section[aria-label="Content import preview"]').exists()).toBe(true)
    expect(text).not.toContain('备份与维护')
  } finally {
    await i18n().setLocale('zh-CN')
  }
})
