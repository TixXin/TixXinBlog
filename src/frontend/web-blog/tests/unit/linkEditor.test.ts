/** @file linkEditor.test.ts @description 友链URL重复可修正、未知提交不增殖、版本冲突与账号隔离 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminLinkEditor } from '../../app/composables/useAdminLinkEditor'
import { linkForm } from '../../app/features/link/editor'
import type { ManagedLink } from '../../app/features/link/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useLinkRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const link = (value: Partial<ManagedLink> = {}): ManagedLink => ({
  ...linkForm(),
  id: 1,
  name: '文档笔记',
  url: 'https://example.com/Docs/?a=2&a=1#KeepCase',
  domain: 'example.com',
  avatar: null,
  width: null,
  height: null,
  publishedAt: null,
  revision: 0,
  createdAt: '2026-09-10',
  updatedAt: '2026-09-10',
  ...value,
})
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(link())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(id: number | null, context = 'link-library') {
  let editor!: ReturnType<typeof useAdminLinkEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = context
          editor = useAdminLinkEditor(id)
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return editor
}
it('400重复地址不进入未知提交锁，修改地址后正常重提', async () => {
  const editor = await setup(null)
  editor.change({ name: '文档笔记', url: link().url })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('站点地址已存在'), { statusCode: 400 }))
  await editor.save('published')
  expect(editor.pendingCreate.value).toBeNull()
  expect(editor.form.url).toBe(link().url)
  const changed = 'https://example.com/Other?b=2&b=1#Exact'
  editor.change({ url: changed })
  mocks.repo.save.mockResolvedValueOnce(link({ url: changed, status: 'published' }))
  await editor.save('published')
  expect(mocks.repo.submission).not.toHaveBeenCalled()
  expect(mocks.repo.save.mock.calls[1]![0].url).toBe(changed)
  expect(editor.saved.value?.url).toBe(changed)
})
it('未知创建先查原提交，迟到结果保留后续介绍', async () => {
  const editor = await setup(null)
  editor.change({ name: '文档笔记', url: link().url })
  mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
  await editor.save('published')
  editor.change({ description: '等待时新增的介绍' })
  mocks.repo.submission.mockResolvedValueOnce({ state: 'saved', item: link({ status: 'published' }) })
  await editor.save('published')
  expect(mocks.repo.save).toHaveBeenCalledTimes(1)
  expect(editor.form.description).toBe('等待时新增的介绍')
  expect(editor.id.value).toBe(1)
})
it('冲突明确合并后使用新版本保存原输入', async () => {
  const editor = await setup(1)
  editor.change({ name: '本机名称' })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('已修改'), { statusCode: 409 }))
  mocks.repo.adminDetail.mockResolvedValueOnce(link({ name: '服务器名称', revision: 2 }))
  await editor.save('draft')
  editor.mergeConflict()
  expect(editor.form.name).toBe('本机名称')
  mocks.repo.save.mockResolvedValueOnce(link({ name: '本机名称', revision: 3 }))
  await editor.save('draft')
  expect(mocks.repo.save.mock.calls[1]![3]).toBe(2)
})
it('跨内容库旧地址和Logo完整副本不会被当前输入覆盖', async () => {
  const before = await setup(1, 'before')
  before.change({
    url: 'https://example.com/OnlyOld?Order=1&Order=2#Keep',
    logoUrl: 'https://example.com/OldLogo.png',
    isFeatured: true,
  })
  await flushPromises()
  wrappers.pop()!.unmount()
  const after = await setup(1, 'after')
  expect(after.recovery.value).toBeNull()
  expect(after.previousRecoveries.value[0]?.value.form.logoUrl).toContain('OldLogo.png')
  after.change({ description: '当前输入' })
  await flushPromises()
  expect(sessionStorage.getItem('tixxin-link-editor:owner:1:before')).toContain('Order=1&Order=2#Keep')
  expect(mocks.repo.save).not.toHaveBeenCalled()
})
