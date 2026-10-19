/** @file adminSystemI18n.test.ts @description 后台系统共用部件切换英文后的关键文案，默认中文逐字保持原文 */
import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OperationTask from '../../app/components/admin/OperationTask.vue'
import AuditLog from '../../app/components/admin/AuditLog.vue'
import BatchBar from '../../app/components/admin/BatchBar.vue'
import ContentRelations from '../../app/components/admin/ContentRelations.vue'
import ActiveSessions from '../../app/components/admin/ActiveSessions.vue'
import { describeBatchResult } from '../../app/composables/useAdminBatchSelection'
import { contentRelationSummary } from '../../app/features/content-relation/editor'
import { adminNavigation } from '../../app/features/admin/navigation'
import { overviewDomains, overviewTasks } from '../../app/features/admin/overview'
import type { OperationTask as Task } from '../../app/features/notification/types'
import type { AuditItem } from '../../app/features/audit/types'

const i18n = () => useNuxtApp().$i18n

const task: Task = {
  id: 'task-1',
  kind: 'backup',
  state: 'failed',
  attempts: 3,
  maxAttempts: 5,
  createdAt: '2026-10-19T08:30:00.000Z',
  availableAt: '2026-10-19T08:30:00.000Z',
  startedAt: null,
  finishedAt: null,
  errorCode: 'TIMEOUT',
  outcome: {
    accepted: false,
    suppressed: false,
    integrityVerified: true,
    transferVerified: true,
    transferConfigured: true,
    recoveryVerified: false,
  },
}
const audit: AuditItem = {
  id: 'audit-1',
  actor: 'owner',
  action: 'post.update',
  actionLabel: 'post.update',
  resourceType: 'post',
  resourceId: '12',
  state: 'partial',
  summary: { fields: ['title', 'body'], counts: { successCount: 2 }, targetState: 'review-required' },
  createdAt: '2026-10-19T08:30:00.000Z',
  traceId: 'trace-9',
}
const relationProps = {
  selected: [{ type: 'post' as const, id: 3, title: 'Hello', status: 'missing', available: false }],
  candidates: [],
  type: 'post' as const,
  q: '',
  page: 1,
  total: 30,
  pending: false,
  resolving: false,
  error: '',
  resolveError: '',
  disabled: false,
}
const batchResult = {
  successCount: 2,
  failedCount: 2,
  results: [
    { id: 1, ok: false, reason: 'not_found' },
    { id: 2, ok: false, reason: 'conflict' },
  ],
}

it('默认中文：任务、审计、批量与关联文案逐字保持原文', async () => {
  const taskView = await mountSuspended(OperationTask, { props: { task } })
  expect(taskView.find('h3').text()).toBe('完整备份 · 执行失败')
  expect(taskView.text()).toContain('已尝试 3 次')
  expect(taskView.text()).toContain('备份完整性校验通过。传输副本已验证。尚无本次恢复演练记录。')
  expect(taskView.text()).toContain('错误类型：TIMEOUT')
  const auditView = await mountSuspended(AuditLog, { props: { items: [audit] } })
  expect(auditView.text()).toContain('部分成功')
  expect(auditView.text()).toContain('对象：文章 #12')
  expect(auditView.text()).toContain('提交字段：title、body')
  expect(auditView.text()).toContain('目标状态：先审核后公开')
  expect(auditView.text()).toContain('成功条目：2')
  expect(auditView.find('small').text()).toBe('审计编号 audit-1 · 请求编号 trace-9')
  const bar = await mountSuspended(BatchBar, {
    props: { noun: '评论', count: 2, pageCount: 5, allSelected: false, partiallySelected: true, actions: [] },
  })
  expect(bar.attributes('aria-label')).toBe('评论批量操作')
  expect(bar.text()).toContain('选择当前页全部评论')
  expect(bar.text()).toContain('已选择 2 条评论')
  expect(describeBatchResult(batchResult, '已隐藏', '评论')).toBe(
    '已隐藏 2 条评论；1 条已不存在；1 条已被修改，请刷新后重新选择',
  )
  const relations = await mountSuspended(ContentRelations, { props: relationProps })
  expect(relations.find('h2').text()).toBe('关联内容（1 / 12）')
  expect(relations.text()).toContain('文章 #3 · Hello · 目标缺失')
  expect(relations.text()).toContain('30 项')
  const t = i18n().t
  expect(
    contentRelationSummary(
      [
        { type: 'gallery', id: 7 },
        { type: 'post', id: 3 },
      ],
      t,
    ),
  ).toBe('图库 #7 → 文章 #3')
  expect(contentRelationSummary([], t)).toBe('未设置')
})

it('英文冒烟：导航、工作台、任务、审计、会话、批量与关联文案切换为英文', async () => {
  await i18n().setLocale('en')
  try {
    const t = i18n().t
    expect(adminNavigation.map((item) => t(item.labelKey))).toContain('Backup & maintenance')
    expect(overviewDomains.map((item) => t(item.labelKey))).toContain('Post')
    expect(overviewTasks.map((item) => t(item.labelKey))).toContain('Post comments awaiting reply')
    expect(t('admin-system.overview.draftCount', { count: 1 }, 1)).toBe('1 draft')
    expect(t('admin-system.overview.draftCount', { count: 4 }, 4)).toBe('4 drafts')

    const taskView = await mountSuspended(OperationTask, { props: { task } })
    expect(taskView.find('h3').text()).toBe('Full backup · Failed')
    expect(taskView.text()).toContain('3 attempts')
    // 拼接的句子之间保留空格
    expect(taskView.text()).toContain(
      'Backup integrity check passed. Transferred copy verified. No recovery drill recorded for this run yet.',
    )
    expect(taskView.text()).toContain('Check and retry')

    const auditView = await mountSuspended(AuditLog, { props: { items: [audit] } })
    expect(auditView.text()).toContain('Partially succeeded')
    expect(auditView.text()).toContain('Target: Post #12')
    expect(auditView.text()).toContain('Submitted fields: title, body')
    expect(auditView.text()).toContain('Target state: Review before publishing')
    expect(auditView.text()).toContain('Succeeded items: 2')

    const sessions = await mountSuspended(ActiveSessions, {
      props: {
        items: [
          {
            id: 's1',
            device: 'macOS · Safari',
            createdAt: task.createdAt,
            lastRefreshedAt: task.createdAt,
            expiresAt: task.createdAt,
            current: true,
          },
        ],
        total: 1,
        page: 1,
        pending: false,
        error: '',
        disabled: false,
      },
    })
    expect(sessions.find('h3').text()).toBe('macOS · Safari · This session')
    expect(sessions.text()).toContain('Signed in: Unknown (migrated from an older sign-in)')
    expect(sessions.text()).toContain('Revoke this session and sign out')

    const bar = await mountSuspended(BatchBar, {
      props: { noun: 'comments', count: 2, pageCount: 5, allSelected: false, partiallySelected: true, actions: [] },
    })
    expect(bar.attributes('aria-label')).toBe('Bulk actions for comments')
    expect(bar.text()).toContain('2 comments selected')
    expect(bar.text()).toContain('Clear selection')
    expect(describeBatchResult(batchResult, 'Hid', 'comments', t)).toBe(
      'Hid 2 comments; 1 already gone; 1 changed elsewhere — refresh and select again',
    )
    // 名称按数量取单复数：单条时不出现「1 comments」
    const noun = (count: number) => t('admin-content.comments.batch.noun', count)
    const single = await mountSuspended(BatchBar, {
      props: { noun, count: 1, pageCount: 5, allSelected: false, partiallySelected: true, actions: [] },
    })
    expect(single.attributes('aria-label')).toBe('Bulk actions for comments')
    expect(single.text()).toContain('1 comment selected')
    expect(
      describeBatchResult({ successCount: 1, failedCount: 0, results: [{ id: 1, ok: true }] }, 'Deleted', noun, t),
    ).toBe('Deleted 1 comment')
    expect(describeBatchResult({ successCount: 0, failedCount: 0, results: [] }, 'Deleted', noun, t)).toBe(
      'No comments were changed',
    )

    const relations = await mountSuspended(ContentRelations, { props: relationProps })
    expect(relations.find('h2').text()).toBe('Related content (1 / 12)')
    expect(relations.text()).toContain('Post #3 · Hello · Target missing')
    expect(relations.text()).toContain('30 items')
    expect(
      contentRelationSummary(
        [
          { type: 'project', id: 7 },
          { type: 'post', id: 3 },
        ],
        t,
      ),
    ).toBe('Project #7 → Post #3')
    expect(contentRelationSummary(undefined, t)).toBe('Not set')
  } finally {
    await i18n().setLocale('zh-CN')
  }
})
