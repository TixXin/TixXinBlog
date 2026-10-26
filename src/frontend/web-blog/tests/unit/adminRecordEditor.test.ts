/** @file adminRecordEditor.test.ts @description 后台记录编辑器通用核心的特征回归：保存与跳转、未知提交核查、错误分派、冲突合并、恢复副本与归属变化 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminRecordEditor } from '../../app/composables/useAdminRecordEditor'
import type { AdminRecordEditorMsgKey, AdminRecordRecovery } from '../../app/composables/useAdminRecordEditor'

interface NoteForm {
  title: string
  status: 'draft' | 'published'
}
interface Note extends NoteForm {
  id: number
  revision: number
}
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  replace: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)

const keys: AdminRecordEditorMsgKey[] = [
  'loginRequired',
  'contextChangedOnLoad',
  'migrationIssue',
  'recoveryUnreadable',
  'loadFailed',
  'persistFailed',
  'contextChanged',
  'submissionDeleted',
  'saved',
  'savedDirty',
  'saveFailed',
  'pendingHint',
  'reloadConfirm',
  'recoveryMismatch',
  'restored',
  'discardFailed',
  'merged',
  'leaveConfirm',
  'contextSwitched',
]
const messages = Object.fromEntries(keys.map((key) => [key, `msg.${key}`])) as Record<AdminRecordEditorMsgKey, string>
const note = (value: Partial<Note> = {}): Note => ({ id: 3, revision: 1, title: '读书笔记', status: 'draft', ...value })
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(note())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
  mocks.replace.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function createEditor(initialId: number | null) {
  return useAdminRecordEditor<NoteForm, Note, NoteForm['status'], AdminRecordRecovery<NoteForm>>({
    initialId,
    storagePrefix: 'test-note-editor',
    parseRecovery: (raw) => (raw ? (JSON.parse(raw) as AdminRecordRecovery<NoteForm>) : null),
    createDefaultForm: () => ({ title: '', status: 'draft' }),
    entityToForm: (entity) => ({ title: entity.title, status: entity.status }),
    cloneForm: (form) => ({ ...form }),
    canSave: (form) => !!form.title.trim(),
    repo: mocks.repo,
    refreshKeys: ['notes'],
    redirectPath: (entity) => `/admin/notes/${entity.id}`,
    messages,
  })
}
async function setup(initialId: number | null, context = 'library-a', waitReady = true) {
  let editor!: ReturnType<typeof createEditor>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useState('page-content-context').value = context
        vi.spyOn(useRouter(), 'replace').mockImplementation(mocks.replace)
        editor = createEditor(initialId)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  if (waitReady) await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return { editor, wrapper }
}
/** 挂载时测试路由会自行导航到首页，这里只看编辑器发起的跳转 */
const editorRedirects = () => mocks.replace.mock.calls.filter(([to]) => String(to).startsWith('/admin/notes'))

it('新建保存：带状态提交，成功后接受结果、清除恢复副本并跳到编辑页', async () => {
  const { editor } = await setup(null)
  expect(mocks.repo.adminDetail).not.toHaveBeenCalled()
  editor.change({ title: '新的笔记' })
  mocks.repo.save.mockResolvedValueOnce(note({ id: 5, title: '新的笔记', status: 'published' }))
  await editor.save('published')
  const [body, requestId, id, revision] = mocks.repo.save.mock.calls[0]!
  expect(body).toEqual({ title: '新的笔记', status: 'published' })
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  expect([id, revision]).toEqual([undefined, undefined])
  expect(editor.id.value).toBe(5)
  expect(editor.pendingCreate.value).toBeNull()
  expect(editor.notice.value).toBe('msg.saved')
  expect(editor.dirty.value).toBe(false)
  expect(Object.keys(sessionStorage)).toEqual([])
  expect(editorRedirects()).toEqual([['/admin/notes/5']])
})

it('不可保存或未就绪时不提交，保存期间继续输入时保留新输入且不跳转', async () => {
  const { editor } = await setup(3)
  editor.change({ title: '  ' })
  await editor.save('draft')
  expect(mocks.repo.save).not.toHaveBeenCalled()
  editor.change({ title: '第一次修改' })
  let resolve!: (value: Note) => void
  mocks.repo.save.mockReturnValueOnce(new Promise<Note>((done) => (resolve = done)))
  const saving = editor.save('draft')
  editor.change({ title: '保存期间的补充' })
  resolve(note({ title: '第一次修改', revision: 2 }))
  await saving
  expect(mocks.repo.save.mock.calls[0]!.slice(2)).toEqual([3, 1])
  expect(editor.form.title).toBe('保存期间的补充')
  expect(editor.notice.value).toBe('msg.savedDirty')
  expect(editor.dirty.value).toBe(true)
  expect(JSON.stringify(Object.values(sessionStorage))).toContain('保存期间的补充')
  expect(editorRedirects()).toEqual([])
})

it('新建结果未知时保留待核查提交，下次先按提交标识核查原结果', async () => {
  const { editor } = await setup(null)
  editor.change({ title: '离线写下' })
  mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
  await editor.save('draft')
  expect(editor.error.value).toBe('连接中断msg.pendingHint')
  expect(editor.pendingCreate.value).toEqual({ title: '离线写下', status: 'draft' })
  const requestId = mocks.repo.save.mock.calls[0]![1]
  mocks.repo.submission.mockResolvedValueOnce({ state: 'saved', item: note({ id: 8, title: '离线写下' }) })
  await editor.save('published')
  expect(mocks.repo.submission).toHaveBeenCalledWith(requestId)
  expect(mocks.repo.save).toHaveBeenCalledTimes(1)
  expect(editor.id.value).toBe(8)
  expect(editor.pendingCreate.value).toBeNull()
})

it('原提交已删除时提示且不重复创建，404 时按原提交重新保存', async () => {
  const deleted = await setup(null)
  deleted.editor.change({ title: '被删除的提交' })
  mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
  await deleted.editor.save('draft')
  mocks.repo.submission.mockResolvedValueOnce({ state: 'deleted', id: 4 })
  await deleted.editor.save('draft')
  expect(deleted.editor.error.value).toBe('msg.submissionDeleted' + 'msg.pendingHint')
  expect(mocks.repo.save).toHaveBeenCalledTimes(1)

  const missing = await setup(null)
  missing.editor.change({ title: '未到达的提交' })
  mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
  await missing.editor.save('draft')
  mocks.repo.submission.mockRejectedValueOnce(Object.assign(new Error('不存在'), { statusCode: 404 }))
  mocks.repo.save.mockResolvedValueOnce(note({ id: 9, title: '未到达的提交' }))
  await missing.editor.save('published')
  expect(mocks.repo.save.mock.calls.at(-1)![0]).toEqual({ title: '未到达的提交', status: 'draft' })
  expect(missing.editor.id.value).toBe(9)
})

it('400 释放待核查提交；409 读取最新版本，合并后只推进版本号', async () => {
  const created = await setup(null)
  created.editor.change({ title: '重复标题' })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('标题重复'), { statusCode: 400 }))
  await created.editor.save('draft')
  expect(created.editor.pendingCreate.value).toBeNull()
  expect(created.editor.error.value).toBe('标题重复')

  const { editor } = await setup(3)
  editor.change({ title: '本地修改' })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('版本冲突'), { statusCode: 409 }))
  mocks.repo.adminDetail.mockResolvedValueOnce(note({ title: '他处修改', revision: 6 }))
  await editor.save('draft')
  expect(editor.serverVersion.value?.revision).toBe(6)
  editor.mergeConflict()
  expect(editor.revision.value).toBe(6)
  expect(editor.serverVersion.value).toBeNull()
  expect(editor.form.title).toBe('本地修改')
  expect(editor.notice.value).toBe('msg.merged')
  expect(editor.error.value).toBe('')
})

it('恢复副本：重新打开后可恢复或放弃，内容库不符时拒绝恢复', async () => {
  const first = await setup(3)
  first.editor.change({ title: '未保存的草稿' })
  await nextTick()
  first.wrapper.unmount()
  const { editor } = await setup(3)
  expect(editor.recovery.value?.form.title).toBe('未保存的草稿')
  expect(editor.form.title).toBe('读书笔记')
  editor.restoreRecovery()
  expect(editor.form.title).toBe('未保存的草稿')
  expect(editor.notice.value).toBe('msg.restored')
  expect(editor.recovery.value).toBeNull()
  const again = await setup(3)
  again.editor.discardRecovery()
  expect(again.editor.recovery.value).toBeNull()
  const other = await setup(3, 'library-b')
  expect(other.editor.recovery.value).toBeNull()
})

it('未登录提示登录；内容库切换后停止编辑；有改动时取消重新读取不覆盖输入', async () => {
  mocks.auth.restore.mockResolvedValueOnce(false)
  const anonymous = await setup(3, 'library-a', false)
  await vi.waitFor(() => expect(anonymous.editor.error.value).toBe('msg.loginRequired'))

  const { editor } = await setup(3)
  editor.change({ title: '待确认的修改' })
  const reads = mocks.repo.adminDetail.mock.calls.length
  const confirm = vi.fn().mockReturnValueOnce(false)
  vi.stubGlobal('confirm', confirm)
  await editor.reload()
  expect(confirm).toHaveBeenCalledWith('msg.reloadConfirm')
  expect(mocks.repo.adminDetail).toHaveBeenCalledTimes(reads)
  expect(editor.form.title).toBe('待确认的修改')
  confirm.mockReturnValueOnce(true)
  mocks.repo.adminDetail.mockResolvedValueOnce(note({ title: '服务器版本', revision: 4 }))
  await editor.reload()
  expect(editor.form.title).toBe('服务器版本')
  vi.unstubAllGlobals()

  useState('page-content-context').value = 'library-b'
  await flushPromises()
  expect(editor.ready.value).toBe(false)
  expect(editor.error.value).toBe('msg.contextSwitched')
})
