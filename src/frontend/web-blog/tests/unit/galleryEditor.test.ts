/** @file galleryEditor.test.ts @description 图库未知提交、迟到保存及账号切换不会覆盖当前输入 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminGalleryEditor } from '../../app/composables/useAdminGalleryEditor'
import { galleryForm } from '../../app/features/gallery/editor'
import type { ManagedPhoto } from '../../app/features/gallery/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: ReturnType<typeof ref<{ id: string } | null>>; restore: ReturnType<typeof vi.fn> },
  replace: vi.fn(),
}))
mockNuxtImport('useGalleryRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

const wrappers: { unmount(): void }[] = []
const photo = (patch: Partial<ManagedPhoto> = {}): ManagedPhoto => ({
  ...galleryForm(),
  id: 1,
  mediaId: '12345678-1234-4123-a123-123456789abc',
  title: '雨后的街角',
  src: '/photo.webp',
  srcLarge: '/photo.webp',
  date: '',
  revision: 0,
  createdAt: '2026-09-10',
  updatedAt: '2026-09-10',
  ...patch,
})
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(photo())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
  mocks.replace.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(id: number | null, contentContext = 'current-library', expectReady = true) {
  let editor!: ReturnType<typeof useAdminGalleryEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = contentContext
          editor = useAdminGalleryEditor(id)
          return () => h('div')
        },
      }),
    ),
  )
  if (expectReady) await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  else await vi.waitFor(() => expect(editor.error.value).toBeTruthy())
  return editor
}
describe('图库编辑请求所有权', () => {
  it('恢复的新库缺少同编号作品时，404不阻止只读查看旧拍摄资料', async () => {
    const before = await setup(1, 'before')
    before.change({ category: '旧分类', takenOn: '2024-01-08', device: '旧器材' })
    await flushPromises()
    wrappers.pop()!.unmount()
    mocks.repo.adminDetail.mockRejectedValueOnce(Object.assign(new Error('作品不存在'), { statusCode: 404 }))
    const missing = await setup(1, 'restored', false)
    expect(missing.ready.value).toBe(false)
    expect(missing.previousRecoveries.value[0]?.value.form).toMatchObject({
      category: '旧分类',
      takenOn: '2024-01-08',
      device: '旧器材',
    })
    await missing.save('draft')
    expect(mocks.repo.save).not.toHaveBeenCalled()
  })
  it('同编号恢复到另一内容库后旧拍摄信息和媒体编号仍保留，不能直接恢复提交', async () => {
    const before = await setup(1, 'before')
    before.change({
      category: '原分类',
      takenOn: '2024-01-08',
      location: '原地点',
      device: '原器材',
      mediaId: '12345678-1234-4123-a123-123456789def',
    })
    await flushPromises()
    wrappers.pop()!.unmount()
    const restored = await setup(1, 'restored')
    expect(restored.recovery.value).toBeNull()
    restored.restoreRecovery()
    expect(restored.form.mediaId).toBe(photo().mediaId)
    restored.change({ description: '恢复后新输入' })
    await flushPromises()
    wrappers.pop()!.unmount()
    const reopened = await setup(1, 'restored')
    expect(reopened.recovery.value?.form.description).toBe('恢复后新输入')
    expect(reopened.previousRecoveries.value[0]?.value.form).toMatchObject({
      category: '原分类',
      takenOn: '2024-01-08',
      location: '原地点',
      device: '原器材',
      mediaId: '12345678-1234-4123-a123-123456789def',
    })
    expect(mocks.repo.save).not.toHaveBeenCalled()
  })
  it('未知创建先查询原提交，当前新输入不被原结果覆盖', async () => {
    const editor = await setup(null)
    editor.change({ title: '雨后的街角', mediaId: photo().mediaId })
    mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
    await editor.save('published')
    expect(editor.pendingCreate.value?.title).toBe('雨后的街角')
    editor.change({ description: '响应丢失后继续输入' })
    mocks.repo.submission.mockResolvedValue({ state: 'saved', item: photo({ status: 'published' }) })
    await editor.save('published')
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
    expect(editor.id.value).toBe(1)
    expect(editor.form.description).toBe('响应丢失后继续输入')
    expect(editor.dirty.value).toBe(true)
  })
  it('迟到更新只推进服务器版本，保留保存期间的新输入', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedPhoto) => void
    mocks.repo.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.change({ title: '已经提交的一版' })
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.change({ title: '仍在输入的下一版' })
    finish(photo({ title: '已经提交的一版', revision: 1 }))
    await saving
    expect(editor.form.title).toBe('仍在输入的下一版')
    expect(editor.saved.value?.revision).toBe(1)
    expect(editor.dirty.value).toBe(true)
  })
  it('账号变化后旧写入结果不能串入新账号编辑内容', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedPhoto) => void
    mocks.repo.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.change({ title: '前一个账号的输入' })
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    mocks.auth.currentUser.value = { id: 'another-owner' }
    await flushPromises()
    finish(photo({ title: '前一个账号的输入', revision: 1 }))
    await saving
    expect(editor.form.title).toBe('雨后的街角')
    expect(editor.saved.value?.revision).toBe(0)
    expect(sessionStorage.getItem('tixxin-gallery-editor:owner:1:current-library')).toContain('前一个账号的输入')
  })
})
