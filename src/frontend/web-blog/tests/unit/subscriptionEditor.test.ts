/** @file subscriptionEditor.test.ts @description 订阅精确金额、未知创建恢复、冲突合并和内容库隔离 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { appendPriceHistory } from '@tixxin/subscription-domain'
import { useAdminSubscriptionEditor } from '../../app/composables/useAdminSubscriptionEditor'
import { subscriptionBody, subscriptionForm } from '../../app/features/subscription/editor'
import type { ManagedSubscription } from '../../app/features/subscription/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useSubscriptionRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
function item(patch: Partial<ManagedSubscription> = {}): ManagedSubscription {
  const body = {
    ...subscriptionBody(subscriptionForm()),
    name: '创作工具',
    amount: 2000,
    currency: 'USD' as const,
    ...patch,
  }
  return {
    ...body,
    id: 1,
    revision: 0,
    iconUrl: null,
    faviconUrl: null,
    publishedAt: null,
    createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: '2026-10-13T00:00:00.000Z',
    priceHistory: appendPriceHistory([], body, { id: crypto.randomUUID(), recordedAt: '2026-10-13T00:00:00.000Z' }),
    ...patch,
  }
}
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(item())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(id: number | null, context = 'subscriptions-library') {
  let editor!: ReturnType<typeof useAdminSubscriptionEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = context
          editor = useAdminSubscriptionEditor(id, { inline: true })
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return editor
}
describe('订阅管理编辑器', () => {
  it('精确输入转最小单位，普通正文不带历史或派生图标字段', async () => {
    const editor = await setup(1)
    editor.change({ amountInput: '25.01', notes: '私人备注', priceChangeReason: '套餐调整' })
    mocks.repo.save.mockResolvedValue(item({ amount: 2501, notes: '私人备注', revision: 1 }))
    await editor.save('published')
    const body = mocks.repo.save.mock.calls[0]![0]
    expect(body).toMatchObject({ amount: 2501, notes: '私人备注', priceChangeReason: '套餐调整', status: 'published' })
    expect(body).not.toHaveProperty('amountInput')
    expect(body).not.toHaveProperty('priceHistory')
    expect(body).not.toHaveProperty('faviconDomain')
  })
  it('非法金额不发送请求并保留原输入', async () => {
    const editor = await setup(null)
    editor.change({ name: '云主机', amountInput: '1e2' })
    await editor.save('draft')
    expect(mocks.repo.save).not.toHaveBeenCalled()
    expect(editor.error.value).toBeTruthy()
    expect(editor.form.amountInput).toBe('1e2')
  })
  it('未知创建先查询原请求，后续新增输入保持待保存', async () => {
    const editor = await setup(null)
    editor.change({ name: '创作工具', currency: 'USD', amountInput: '20.00' })
    mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
    await editor.save('published')
    editor.change({ notes: '中断后继续输入' })
    mocks.repo.submission.mockResolvedValue({ state: 'saved', item: item({ status: 'published' }) })
    await editor.save('published')
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
    expect(editor.form.notes).toBe('中断后继续输入')
    expect(editor.id.value).toBe(1)
    expect(editor.dirty.value).toBe(true)
  })
  it('并发冲突保留输入，手动合并后使用最新版本号', async () => {
    const editor = await setup(1)
    editor.change({ amountInput: '22.00' })
    mocks.repo.save.mockRejectedValueOnce(
      Object.assign(new Error('记录已变化'), { statusCode: 409, conflictKind: 'revision' }),
    )
    mocks.repo.adminDetail.mockResolvedValue(item({ amount: 2100, revision: 2 }))
    await editor.save('published')
    expect(editor.form.amountInput).toBe('22.00')
    expect(editor.serverVersion.value?.revision).toBe(2)
    editor.mergeConflict()
    mocks.repo.save.mockResolvedValue(item({ amount: 2200, revision: 3 }))
    await editor.save('published')
    expect(mocks.repo.save.mock.calls[1]![3]).toBe(2)
  })
  it('库恢复后旧输入只读保留，不混入同编号的新记录', async () => {
    const original = await setup(1, 'before')
    original.change({ notes: '旧库独有备注', amountInput: '99.99' })
    await flushPromises()
    wrappers.pop()!.unmount()
    const restored = await setup(1, 'after')
    expect(restored.form.amountInput).toBe('20.00')
    expect(restored.previousRecoveries.value[0]?.value.form.notes).toBe('旧库独有备注')
    expect(restored.recovery.value).toBeNull()
  })
  it('已删除的不确定创建不会重建', async () => {
    const editor = await setup(null)
    editor.change({ name: '待核查订阅' })
    mocks.repo.save.mockRejectedValueOnce(new Error('连接中断'))
    await editor.save('draft')
    mocks.repo.submission.mockResolvedValue({ state: 'deleted', id: 1 })
    await editor.save('draft')
    expect(mocks.repo.save).toHaveBeenCalledTimes(1)
    expect(editor.error.value).toContain('已删除')
  })
})

describe('订阅恢复副本保护', () => {
  it('已有新输入时恢复旧副本需要确认，移除旧副本仍持久保存新输入', async () => {
    const original = await setup(1)
    original.change({ notes: '旧副本内容' })
    await flushPromises()
    wrappers.pop()!.unmount()
    const editor = await setup(1)
    expect(editor.recovery.value?.form.notes).toBe('旧副本内容')
    editor.change({ notes: '当前新输入' })
    await flushPromises()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    editor.restoreRecovery()
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('替换'))
    expect(editor.form.notes).toBe('当前新输入')
    editor.discardRecovery()
    expect(editor.recovery.value).toBeNull()
    expect(sessionStorage.getItem('blog-subscription-editor:owner:1:subscriptions-library')).toContain('当前新输入')
    vi.unstubAllGlobals()
  })
  it('恢复与合并在重新读取期间不生效，不让迟到读取覆盖后来恢复的输入', async () => {
    const editor = await setup(1)
    editor.change({ notes: '恢复中的输入' })
    editor.persistLocal()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    let finish!: (value: ManagedSubscription) => void
    mocks.repo.adminDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const loading = editor.reload()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const formBefore = JSON.stringify(editor.form)
    editor.restoreRecovery()
    editor.mergeConflict()
    expect(JSON.stringify(editor.form)).toBe(formBefore)
    finish(item({ notes: '服务器最新输入', revision: 2 }))
    await loading
    expect(editor.form.notes).toBe('服务器最新输入')
    expect(editor.recovery.value?.form.notes).toBe('恢复中的输入')
    vi.unstubAllGlobals()
  })
  it('恢复副本存储失败时离开提示明确可能丢失，不误称已保存', async () => {
    const editor = await setup(1)
    editor.change({ notes: '不能写入存储的输入' })
    const actualStorage = sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => actualStorage.getItem(key),
      removeItem: (key: string) => actualStorage.removeItem(key),
      setItem: () => {
        throw new Error('quota')
      },
    })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    try {
      expect(editor.persistLocal()).toBe(false)
      expect(editor.canLeave()).toBe(false)
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('未能保存'))
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('可能丢失'))
      expect(editor.form.notes).toBe('不能写入存储的输入')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

it('服务器内容库冲突不会读取或合并同编号新记录，私密视图锁定直到重新打开', async () => {
  const editor = await setup(1)
  editor.change({ notes: '旧内容库的输入' })
  mocks.repo.save.mockRejectedValueOnce(
    Object.assign(new Error('站点数据上下文已变化，请刷新后重试'), { statusCode: 409, conflictKind: 'context' }),
  )
  mocks.repo.adminDetail.mockClear()
  await editor.save('draft')
  expect(editor.requiresReload.value).toBe(true)
  expect(editor.ownershipLost.value).toBe(true)
  expect(editor.serverVersion.value).toBeNull()
  expect(mocks.repo.adminDetail).not.toHaveBeenCalled()
  await editor.load()
  expect(mocks.repo.adminDetail).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('blog-subscription-editor:owner:1:subscriptions-library')).toContain('旧内容库的输入')
})
