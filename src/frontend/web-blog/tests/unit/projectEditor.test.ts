/** @file projectEditor.test.ts @description 项目无封面创建、未知提交、迟到输入、冲突合并与账号隔离 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminProjectEditor } from '../../app/composables/useAdminProjectEditor'
import { projectForm } from '../../app/features/project/editor'
import type { ManagedProject } from '../../app/features/project/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useProjectRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
const project = (patch: Partial<ManagedProject> = {}): ManagedProject => ({
  ...projectForm(),
  id: 1,
  title: '创作工作台',
  cover: null,
  width: null,
  height: null,
  publishedAt: null,
  revision: 0,
  createdAt: '2026-09-10',
  updatedAt: '2026-09-10',
  ...patch,
})
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(project())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(id: number | null, contentContext = 'project-library', expectReady = true) {
  let editor!: ReturnType<typeof useAdminProjectEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = contentContext
          editor = useAdminProjectEditor(id)
          return () => h('div')
        },
      }),
    ),
  )
  if (expectReady) await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  else await vi.waitFor(() => expect(editor.error.value).toBeTruthy())
  return editor
}
describe('项目管理提交', () => {
  it('恢复的新库没有旧编号时，详情404仍展示完整旧副本而不允许提交', async () => {
    const before = await setup(1, 'before')
    before.change({
      links: [{ kind: 'docs', href: 'https://example.com/only-old' }],
      tags: [{ label: '旧技术', color: 'rose' }],
    })
    await flushPromises()
    wrappers.pop()!.unmount()
    mocks.repo.adminDetail.mockRejectedValueOnce(Object.assign(new Error('项目不存在'), { statusCode: 404 }))
    const missing = await setup(1, 'restored', false)
    expect(missing.ready.value).toBe(false)
    expect(missing.previousRecoveries.value[0]?.value.form.links[0]?.href).toBe('https://example.com/only-old')
    expect(missing.previousRecoveries.value[0]?.value.form.tags[0]?.label).toBe('旧技术')
    await missing.save('draft')
    expect(mocks.repo.save).not.toHaveBeenCalled()
  })
  it('同账号同编号切换内容库后完整旧草稿独立保留，新编辑和再次刷新不能覆盖', async () => {
    const before = await setup(1, 'before')
    before.change({
      progress: 'archived',
      coverMediaId: '12345678-1234-4123-a123-123456789abc',
      tags: [{ label: 'UnstoredTech', color: 'rose' }],
      links: [{ kind: 'docs', href: 'https://example.com/OnlyInDraft?version=Original' }],
    })
    await flushPromises()
    wrappers.pop()!.unmount()
    const restored = await setup(1, 'restored')
    expect(restored.recovery.value).toBeNull()
    expect(restored.previousRecoveries.value[0]?.value.form.progress).toBe('archived')
    restored.restoreRecovery()
    expect(restored.form.coverMediaId).toBeNull()
    expect(restored.form.links).toEqual([])
    restored.change({ description: '恢复后继续编辑' })
    await flushPromises()
    wrappers.pop()!.unmount()
    const reopened = await setup(1, 'restored')
    expect(reopened.recovery.value?.form.description).toBe('恢复后继续编辑')
    expect(reopened.previousRecoveries.value[0]?.value.form.links[0]?.href).toContain('version=Original')
    expect(reopened.previousRecoveries.value[0]?.value.form.tags[0]?.label).toBe('UnstoredTech')
    expect(mocks.repo.save).not.toHaveBeenCalled()
  })
  it('无封面未知创建核查原提交，继续输入的标签不被成功结果覆盖', async () => {
    const editor = await setup(null)
    editor.change({ title: '创作工作台', progress: 'archived' })
    mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
    await editor.save('published')
    expect(mocks.repo.save.mock.calls[0]![0]).toMatchObject({
      coverMediaId: null,
      progress: 'archived',
      status: 'published',
    })
    editor.change({ tags: [{ label: '新的技术', color: 'blue' }] })
    mocks.repo.submission.mockResolvedValue({
      state: 'saved',
      item: project({ status: 'published', progress: 'archived' }),
    })
    await editor.save('published')
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
    expect(editor.id.value).toBe(1)
    expect(editor.form.tags[0]?.label).toBe('新的技术')
    expect(editor.dirty.value).toBe(true)
  })
  it('迟到更新推进版本但不覆盖保存期间的新链接', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedProject) => void
    mocks.repo.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.change({ description: '已提交说明' })
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.change({ links: [{ kind: 'docs', href: 'https://example.com/docs' }] })
    finish(project({ description: '已提交说明', revision: 1 }))
    await saving
    expect(editor.form.links[0]?.href).toBe('https://example.com/docs')
    expect(editor.saved.value?.revision).toBe(1)
  })
  it('显式冲突合并只接受新版本号，再手动保存当前输入', async () => {
    const editor = await setup(1)
    editor.change({ title: '本机项目名称' })
    mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('项目已变化'), { statusCode: 409 }))
    mocks.repo.adminDetail.mockResolvedValue(project({ title: '服务器项目名称', revision: 2 }))
    await editor.save('draft')
    expect(editor.serverVersion.value?.revision).toBe(2)
    editor.mergeConflict()
    expect(editor.form.title).toBe('本机项目名称')
    mocks.repo.save.mockResolvedValueOnce(project({ title: '本机项目名称', revision: 3 }))
    await editor.save('draft')
    expect(mocks.repo.save.mock.calls[1]![3]).toBe(2)
    expect(editor.dirty.value).toBe(false)
  })
  it('换账号后旧响应无法写入新账号编辑器，原输入独立保留', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedProject) => void
    mocks.repo.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.change({ title: '前一账号的输入' })
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    mocks.auth.currentUser.value = { id: 'another-owner' }
    await flushPromises()
    finish(project({ title: '前一账号的输入', revision: 1 }))
    await saving
    expect(editor.form.title).toBe('创作工作台')
    expect(sessionStorage.getItem('tixxin-project-editor:owner:1:project-library')).toContain('前一账号的输入')
  })
})
