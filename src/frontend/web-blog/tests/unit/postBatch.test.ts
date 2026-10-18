/** @file postBatch.test.ts @description 文章批处理预览、未知执行结果、同票据续办和公开缓存失效的组合函数回归。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostBatch } from '../../app/composables/usePostBatch'
import type { PostBatchPreview, PostBatchResult } from '../../app/features/post/batchTypes'

const mocks = vi.hoisted(() => ({ api: vi.fn(), invalidate: vi.fn(), clearData: vi.fn(), changed: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('clearNuxtData', () => mocks.clearData)
vi.mock('../../app/utils/invalidatePublicReads', () => ({ invalidatePublicReads: mocks.invalidate }))

const wrappers: { unmount(): void }[] = []
const selection = [{ id: 8, revision: 3 }]
const preview = (): PostBatchPreview => ({
  ticket: '44cda222-1d97-45b6-98d9-ebafbdcb724d',
  action: 'trash',
  allowedCount: 1,
  expiresIn: 600,
  items: [
    {
      ...selection[0]!,
      title: '秋日散步',
      allowed: true,
      reason: '',
      impact: { comments: 2, commentLikes: 1, revisions: 3, addresses: 1, mediaReferences: 2, likes: 5, views: 30 },
    },
  ],
})
const result = (changes: Partial<PostBatchResult> = {}): PostBatchResult => ({
  preview: preview(),
  ticket: preview().ticket,
  action: 'trash',
  results: [{ id: 8, success: true, message: '已移入回收站' }],
  successCount: 1,
  failedCount: 0,
  pendingCount: 0,
  completed: true,
  ...changes,
})
const recent = [
  { ticket: preview().ticket, action: 'trash', createdAt: '2026-10-18T10:00:00Z', count: 1, completed: true },
]
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.changed.mockResolvedValue(undefined)
  mocks.api.mockImplementation(async (path: string) => {
    if (path === '/admin/posts/batch/preview') return preview()
    if (path === '/admin/posts/batch') return recent
    return result()
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let batch!: ReturnType<typeof usePostBatch>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          batch = usePostBatch(mocks.changed)
          return () => h('div')
        },
      }),
    ),
  )
  return batch
}

it('空选择不请求；预览期间阻止重复操作，完成后保留服务端范围且尚未执行修改', async () => {
  const batch = await setup()
  await batch.review('trash', [])
  await batch.execute()
  await batch.queryResult()
  expect(mocks.api).not.toHaveBeenCalled()
  expect(batch.open.value).toBe(false)
  const request = deferred<PostBatchPreview>()
  mocks.api.mockReturnValueOnce(request.promise)
  const reviewing = batch.review('trash', selection)
  expect(batch.pending.value).toBe(true)
  expect(batch.open.value).toBe(true)
  await batch.review('archive', selection)
  await batch.execute()
  await batch.inspect('another-ticket')
  await batch.queryResult()
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith('/admin/posts/batch/preview', {
    method: 'POST',
    body: { action: 'trash', items: selection },
  })
  request.resolve(preview())
  await reviewing
  expect(batch.preview.value).toEqual(preview())
  expect(batch.result.value).toBeNull()
  expect(batch.attempted.value).toBe(false)
  expect(batch.pending.value).toBe(false)
  expect(mocks.invalidate).not.toHaveBeenCalled()
  expect(mocks.changed).not.toHaveBeenCalled()
})

it.each([
  [{ data: { message: '所选文章版本已变化' } }, '所选文章版本已变化'],
  // 改为分批执行后，兜底文案说明本批未执行、已完成批次不会重复提交
  [{ data: { message: ['错误详情'] } }, '本批预览失败，尚未执行；可重试本批，已完成批次不会重复提交。'],
])('新预览失败清除旧票据、结果和确认文字，并显示可读错误 %j', async (cause, expected) => {
  const batch = await setup()
  batch.preview.value = preview()
  batch.result.value = result()
  batch.attempted.value = true
  batch.acknowledgement.value = '旧确认文字'
  mocks.api.mockRejectedValueOnce(cause)
  await batch.review('delete', selection)
  expect(batch.preview.value).toBeNull()
  expect(batch.result.value).toBeNull()
  expect(batch.acknowledgement.value).toBe('')
  expect(batch.attempted.value).toBe(false)
  expect(batch.error.value).toBe(expected)
  expect(batch.pending.value).toBe(false)
})

it('执行结果未知保留票据和确认文字，显式续办使用同票据且完成后禁止重复执行', async () => {
  const batch = await setup()
  await batch.review('trash', selection)
  batch.acknowledgement.value = '确认移入回收站'
  mocks.api.mockRejectedValueOnce(new Error('响应丢失'))
  await batch.execute()
  expect(batch.preview.value).toEqual(preview())
  expect(batch.acknowledgement.value).toBe('确认移入回收站')
  expect(batch.result.value).toBeNull()
  expect(batch.attempted.value).toBe(true)
  expect(batch.error.value).toBe('未收到完整执行结果。请查询结果，或使用同一凭证继续执行；已处理条目不会重复修改。')
  expect(mocks.changed).not.toHaveBeenCalled()
  await batch.execute()
  const writes = mocks.api.mock.calls.filter(([path]) => path === '/admin/posts/batch/execute')
  expect(writes).toHaveLength(2)
  for (const [, options] of writes) {
    expect(options).toEqual({
      method: 'POST',
      body: { ticket: preview().ticket, acknowledgement: '确认移入回收站' },
      timeout: 60000,
    })
  }
  expect(batch.result.value).toEqual(result())
  expect(batch.error.value).toBe('')
  expect(batch.recent.value).toEqual(recent)
  expect(mocks.changed).toHaveBeenCalledOnce()
  const calls = mocks.api.mock.calls.length
  await batch.execute()
  expect(mocks.api).toHaveBeenCalledTimes(calls)
})

it('查询未知结果只读原票据，失败不丢票据，恢复后按结果刷新公开缓存与列表', async () => {
  const batch = await setup()
  await batch.review('trash', selection)
  mocks.api.mockRejectedValueOnce(new Error('执行响应丢失')).mockRejectedValueOnce(new Error('查询断线'))
  await batch.execute()
  await batch.queryResult()
  expect(batch.error.value).toBe('结果查询失败，凭证仍保留，可重试')
  expect(batch.preview.value?.ticket).toBe(preview().ticket)
  expect(batch.attempted.value).toBe(true)
  await batch.queryResult()
  expect(mocks.api.mock.calls.filter(([path]) => path === '/admin/posts/batch/execute')).toHaveLength(1)
  expect(mocks.api.mock.calls.filter(([path]) => path === `/admin/posts/batch/${preview().ticket}`)).toHaveLength(2)
  expect(batch.result.value?.completed).toBe(true)
  expect(batch.error.value).toBe('')
  expect(mocks.invalidate).toHaveBeenCalledWith(expect.anything(), ['posts', 'post-summary', 'archive', 'moment-feed'])
  const matches = mocks.clearData.mock.calls[0]![0] as (key: string) => boolean
  expect(['article-8', 'post-list', 'post-summary'].map(matches)).toEqual([true, true, true])
  expect(['gallery-list', 'subscription-list', 'article'].map(matches)).toEqual([false, false, false])
  expect(mocks.changed).toHaveBeenCalledOnce()
})

it('执行在途时锁住所有变更入口，历史列表失败不会丢失已确认的部分结果', async () => {
  const batch = await setup()
  const twoItems = {
    ...preview(),
    allowedCount: 2,
    items: [...preview().items, { ...preview().items[0]!, id: 9, title: '山间小记' }],
  }
  mocks.api.mockResolvedValueOnce(twoItems)
  await batch.review('trash', [...selection, { id: 9, revision: 3 }])
  const request = deferred<PostBatchResult>()
  mocks.api.mockReturnValueOnce(request.promise).mockRejectedValueOnce(new Error('历史列表不可用'))
  const executing = batch.execute()
  const calls = mocks.api.mock.calls.length
  await batch.execute()
  await batch.queryResult()
  await batch.inspect('another-ticket')
  await batch.review('archive', selection)
  expect(mocks.api).toHaveBeenCalledTimes(calls)
  const partial = result({ preview: twoItems, completed: false, pendingCount: 1 })
  request.resolve(partial)
  await executing
  expect(batch.result.value).toEqual(partial)
  expect(batch.error.value).toBe('')
  expect(batch.recentError.value).toBe('最近批量操作加载失败')
  expect(batch.pending.value).toBe(false)
  expect(mocks.invalidate).toHaveBeenCalledOnce()
  expect(mocks.changed).toHaveBeenCalledOnce()
  mocks.api.mockResolvedValueOnce(
    result({
      preview: twoItems,
      successCount: 2,
      results: [...partial.results, { id: 9, success: true, message: '已移入回收站' }],
    }),
  )
  await batch.execute()
  expect(batch.result.value?.completed).toBe(true)
  expect(batch.recentError.value).toBe('')
})

it('查看尚未处理的历史票据重置确认输入，不失效缓存或刷新内容', async () => {
  const batch = await setup()
  batch.acknowledgement.value = '旧确认文字'
  batch.result.value = result()
  const untouched = result({ completed: false, successCount: 0, pendingCount: 1, results: [] })
  mocks.api.mockResolvedValueOnce(untouched)
  await batch.inspect(preview().ticket)
  expect(mocks.api).toHaveBeenNthCalledWith(1, `/admin/posts/batch/${preview().ticket}`)
  expect(batch.open.value).toBe(true)
  expect(batch.attempted.value).toBe(true)
  expect(batch.acknowledgement.value).toBe('')
  expect(batch.preview.value).toEqual(preview())
  expect(batch.result.value).toEqual(untouched)
  expect(mocks.invalidate).not.toHaveBeenCalled()
  expect(mocks.clearData).not.toHaveBeenCalled()
  expect(mocks.changed).not.toHaveBeenCalled()
})

it('历史票据读取失败清除旧结果，最近列表失败保留已确认条目并支持单独重试', async () => {
  const batch = await setup()
  await batch.loadRecent()
  batch.preview.value = preview()
  batch.result.value = result()
  mocks.api.mockRejectedValueOnce({ data: { message: '该票据已过期' } }).mockRejectedValueOnce(new Error('断线'))
  await batch.inspect('expired-ticket')
  expect(batch.preview.value).toBeNull()
  expect(batch.result.value).toBeNull()
  expect(batch.error.value).toBe('该票据已过期')
  expect(batch.pending.value).toBe(false)
  await batch.loadRecent()
  expect(batch.recent.value).toEqual(recent)
  expect(batch.recentError.value).toBe('最近批量操作加载失败')
  await batch.loadRecent()
  expect(batch.recentError.value).toBe('')
  expect(batch.error.value).toBe('该票据已过期')
})
