/** @file adminMomentEditor.test.ts @description 动态编辑器特征回归：读取、保存与跳转、保存期间输入、冲突核查、失败保留、恢复副本、账号切换与文章搜索 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminMomentEditor } from '../../app/composables/useAdminMomentEditor'
import type { ManagedMoment } from '../../app/features/moment/types'

const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  forget: vi.fn(),
  replace: vi.fn(),
  fetchPostPage: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useMomentRepository', () => () => mocks.repo)
mockNuxtImport('useMomentStore', () => () => ({ forget: mocks.forget }))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
vi.mock('../../app/features/post/api', () => ({ fetchPostPage: mocks.fetchPostPage }))

const moment = (value: Partial<ManagedMoment> = {}): ManagedMoment => ({
  id: 'm1',
  content: '海边的清晨',
  date: '2026-10-20',
  likes: 0,
  isLiked: false,
  topics: ['旅行'],
  images: [],
  location: '',
  device: '',
  mood: '',
  linkedArticleId: null,
  linkedArticle: null,
  linkedLink: null,
  isPinned: false,
  status: 'draft',
  revision: 1,
  createdAt: '2026-10-20',
  updatedAt: '2026-10-20',
  ...value,
})
const wrappers: { unmount(): void }[] = []
let t!: (key: string) => string
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(moment())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
  mocks.forget.mockReset()
  mocks.replace.mockReset()
  mocks.fetchPostPage.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(id: string | null, waitReady = true) {
  let editor!: ReturnType<typeof useAdminMomentEditor>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        t = useI18n().t
        vi.spyOn(useRouter(), 'replace').mockImplementation(mocks.replace)
        editor = useAdminMomentEditor(id)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  if (waitReady) await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return { editor, wrapper }
}
const storageKey = (id: string | null, actor = 'owner') => `blog-moment-editor:${actor}:${id ?? 'new'}`
/** 挂载时测试路由会自行导航到首页，这里只看编辑器发起的跳转 */
const editorRedirects = () => mocks.replace.mock.calls.filter(([to]) => String(to).startsWith('/admin/moments'))

it('读取已有动态：表单取服务器内容，引用文章进入候选', async () => {
  mocks.repo.adminDetail.mockResolvedValue(
    moment({ linkedArticleId: 7, linkedArticle: { id: '7', title: '旅行札记', summary: '', url: '/articles/7' } }),
  )
  const { editor } = await setup('m1')
  expect(mocks.repo.adminDetail).toHaveBeenCalledWith('m1')
  expect(editor.form.content).toBe('海边的清晨')
  expect(editor.saved.value?.revision).toBe(1)
  expect(editor.dirty.value).toBe(false)
  expect(editor.articleChoices.value).toEqual([{ id: 7, title: '旅行札记' }])
})

it('新建发布：提交带状态与提交标识，成功后清理恢复副本、刷新缓存并跳到编辑页', async () => {
  const { editor } = await setup(null)
  expect(mocks.repo.adminDetail).not.toHaveBeenCalled()
  editor.change({ content: '新的一天' })
  await nextTick()
  expect(sessionStorage.getItem(storageKey(null))).toContain('新的一天')
  mocks.repo.save.mockResolvedValueOnce(moment({ id: 'm9', content: '新的一天', status: 'published' }))
  await editor.save('published')
  const [body, requestId, id, revision] = mocks.repo.save.mock.calls[0]!
  expect(body).toMatchObject({ content: '新的一天', status: 'published' })
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  expect([id, revision]).toEqual([undefined, undefined])
  expect(editor.id.value).toBe('m9')
  expect(editor.notice.value).toBe(t('admin-content.momentEditor.published'))
  expect(mocks.forget).toHaveBeenCalledWith('m9')
  expect(sessionStorage.getItem(storageKey(null))).toBeNull()
  expect(editorRedirects()).toEqual([['/admin/moments/m9']])
})

it('保存期间继续输入：保留新输入与恢复副本，不跳转，提示按状态区分', async () => {
  const { editor } = await setup('m1')
  editor.change({ content: '第一次修改' })
  let resolve!: (value: ManagedMoment) => void
  mocks.repo.save.mockReturnValueOnce(new Promise<ManagedMoment>((done) => (resolve = done)))
  const saving = editor.save('archived')
  expect(editor.saving.value).toBe(true)
  editor.change({ content: '保存期间的补充' })
  resolve(moment({ content: '第一次修改', status: 'archived', revision: 2 }))
  await saving
  expect(mocks.repo.save.mock.calls[0]!.slice(2)).toEqual(['m1', 1])
  expect(editor.form.content).toBe('保存期间的补充')
  expect(editor.dirty.value).toBe(true)
  expect(editor.notice.value).toBe(t('admin-content.momentEditor.archived'))
  expect(sessionStorage.getItem(storageKey('m1'))).toContain('保存期间的补充')
  expect(editorRedirects()).toEqual([])
  mocks.repo.save.mockResolvedValueOnce(moment({ content: '保存期间的补充', revision: 3 }))
  await editor.save('draft')
  expect(mocks.repo.save.mock.calls[1]!.slice(2)).toEqual(['m1', 2])
  expect(editor.notice.value).toBe(t('admin-content.momentEditor.draftSaved'))
})

it('新建冲突时按提交标识核查原提交，已有动态时读取最新版本', async () => {
  const created = await setup(null)
  created.editor.change({ content: '重复提交' })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('提交冲突'), { statusCode: 409 }))
  mocks.repo.submission.mockResolvedValueOnce(moment({ id: 'm5', revision: 4 }))
  await created.editor.save('draft')
  expect(mocks.repo.submission).toHaveBeenCalledWith(mocks.repo.save.mock.calls[0]![1])
  expect(created.editor.id.value).toBe('m5')
  expect(created.editor.saved.value?.revision).toBe(4)
  expect(created.editor.serverVersion.value?.id).toBe('m5')
  expect(created.editor.error.value).toBe(t('admin-content.momentEditor.submissionFound'))

  const existing = await setup('m1')
  existing.editor.change({ content: '本地修改' })
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('版本冲突'), { statusCode: 409 }))
  mocks.repo.adminDetail.mockResolvedValueOnce(moment({ content: '他处修改', revision: 6 }))
  await existing.editor.save('draft')
  expect(existing.editor.serverVersion.value?.revision).toBe(6)
  expect(existing.editor.error.value).toBe('版本冲突')
  expect(existing.editor.form.content).toBe('本地修改')
})

it('保存失败保留输入与恢复副本，空正文不提交', async () => {
  const { editor } = await setup('m1')
  editor.change({ content: '   ' })
  await editor.save('draft')
  expect(mocks.repo.save).not.toHaveBeenCalled()
  editor.change({ content: '离线时写下' })
  mocks.repo.save.mockRejectedValueOnce(new Error('网络中断'))
  await editor.save('draft')
  expect(editor.error.value).toBe('网络中断')
  expect(editor.form.content).toBe('离线时写下')
  expect(editor.saving.value).toBe(false)
  expect(sessionStorage.getItem(storageKey('m1'))).toContain('离线时写下')
})

it('恢复副本：重新打开后可恢复或放弃', async () => {
  const first = await setup('m1')
  first.editor.change({ content: '未保存的草稿' })
  first.wrapper.unmount()
  const { editor } = await setup('m1')
  expect(editor.recovery.value?.form.content).toBe('未保存的草稿')
  expect(editor.form.content).toBe('海边的清晨')
  editor.restoreRecovery()
  expect(editor.form.content).toBe('未保存的草稿')
  expect(editor.recovery.value).toBeNull()
  expect(editor.notice.value).toBe(t('admin-content.momentEditor.recoveryRestored'))
  const again = await setup('m1')
  expect(again.editor.recovery.value).not.toBeNull()
  again.editor.discardRecovery()
  expect(again.editor.recovery.value).toBeNull()
  expect(sessionStorage.getItem(storageKey('m1'))).toBeNull()
})

it('未登录时提示登录，换账号后清空旧输入并重新读取', async () => {
  mocks.auth.restore.mockResolvedValueOnce(false)
  const anonymous = await setup('m1', false)
  await vi.waitFor(() => expect(anonymous.editor.error.value).toBe(t('admin-content.momentEditor.loginFirst')))
  expect(anonymous.editor.ready.value).toBe(false)

  const { editor } = await setup('m1')
  editor.change({ content: '旧账号的输入' })
  mocks.repo.adminDetail.mockResolvedValueOnce(moment({ content: '新账号读取', revision: 8 }))
  mocks.auth.currentUser.value = { id: 'other' }
  await flushPromises()
  await vi.waitFor(() => expect(editor.form.content).toBe('新账号读取'))
  expect(sessionStorage.getItem(storageKey('m1'))).toContain('旧账号的输入')
  expect(editor.saved.value?.revision).toBe(8)
})

it('文章搜索防抖、失败提示，并保留已引用的文章', async () => {
  mocks.repo.adminDetail.mockResolvedValue(
    moment({ linkedArticleId: 7, linkedArticle: { id: '7', title: '旅行札记', summary: '', url: '/articles/7' } }),
  )
  const { editor } = await setup('m1')
  mocks.fetchPostPage.mockResolvedValueOnce({ items: [{ id: 9, title: '山间小屋' }] })
  editor.searchArticles('小屋')
  editor.searchArticles('山间')
  expect(editor.articlesPending.value).toBe(true)
  await vi.waitFor(() => expect(editor.articlesPending.value).toBe(false))
  expect(mocks.fetchPostPage).toHaveBeenCalledTimes(1)
  expect(mocks.fetchPostPage.mock.calls[0]![1]).toEqual({ search: '山间', pageSize: 20 })
  expect(editor.articleChoices.value).toEqual([
    { id: 7, title: '旅行札记' },
    { id: 9, title: '山间小屋' },
  ])
  mocks.fetchPostPage.mockRejectedValueOnce(new Error('offline'))
  editor.searchArticles('海')
  await vi.waitFor(() => expect(editor.articlesError.value).toBe(t('admin-content.momentEditor.articleSearchFailed')))
  expect(editor.articlesPending.value).toBe(false)
})
