/** @file siteSettingsEditor.test.ts @description 站点编辑恢复、账号/内容库请求所有权、三方冲突和未知提交结果 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSiteSettingsEditor } from '../../app/composables/useSiteSettingsEditor'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { SiteSettingsData } from '../../app/features/site/settings'
import { emptyAbout } from '../../app/features/about/settings'
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  accept: vi.fn(),
  success: vi.fn(),
  routeLeave: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useSiteSettings', () => () => ({ accept: mocks.accept }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('onBeforeRouteLeave', () => mocks.routeLeave)
const wrappers: { unmount(): void }[] = []
let server: SiteSettingsData
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  window.confirm = vi.fn().mockReturnValue(true)
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  server = { ...structuredClone(defaultSiteSettings), about: emptyAbout(), revision: 3 }
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith('/revisions') ? { items: [], total: 0 } : structuredClone(server),
  )
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup() {
  let editor!: ReturnType<typeof useSiteSettingsEditor>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        editor = useSiteSettingsEditor()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  await flushPromises()
  return { editor, context, wrapper }
}
it('刷新恢复必须显式载入，竞争字段取消后原副本仍存在', async () => {
  const first = await setup()
  first.editor.draft.value!.ownerName = '未保存姓名'
  first.wrapper.unmount()
  server.ownerName = '服务器新姓名'
  server.announcement = '独立新公告'
  server.revision++
  const { editor } = await setup()
  expect(editor.draft.value!.ownerName).toBe('服务器新姓名')
  expect(editor.preserved.value!.ownerName).toBe('未保存姓名')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  editor.recoverPreserved()
  expect(editor.draft.value!.ownerName).toBe('服务器新姓名')
  expect(confirm).toHaveBeenCalledOnce()
  confirm.mockReturnValue(true)
  editor.recoverPreserved()
  expect(editor.draft.value!.ownerName).toBe('未保存姓名')
  expect(editor.draft.value!.announcement).toBe('独立新公告')
})
it.each(['actor', 'context'])('%s 切换拒绝旧成功响应并按原归属保留副本', async (kind) => {
  const { editor, context } = await setup()
  editor.draft.value!.ownerName = '旧页输入'
  const request = deferred<SiteSettingsData>()
  mocks.api.mockImplementation((path: string, options?: { method?: string }) =>
    options?.method === 'PATCH'
      ? request.promise
      : Promise.resolve(path.endsWith('/revisions') ? { items: [], total: 0 } : structuredClone(server)),
  )
  const writing = editor.save()
  if (kind === 'actor') mocks.auth.currentUser.value = { id: 'other-owner' }
  else context.value = 'library-b'
  expect(editor.ready.value).toBe(false)
  expect(editor.draft.value).toBeNull()
  request.resolve({ ...server, ownerName: '迟到资料', revision: 4 })
  await writing
  expect(editor.draft.value).toBeNull()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('tixxin-site-settings:owner:library-a')).toContain('旧页输入')
  await editor.load()
  expect(editor.ready.value).toBe(true)
  expect(editor.preserved.value).toBeNull()
})
it('响应丢失后只读核对，不重复 PATCH；服务器已有提交则清除未确认状态', async () => {
  const { editor } = await setup()
  editor.draft.value!.ownerName = '已写入的新姓名'
  let writes = 0
  mocks.api.mockImplementation(async (path: string, options?: { method?: string; body?: SiteSettingsData }) => {
    if (options?.method === 'PATCH') {
      writes++
      server = { ...server, ...JSON.parse(JSON.stringify(options.body)), revision: 4 }
      throw new TypeError('network')
    }
    return path.endsWith('/revisions') ? { items: [], total: 0 } : structuredClone(server)
  })
  await editor.save()
  expect(editor.submission.value).not.toBeNull()
  await editor.save()
  expect(writes).toBe(1)
  await editor.checkSubmission()
  expect(editor.submission.value).toBeNull()
  expect(editor.dirty.value).toBe(false)
  expect(editor.draft.value!.revision).toBe(4)
  expect(writes).toBe(1)
})
it('未确认提交刷新后仍禁止写入，已保存结果不会作为旧输入重新覆盖', async () => {
  const first = await setup()
  first.editor.draft.value!.ownerName = '刷新前提交'
  mocks.api.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === 'PATCH') {
      server.ownerName = '刷新前提交'
      server.revision++
      throw new Error('断线')
    }
    return path.endsWith('/revisions') ? { items: [], total: 0 } : structuredClone(server)
  })
  await first.editor.save()
  first.wrapper.unmount()
  const { editor } = await setup()
  expect(editor.submission.value).not.toBeNull()
  await editor.checkSubmission()
  expect(editor.submission.value).toBeNull()
  expect(editor.preserved.value).toBeNull()
  expect(editor.dirty.value).toBe(false)
})
it('迟到成功保留请求开始后新输入，冲突合并只更新已修改字段', async () => {
  const { editor } = await setup()
  editor.draft.value!.ownerName = '提交姓名'
  const request = deferred<SiteSettingsData>()
  mocks.api.mockImplementation((path: string, options?: { method?: string }) =>
    options?.method === 'PATCH'
      ? request.promise
      : Promise.resolve(path.endsWith('/revisions') ? { items: [], total: 0 } : structuredClone(server)),
  )
  const saving = editor.save()
  editor.draft.value!.seoTitle = '请求后输入'
  request.resolve({ ...server, ownerName: '提交姓名', revision: 4 })
  await saving
  expect(editor.draft.value!.seoTitle).toBe('请求后输入')
  expect(editor.dirty.value).toBe(true)
  editor.conflict.value = { ...server, ownerName: '提交姓名', announcement: '另一页公告', revision: 5 }
  editor.mergeConflict()
  expect(editor.draft.value!.announcement).toBe('另一页公告')
  expect(editor.draft.value!.seoTitle).toBe('请求后输入')
})
it('内容库切换后的历史迟到响应不能恢复旧预览', async () => {
  const { editor, context } = await setup()
  const request = deferred<SiteSettingsData>()
  mocks.api.mockImplementation((path: string) =>
    path.endsWith('/revisions/1') ? request.promise : Promise.resolve(structuredClone(server)),
  )
  const viewing = editor.inspect(1)
  context.value = 'restored-library'
  await editor.load()
  request.resolve({ ...server, ownerName: '旧内容库历史', revision: 1 })
  await viewing
  expect(editor.historical.value).toBeNull()
  expect(editor.historyPending.value).toBe(false)
  expect(editor.draft.value!.ownerName).toBe(server.ownerName)
})
it('结果核对仍失败时保留未确认标识与可恢复输入', async () => {
  const { editor } = await setup()
  editor.draft.value!.ownerName = '待核对姓名'
  mocks.api.mockRejectedValue(new Error('服务不可用'))
  await editor.save()
  await editor.checkSubmission()
  expect(editor.submission.value).not.toBeNull()
  expect(editor.draft.value!.ownerName).toBe('待核对姓名')
  expect(editor.error.value).toContain('仍无法确认')
  expect(sessionStorage.getItem('tixxin-site-settings:owner:library-a')).toContain('待核对姓名')
})
it('损坏的原副本不会被正常加载或卸载静默删除', async () => {
  const raw = '{ incomplete'
  sessionStorage.setItem('tixxin-site-settings:owner:library-a', raw)
  const { editor, wrapper } = await setup()
  expect(editor.error.value).toContain('格式不完整')
  editor.draft.value!.ownerName = '新编辑仍在内存'
  wrapper.unmount()
  expect(sessionStorage.getItem('tixxin-site-settings:owner:library-a')).toBe(raw)
})
