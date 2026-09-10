/** @file project.test.ts @description 项目进展与发布状态、URL 查询及恢复副本的字段边界 */
import { describe, expect, it } from 'vitest'
import { projectForm, parseProjectRecovery } from '../../app/features/project/editor'
import { projectQuery } from '../../app/features/project/query'
describe('项目字段与输入恢复', () => {
  it('默认未公开开发中，无封面与外部指标缺省不互相推导', () => {
    const form = projectForm()
    expect(form).toMatchObject({ status: 'draft', progress: 'dev', coverMediaId: null, links: [], tags: [] })
    expect(projectForm({ progress: 'archived', status: 'published' })).toMatchObject({
      progress: 'archived',
      status: 'published',
    })
    expect('stars' in form).toBe(false)
  })
  it('规范 URL 页码与进展，标签查询保留写法交服务端无视大小写匹配', () => {
    expect(projectQuery({ q: ' 工作台 ', tag: ' TypeScript ', progress: 'active', page: '2' })).toEqual({
      q: '工作台',
      tag: 'TypeScript',
      progress: 'active',
      page: 2,
      pageSize: 12,
    })
    expect(projectQuery({ progress: 'published', page: '1.5', tag: '' })).toMatchObject({
      progress: undefined,
      page: 1,
      tag: undefined,
    })
  })
  it('恢复未完成链接和标签输入，仅保留编辑白名单且克隆数组', () => {
    const value = {
      version: 1,
      context: 'library',
      id: null,
      revision: null,
      requestId: '12345678-1234-4123-a123-123456789abc',
      savedAt: '2026-09-10',
      form: {
        ...projectForm(),
        title: '创作工作台',
        tags: [{ label: 'Vue', color: 'emerald', extra: true }],
        links: [{ kind: 'docs', href: '', icon: 'lucide:book-open' }],
        stars: '500',
      },
      pendingCreate: null,
    }
    const recovery = parseProjectRecovery(JSON.stringify(value))!
    expect(recovery.form.tags).toEqual([{ label: 'Vue', color: 'emerald' }])
    expect(recovery.form.links).toEqual([{ kind: 'docs', href: '' }])
    expect('stars' in recovery.form).toBe(false)
    expect(parseProjectRecovery(JSON.stringify({ ...value, form: { ...value.form, status: 'active' } }))).toBeNull()
    expect(
      parseProjectRecovery(
        JSON.stringify({ ...value, form: { ...value.form, tags: [{ label: 'Vue', color: 'red' }] } }),
      ),
    ).toBeNull()
  })
})
