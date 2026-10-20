/**
 * @file audit-description.spec.ts
 * @description 审计动作映射与摘要白名单：不把正文、密码或任意路径写入审计
 */
import { auditActions, auditDescriptor, auditFieldLabel, auditResult } from './audit-description'

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('auditDescriptor', () => {
  it('只读请求不生成审计动作', () => {
    expect(auditDescriptor('/api/v1/admin/posts/1', 'GET')).toBeNull()
    expect(auditDescriptor('/api/v1/admin/posts/1', 'HEAD')).toBeNull()
  })

  it('登录、会话与改密映射到固定动作', () => {
    expect(auditDescriptor('/api/v1/auth/login', 'POST')).toMatchObject({
      action: 'auth.login',
      resourceType: 'account',
    })
    expect(auditDescriptor('/api/v1/auth/sessions/revoke-others', 'POST')).toMatchObject({
      action: 'session.others',
      resourceType: 'session',
    })
    expect(auditDescriptor(`/api/v1/auth/sessions/${uuid.toUpperCase()}`, 'DELETE')).toMatchObject({
      action: 'session.revoke',
      resourceId: uuid,
    })
  })

  it('文章创建、保存、归档、修订与批量操作可区分', () => {
    expect(auditDescriptor('/api/v1/admin/posts', 'POST')).toMatchObject({
      action: 'post.create',
      resourceType: 'post',
    })
    expect(auditDescriptor('/api/v1/admin/posts/12', 'PATCH')).toMatchObject({
      action: 'post.update',
      resourceType: 'post',
      resourceId: '12',
    })
    expect(auditDescriptor('/api/v1/admin/posts/12', 'DELETE')).toMatchObject({ action: 'post.archive' })
    expect(auditDescriptor('/api/v1/admin/posts/12/preview-link', 'POST')).toEqual({
      action: 'post.preview-link',
      resourceType: 'post',
      resourceId: '12',
    })
    expect(auditDescriptor('/api/v1/admin/posts/12/revisions', 'POST')).toMatchObject({ action: 'post.revision' })
    expect(auditDescriptor('/api/v1/admin/posts/batch/execute', 'POST')).toMatchObject({
      action: 'post.batch.execute',
      resourceType: 'post-batch',
    })
  })

  it.each([
    ['comments/batch/moderation', 'POST', 'comment', 'comment.batch.moderate', '批量审核评论'],
    ['comments/batch/delete', 'POST', 'comment', 'comment.batch.delete', '批量删除评论'],
    ['guestbook/batch', 'PATCH', 'guestbook', 'guestbook.batch.moderate', '批量审核留言'],
    ['guestbook/batch', 'DELETE', 'guestbook', 'guestbook.batch.delete', '批量删除留言'],
    ['flashes/comments/batch/moderation', 'POST', 'flash-comment', 'flash.comment.batch.moderate', '批量审核闪念评论'],
    ['flashes/comments/batch/delete', 'POST', 'flash-comment', 'flash.comment.batch.delete', '批量删除闪念评论'],
  ] as const)('批量路径 %s %s 使用独立动作和中文标签', (path, method, resourceType, action, label) => {
    for (const prefix of ['/api/v1', '']) {
      expect(auditDescriptor(`${prefix}/admin/${path}`, method)).toEqual({
        action,
        resourceType,
        resourceId: undefined,
      })
    }
    expect(auditActions[action]).toBe(label)
  })

  it.each([
    ['comments/12/moderation', 'POST', 'comment', '12', 'comment.moderate', '审核评论'],
    ['comments/12', 'DELETE', 'comment', '12', 'comment.delete', '删除评论及回复'],
    ['comments/12/reply', 'POST', 'comment', '12', 'comment.reply', '博主回复'],
    ['comments/policy', 'PATCH', 'comment', undefined, 'comment.policy', '修改审核策略'],
    ['guestbook', 'POST', 'guestbook', undefined, 'guestbook.create', '发布或回复留言'],
    ['guestbook/12', 'PATCH', 'guestbook', '12', 'guestbook.update', '审核或置顶留言'],
    ['guestbook/12', 'DELETE', 'guestbook', '12', 'guestbook.delete', '删除留言'],
    [`flashes/${uuid}/comments/c1`, 'PATCH', 'flash', uuid, 'flash.comment.moderate', '审核闪念评论'],
    [`flashes/${uuid}/comments/c1`, 'DELETE', 'flash', uuid, 'flash.comment.delete', '删除闪念评论'],
    [`flashes/${uuid}`, 'PATCH', 'flash', uuid, 'flash.write', '管理闪念'],
  ] as const)('单条路径 %s %s 保持原有动作和中文标签', (path, method, resourceType, resourceId, action, label) => {
    expect(auditDescriptor(`/api/v1/admin/${path}`, method)).toEqual({ action, resourceType, resourceId })
    expect(auditActions[action]).toBe(label)
  })

  it('媒体、备份与未知管理写入有稳定归类', () => {
    expect(auditDescriptor('/api/v1/admin/media', 'POST')).toMatchObject({ action: 'media.upload' })
    expect(auditDescriptor(`/api/v1/admin/media/${uuid}/restore`, 'POST')).toMatchObject({ action: 'media.restore' })
    expect(auditDescriptor('/api/v1/admin/backup/export', 'POST')).toMatchObject({ action: 'backup.export' })
    expect(auditDescriptor('/api/v1/admin/backup/imports/preview', 'POST')).toMatchObject({
      action: 'backup.preview',
      resourceType: 'content-import',
    })
    expect(auditDescriptor(`/api/v1/admin/backup/imports/${uuid}/execute`, 'POST')).toMatchObject({
      action: 'backup.execute',
      resourceId: uuid,
    })
    expect(auditDescriptor('/api/v1/admin/unknown', 'POST')).toMatchObject({
      action: 'admin.write',
      resourceType: 'unknown',
    })
  })
})

describe('auditResult', () => {
  it('生成预览链接的令牌及到期时间不写入审计', () => {
    expect(auditResult({}, { token: 'private-preview-token', expiresAt: '2026-10-25T00:00:00.000Z' })).toEqual({
      summary: { fields: [] },
      resourceId: undefined,
      partial: false,
      failed: false,
    })
  })
  it('只保留白名单字段名，不记录正文、密码和令牌值', () => {
    const result = auditResult(
      { title: '标题', contentRaw: 'secret-body', password: 'secret-password', tags: ['a'], revision: 3 },
      { code: 0, data: { id: uuid, revision: 4, status: 'draft' } },
    )
    expect(result.summary.fields).toEqual(['标题', '正文', '标签'])
    expect(result.summary.submittedVersion).toBe(3)
    expect(result.summary.currentVersion).toBe(4)
    expect(result.summary.targetState).toBe('draft')
    expect(result.resourceId).toBe(uuid)
    expect(JSON.stringify(result.summary)).not.toContain('secret')
  })

  it('站点收录开关记为字段名并可按语言翻译，不记录取值', () => {
    const result = auditResult({ seoTitle: '标题', searchIndexing: false, revision: 2 }, { revision: 3 })
    expect(result.summary.fields).toEqual(['SEO 标题', '搜索引擎收录'])
    expect(auditFieldLabel('搜索引擎收录', 'en')).toBe('Search engine indexing')
  })

  it('计数、审核策略与部分失败状态可表达', () => {
    const result = auditResult(
      {},
      { successCount: 2, failedCount: 1, pendingCount: 0, status: 'pending', requireApproval: true },
    )
    expect(result.summary.counts).toEqual({ successCount: 2, failedCount: 1, pendingCount: 0 })
    expect(result.summary.targetState).toBe('review-required')
    expect(result.partial).toBe(true)
    expect(result.failed).toBe(false)
  })

  it('全部失败时不标记部分成功', () => {
    const result = auditResult({}, { successCount: 0, failedCount: 3 })
    expect(result.failed).toBe(true)
    expect(result.partial).toBe(false)
  })
})
