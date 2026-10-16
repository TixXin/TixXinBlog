/** @file promptEditor.test.ts @description 提示词保存失败、幂等核查、冲突合并、迟到响应与账号隔离 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePromptEditor } from '../../app/composables/usePromptEditor'
import { promptForm } from '../../app/features/prompt/editor'
import type { ManagedPrompt } from '../../app/features/prompt/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
  saved: vi.fn(),
  update: null as
    ((to: { query: Record<string, unknown> }, from: { query: Record<string, unknown> }) => boolean) | null,
  leave: null as (() => boolean) | null,
}))
mockNuxtImport('usePromptRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('onBeforeRouteUpdate', () => (guard: NonNullable<typeof mocks.update>) => {
  mocks.update = guard
})
mockNuxtImport('onBeforeRouteLeave', () => (guard: NonNullable<typeof mocks.leave>) => {
  mocks.leave = guard
})
const wrappers: { unmount(): void }[] = []
const item = (patch: Partial<ManagedPrompt> = {}): ManagedPrompt => ({
  ...promptForm(),
  id: 1,
  title: '午后光影',
  prompt: 'A quiet sunlit room',
  mediaId: 'image-id',
  externalImageUrl: null,
  imageUrl: '/api/v1/media/image-id.webp',
  width: 1200,
  height: 800,
  revision: 1,
  publishedAt: null,
  createdAt: '2026-10-03',
  updatedAt: '2026-10-03',
  ...patch,
})
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(item())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
  mocks.saved.mockReset()
  mocks.update = null
  mocks.leave = null
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup(id: number | null, context = 'prompt-library') {
  let editor!: ReturnType<typeof usePromptEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = context
          editor = usePromptEditor(id, mocks.saved)
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return editor
}
describe('图片提示词编辑生命周期', () => {
  it('断网失败保留文字和图片并记录恢复副本', async () => {
    const editor = await setup(1)
    editor.form.prompt = '完整保留我的新提示词'
    mocks.repo.save.mockRejectedValueOnce(new Error('断网'))
    await editor.save('published')
    expect(editor.form.prompt).toBe('完整保留我的新提示词')
    expect(editor.form.mediaId).toBe('image-id')
    expect(editor.dirty.value).toBe(true)
    expect(editor.error.value).toContain('断网')
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('完整保留我的新提示词')
  })
  it('未知创建再次保存先核查原请求，不重复提交或覆盖后续输入', async () => {
    const editor = await setup(null)
    Object.assign(editor.form, { title: '午后光影', prompt: 'A quiet sunlit room', mediaId: 'image-id' })
    mocks.repo.save.mockRejectedValueOnce(new Error('响应中断'))
    await editor.save('published')
    const requestId = mocks.repo.save.mock.calls[0]![1]
    editor.form.description = '在核查前补充的创作笔记'
    mocks.repo.submission.mockResolvedValueOnce({ state: 'saved', item: item({ status: 'published' }) })
    await editor.save('published')
    expect(mocks.repo.submission).toHaveBeenCalledWith(requestId)
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
    expect(editor.id.value).toBe(1)
    expect(editor.form.description).toBe('在核查前补充的创作笔记')
    expect(editor.dirty.value).toBe(true)
  })
  it('409 不覆盖本地输入，显式合并后下一次保存使用最新版本', async () => {
    const editor = await setup(1)
    editor.form.prompt = '我的本地提示词'
    mocks.repo.save.mockRejectedValueOnce(
      Object.assign(new Error('版本冲突'), { statusCode: 409, conflictKind: 'revision' }),
    )
    mocks.repo.adminDetail.mockResolvedValueOnce(item({ prompt: '服务器提示词', revision: 2 }))
    await editor.save('published')
    expect(editor.serverVersion.value?.prompt).toBe('服务器提示词')
    expect(editor.form.prompt).toBe('我的本地提示词')
    editor.merge()
    mocks.repo.save.mockResolvedValueOnce(item({ prompt: '我的本地提示词', revision: 3, status: 'published' }))
    await editor.save('published')
    expect(mocks.repo.save.mock.calls[1]![3]).toBe(2)
    expect(editor.dirty.value).toBe(false)
  })
  it('提交期间新增的输入不会被迟到成功覆盖', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedPrompt) => void
    mocks.repo.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.form.title = '已提交标题'
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.form.negativePrompt = '迟到期间的新文字'
    finish(item({ title: '已提交标题', revision: 2 }))
    await saving
    expect(editor.form.negativePrompt).toBe('迟到期间的新文字')
    expect(editor.dirty.value).toBe(true)
  })
  it('换账号后停止管理写入，原账号响应和恢复副本不能归入新账号', async () => {
    const editor = await setup(1)
    let finish!: (value: ManagedPrompt) => void
    mocks.repo.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    editor.form.title = '原账号未保存内容'
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    mocks.auth.currentUser.value = { id: 'other' }
    await flushPromises()
    finish(item({ title: '原账号未保存内容', revision: 2 }))
    await saving
    expect(editor.ready.value).toBe(false)
    expect(mocks.saved).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('原账号未保存内容')
    await editor.save('published')
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
  })
  it('关闭重开可显式恢复文字，跨内容库不会直接套用旧图片与编号', async () => {
    const editor = await setup(1)
    editor.form.description = '值得留下的笔记'
    await flushPromises()
    wrappers.pop()!.unmount()
    const reopened = await setup(1)
    expect(reopened.recovery.value?.form.description).toBe('值得留下的笔记')
    reopened.restoreRecovery()
    expect(reopened.form.description).toBe('值得留下的笔记')
    wrappers.pop()!.unmount()
    const restored = await setup(1, 'restored-library')
    expect(restored.recovery.value).toBeNull()
    expect(restored.form.description).toBe('')
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('值得留下的笔记')
  })
  it('恢复副本存储失败时退出确认明确说明风险，不虚报已经保留', async () => {
    const editor = await setup(1)
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const storage = sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: storage.getItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    editor.form.description = '仍在页面里的重要笔记'
    await flushPromises()
    expect(editor.localError.value).toContain('无法保存')
    expect(editor.canClose()).toBe(false)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('恢复副本未能保存'))
    expect(confirm).not.toHaveBeenCalledWith(expect.stringContaining('已保留本标签页副本'))
    expect(editor.form.description).toBe('仍在页面里的重要笔记')
  })
  it('恢复副本不会未经确认覆盖重新打开后继续写入的文字', async () => {
    const prior = await setup(1)
    prior.form.description = '上次的恢复副本'
    await flushPromises()
    wrappers.pop()!.unmount()
    const editor = await setup(1)
    expect(editor.recovery.value?.form.description).toBe('上次的恢复副本')
    editor.form.description = '这次刚写的笔记'
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    editor.restoreRecovery()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('替换当前表单'))
    expect(editor.form.description).toBe('这次刚写的笔记')
    confirm.mockReturnValue(true)
    editor.restoreRecovery()
    expect(editor.form.description).toBe('上次的恢复副本')
  })
  it('撤回全部修改后清理过期副本，重新打开不再提示恢复已放弃的输入', async () => {
    const editor = await setup(1)
    editor.form.description = '已放弃的笔记'
    await flushPromises()
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('已放弃的笔记')
    editor.form.description = ''
    await flushPromises()
    expect(editor.dirty.value).toBe(false)
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toBeNull()
    wrappers.pop()!.unmount()
    const reopened = await setup(1)
    expect(reopened.recovery.value).toBeNull()
  })
  it('移除上次副本时保留当前新输入，关闭重开仍可恢复本次输入', async () => {
    const prior = await setup(1)
    prior.form.description = '上次未保存的笔记'
    await flushPromises()
    wrappers.pop()!.unmount()
    const editor = await setup(1)
    editor.form.description = '本次新增的笔记'
    await flushPromises()
    editor.discardRecovery()
    expect(editor.recovery.value).toBeNull()
    expect(editor.form.description).toBe('本次新增的笔记')
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('本次新增的笔记')
    wrappers.pop()!.unmount()
    const reopened = await setup(1)
    expect(reopened.recovery.value?.form.description).toBe('本次新增的笔记')
  })
  it('重新打开后撤回本次修改，仍保留尚未处理的上次副本', async () => {
    const prior = await setup(1)
    prior.form.description = '上次未保存的笔记'
    await flushPromises()
    wrappers.pop()!.unmount()
    const editor = await setup(1)
    editor.form.description = '本次暂写的文字'
    await flushPromises()
    editor.form.description = ''
    await flushPromises()
    expect(editor.dirty.value).toBe(false)
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('上次未保存的笔记')
    wrappers.pop()!.unmount()
    const reopened = await setup(1)
    expect(reopened.recovery.value?.form.description).toBe('上次未保存的笔记')
  })
  it('新建成功后继续编辑的副本跟随真实作品，重新从作品入口打开仍可恢复', async () => {
    const editor = await setup(null)
    Object.assign(editor.form, promptForm(item({ id: 7 })))
    mocks.repo.save.mockResolvedValueOnce(item({ id: 7 }))
    await editor.save('draft')
    editor.form.description = '保存之后继续补写，尚未提交'
    await flushPromises()
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:new')).toBeNull()
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:7')).toContain('保存之后继续补写')
    wrappers.pop()!.unmount()
    mocks.repo.adminDetail.mockResolvedValueOnce(item({ id: 7 }))
    const reopened = await setup(7)
    expect(reopened.recovery.value?.id).toBe(7)
    reopened.restoreRecovery()
    expect(reopened.form.description).toBe('保存之后继续补写，尚未提交')
  })
  it('核查新建成功后的后续输入迁至作品编号，旧的新建副本不会重复出现', async () => {
    const editor = await setup(null)
    Object.assign(editor.form, promptForm(item()))
    mocks.repo.save.mockRejectedValueOnce(new Error('响应中断'))
    await editor.save('draft')
    editor.form.negativePrompt = '未知提交后补写的排除词'
    mocks.repo.submission.mockResolvedValueOnce({ state: 'saved', item: item({ id: 8 }) })
    await editor.save('draft')
    expect(editor.dirty.value).toBe(true)
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:new')).toBeNull()
    const recovery = JSON.parse(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:8')!)
    expect(recovery.id).toBe(8)
    expect(recovery.form.negativePrompt).toBe('未知提交后补写的排除词')
    expect(recovery.pendingCreate).toBeNull()
  })
  it('归属新作品的副本写入失败时保留原新建副本并明确提示', async () => {
    const editor = await setup(null)
    Object.assign(editor.form, promptForm(item()))
    let finish!: (value: ManagedPrompt) => void
    mocks.repo.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const saving = editor.save('draft')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.form.description = '保存过程中新写的内容'
    await flushPromises()
    const storage = sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: storage.getItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
      setItem: (key: string, value: string) => {
        if (key.endsWith(':9')) throw new Error('quota exceeded')
        storage.setItem(key, value)
      },
    })
    finish(item({ id: 9 }))
    await saving
    expect(editor.localError.value).toContain('无法保存')
    expect(editor.form.description).toBe('保存过程中新写的内容')
    expect(storage.getItem('blog-prompt-editor:owner:prompt-library:new')).toContain('保存过程中新写的内容')
  })
  it.each(['站点数据上下文已变化，请刷新页面', '登录账号或内容库已变化，请重新核对'])(
    '上下文409保留输入并停用合并，不按同编号读取另一内容库：%s',
    async (message) => {
      const editor = await setup(1)
      editor.form.description = '必须保留的旧上下文笔记'
      // 即使先前已有作品冲突对照，上下文失效后也不能继续合并该版本。
      mocks.repo.save.mockRejectedValueOnce(
        Object.assign(new Error('作品版本已变化'), { statusCode: 409, conflictKind: 'revision' }),
      )
      mocks.repo.adminDetail.mockResolvedValueOnce(item({ revision: 2 }))
      await editor.save('draft')
      expect(editor.serverVersion.value?.revision).toBe(2)
      const reads = mocks.repo.adminDetail.mock.calls.length
      mocks.repo.save.mockRejectedValueOnce(
        Object.assign(new Error(message), { statusCode: 409, conflictKind: 'context' }),
      )
      await editor.save('draft')
      expect(mocks.repo.adminDetail).toHaveBeenCalledTimes(reads)
      expect(editor.serverVersion.value).toBeNull()
      expect(editor.ready.value).toBe(false)
      expect(editor.requiresReload.value).toBe(true)
      await editor.load()
      expect(mocks.repo.adminDetail).toHaveBeenCalledTimes(reads)
      expect(editor.error.value).toBe(message)
      editor.merge()
      expect(editor.form.description).toBe('必须保留的旧上下文笔记')
      expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('必须保留的旧上下文笔记')
    },
  )
  it.each(['submission', 'unknown', undefined])('非作品版本的409不制造合并入口：%s', async (conflictKind) => {
    const editor = await setup(1)
    editor.form.prompt = '仍待保存的完整提示词'
    mocks.repo.save.mockRejectedValueOnce(
      Object.assign(new Error('提交需要重新核查'), { statusCode: 409, conflictKind }),
    )
    await editor.save('draft')
    expect(mocks.repo.adminDetail).toHaveBeenCalledTimes(1)
    expect(editor.serverVersion.value).toBeNull()
    expect(editor.form.prompt).toBe('仍待保存的完整提示词')
    expect(editor.error.value).toContain('重新核查')
  })
  it('同页后退关闭有未保存输入的编辑器只确认一次，取消返回false且保留副本', async () => {
    const editor = await setup(1)
    editor.form.description = '后退时需要保留的输入'
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    expect(mocks.update?.({ query: {} }, { query: { edit: '1' } })).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(editor.form.description).toBe('后退时需要保留的输入')
    expect(sessionStorage.getItem('blog-prompt-editor:owner:prompt-library:1')).toContain('后退时需要保留的输入')
    confirm.mockReturnValue(true)
    expect(mocks.update?.({ query: {} }, { query: { edit: '1' } })).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
  it('保存后视图与分页变动不离开编辑会话，干净编辑器关闭不确认', async () => {
    const editor = await setup(1)
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    expect(mocks.update?.({ query: {} }, { query: { edit: '1' } })).toBe(true)
    editor.form.prompt = '继续写的提示词'
    expect(mocks.update?.({ query: { edit: '1', view: 'drafts', page: '2' } }, { query: { edit: '1' } })).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
  })
  it('new归属已确认编号不重问，但切换另一作品或离开页面仍保护未保存文字', async () => {
    const editor = await setup(null)
    Object.assign(editor.form, promptForm(item()))
    mocks.repo.save.mockResolvedValueOnce(item({ id: 12 }))
    await editor.save('draft')
    editor.form.description = '归属变动时继续保留的文字'
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    expect(mocks.update?.({ query: { edit: '12', view: 'drafts' } }, { query: { edit: 'new' } })).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(mocks.update?.({ query: { edit: '13' } }, { query: { edit: '12' } })).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    confirm.mockClear()
    expect(mocks.leave?.()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
  })
  it('身份丢失时保留无法写入副本的内存输入，关闭确认仍说明持久化失败', async () => {
    const editor = await setup(1)
    const storage = sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: storage.getItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    editor.form.prompt = '会话过期也不能丢失的输入'
    mocks.auth.currentUser.value = null
    await flushPromises()
    expect(editor.ownershipLost.value).toBe(true)
    expect(editor.ready.value).toBe(false)
    expect(editor.form.prompt).toBe('会话过期也不能丢失的输入')
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    expect(editor.canClose()).toBe(false)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('恢复副本未能保存'))
    mocks.auth.currentUser.value = { id: 'owner' }
    await flushPromises()
    expect(editor.ownershipLost.value).toBe(false)
    await editor.load()
    expect(editor.ready.value).toBe(true)
    expect(editor.form.prompt).toBe('会话过期也不能丢失的输入')
  })
  it('访问令牌失效但原user对象尚未清理时仍锁定身份与保存', async () => {
    const editor = await setup(1)
    editor.form.prompt = '令牌失效也不能暴露的输入'
    mocks.auth.isLoggedIn.value = false
    await flushPromises()
    expect(mocks.auth.currentUser.value?.id).toBe('owner')
    expect(editor.ownershipLost.value).toBe(true)
    expect(editor.ready.value).toBe(false)
    await editor.save('draft')
    expect(mocks.repo.save).not.toHaveBeenCalled()
    mocks.auth.isLoggedIn.value = true
    await editor.load()
    expect(editor.ownershipLost.value).toBe(false)
    expect(editor.ready.value).toBe(true)
    expect(editor.form.prompt).toBe('令牌失效也不能暴露的输入')
  })
})
