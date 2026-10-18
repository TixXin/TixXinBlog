/** @file postBatchQueue.test.ts @description 文章分批队列、原票据续办、删除确认和请求归属回归 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostBatch } from '../../app/composables/usePostBatch'
import PostBatch from '../../app/components/admin/PostBatch.vue'
import {
  POST_SELECTION_LIMIT,
  type PostBatchAction,
  type PostBatchPreview,
  type PostBatchResult,
  type PostSelection,
} from '../../app/features/post/batchTypes'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<{ id: string } | null> },
  api: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
  changed: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useAdminApi', () => () => mocks.api)
vi.mock('../../app/utils/invalidatePublicReads', () => ({ invalidatePublicReads: vi.fn() }))
const wrappers: { unmount(): void }[] = []
const tickets = new Map<string, PostBatchPreview>()
function selections(count: number): PostSelection[] {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1, revision: index + 2 }))
}
function preview(items: PostSelection[], action: PostBatchAction = 'archive', ticket = 'ticket-1'): PostBatchPreview {
  return {
    ticket,
    action,
    allowedCount: items.length,
    expiresIn: 300,
    items: items.map((item) => ({
      ...item,
      title: `文章 ${item.id}`,
      allowed: true,
      reason: '',
      impact: { comments: 0, commentLikes: 0, revisions: 1, addresses: 1, mediaReferences: 0, likes: 0, views: 0 },
    })),
  }
}
function result(plan: PostBatchPreview, completed = true): PostBatchResult {
  const results = plan.items
    .slice(0, completed ? undefined : 1)
    .map(({ id }) => ({ id, success: true, message: '已完成' }))
  return {
    preview: plan,
    ticket: plan.ticket,
    action: plan.action,
    results,
    successCount: results.length,
    failedCount: 0,
    pendingCount: plan.items.length - results.length,
    completed,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  tickets.clear()
  mocks.auth = { currentUser: ref({ id: 'owner-a' }) }
  mocks.preview
    .mockReset()
    .mockImplementation(({ items, action }: { items: PostSelection[]; action: PostBatchAction }) => {
      const value = preview(items, action, `ticket-${tickets.size + 1}`)
      tickets.set(value.ticket, value)
      return value
    })
  mocks.execute.mockReset().mockImplementation(({ ticket }: { ticket: string }) => result(tickets.get(ticket)!))
  mocks.query.mockReset().mockImplementation((ticket: string) => result(tickets.get(ticket)!))
  mocks.changed.mockReset().mockResolvedValue(undefined)
  mocks.api.mockReset().mockImplementation((path: string, options?: { body?: unknown }) => {
    if (path === '/admin/posts/batch/preview') return mocks.preview(options?.body)
    if (path === '/admin/posts/batch/execute') return mocks.execute(options?.body)
    if (path === '/admin/posts/batch') return []
    return mocks.query(path.split('/').at(-1))
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let batch!: ReturnType<typeof usePostBatch>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        batch = usePostBatch(mocks.changed)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { batch, context, wrapper }
}
it('跨页选择冻结版本并按 50 篇分批，每批单独预览和确认', async () => {
  const { batch } = await setup()
  const selected = selections(120)
  await batch.review('archive', selected)
  selected[50]!.revision = 999
  expect(batch.batchCount.value).toBe(3)
  expect(batch.batchIndex.value).toBe(1)
  expect(batch.totalCount.value).toBe(120)
  expect(mocks.preview.mock.calls[0]![0].items).toHaveLength(50)
  await batch.nextBatch()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  await batch.execute()
  expect(mocks.changed).toHaveBeenCalledWith(expect.objectContaining({ completed: true, successCount: 50 }))
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  expect(batch.canNext.value).toBe(true)
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(2)
  expect(mocks.preview.mock.calls[1]![0].items[0]).toEqual({ id: 51, revision: 52 })
  expect(mocks.execute).toHaveBeenCalledTimes(1)
  await batch.execute()
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(3)
  expect(batch.preview.value?.items).toHaveLength(20)
  expect(batch.hasNext.value).toBe(false)
  expect(batch.canNext.value).toBe(false)
  await batch.execute()
  await batch.nextBatch()
  expect(mocks.execute).toHaveBeenCalledTimes(3)
  expect(mocks.preview).toHaveBeenCalledTimes(3)
})
it('超过 500 篇直接拒绝，恰好上限拆为 10 批', async () => {
  const { batch } = await setup()
  await batch.review('trash', selections(POST_SELECTION_LIMIT + 1))
  expect(mocks.api).not.toHaveBeenCalled()
  expect(batch.error.value).toContain('最多选择 500 篇')
  await batch.review('trash', selections(POST_SELECTION_LIMIT))
  expect(batch.batchCount.value).toBe(10)
})
it('结果未知或部分完成时保留原票据，查询后仍只幂等续办当前批', async () => {
  const { batch } = await setup()
  await batch.review('archive', selections(51))
  mocks.execute.mockRejectedValueOnce(new Error('断线'))
  await batch.execute()
  expect(batch.attempted.value).toBe(true)
  expect(batch.canNext.value).toBe(false)
  await batch.nextBatch()
  await batch.review('trash', selections(2))
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  expect(batch.preview.value?.ticket).toBe('ticket-1')
  expect(batch.error.value).toContain('先查询结果')
  mocks.query.mockRejectedValueOnce(new Error('读取失败'))
  await batch.queryResult()
  expect(batch.error.value).toContain('凭证仍保留')
  mocks.query.mockResolvedValueOnce(result(tickets.get('ticket-1')!, false))
  await batch.queryResult()
  expect(batch.result.value?.pendingCount).toBe(49)
  expect(batch.canNext.value).toBe(false)
  await batch.execute()
  expect(mocks.execute.mock.calls.map(([body]) => body.ticket)).toEqual(['ticket-1', 'ticket-1'])
  expect(batch.canNext.value).toBe(true)
  await batch.nextBatch()
  expect(batch.preview.value?.ticket).toBe('ticket-2')
})
it('下一批预览失败可重试同一批，不重复执行已完成批次', async () => {
  const { batch } = await setup()
  await batch.review('archive', selections(51))
  await batch.execute()
  mocks.preview.mockRejectedValueOnce(new Error('读取失败'))
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(2)
  expect(batch.preview.value).toBeNull()
  expect(batch.canNext.value).toBe(true)
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(2)
  expect(mocks.preview.mock.calls.slice(1).map(([body]) => body.items)).toEqual([
    [{ id: 51, revision: 52 }],
    [{ id: 51, revision: 52 }],
  ])
  expect(mocks.execute).toHaveBeenCalledTimes(1)
})
it('关闭后重开同一票据查询失败仍保留队列，不能覆盖未确认结果的批次', async () => {
  const { batch } = await setup()
  await batch.review('archive', selections(51))
  mocks.execute.mockRejectedValueOnce(new Error('执行结果未知'))
  await batch.execute()
  batch.open.value = false
  mocks.query.mockRejectedValueOnce(new Error('结果查询失败'))
  await batch.inspect('ticket-1')
  expect(batch.open.value).toBe(true)
  expect(batch.preview.value?.ticket).toBe('ticket-1')
  expect(batch.attempted.value).toBe(true)
  expect(batch.batchCount.value).toBe(2)
  expect(batch.totalCount.value).toBe(51)
  expect(batch.error.value).toContain('凭证仍保留')
  await batch.review('trash', selections(2))
  await batch.nextBatch()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  expect(batch.preview.value?.ticket).toBe('ticket-1')
  expect(batch.error.value).toContain('先查询结果')
  expect(batch.canNext.value).toBe(false)
  await batch.queryResult()
  expect(batch.canNext.value).toBe(true)
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(2)
  expect(batch.preview.value?.ticket).toBe('ticket-2')
})
it('整批无可执行条目时可跳过，未发生写入', async () => {
  const { batch } = await setup()
  const blocked = preview(selections(50))
  blocked.allowedCount = 0
  blocked.items.forEach((item) => {
    item.allowed = false
    item.reason = '当前状态不可执行'
  })
  mocks.preview.mockResolvedValueOnce(blocked)
  await batch.review('archive', selections(51))
  await batch.execute()
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(batch.canNext.value).toBe(true)
  await batch.nextBatch()
  expect(batch.batchIndex.value).toBe(2)
})
it('每个永久删除批次重新输入确认文字', async () => {
  const { batch } = await setup()
  await batch.review('delete', selections(51))
  await batch.execute()
  expect(mocks.execute).not.toHaveBeenCalled()
  batch.acknowledgement.value = '永久删除'
  await batch.execute()
  expect(mocks.execute).toHaveBeenCalledWith({ ticket: 'ticket-1', acknowledgement: '永久删除' })
  await batch.nextBatch()
  expect(batch.acknowledgement.value).toBe('')
  await batch.execute()
  expect(mocks.execute).toHaveBeenCalledTimes(1)
  batch.acknowledgement.value = '永久删除'
  await batch.execute()
  expect(mocks.execute).toHaveBeenCalledTimes(2)
})
it('查看历史记录清空分批队列，仍通过原票据续办', async () => {
  const { batch } = await setup()
  await batch.review('archive', selections(51))
  const history = preview(selections(2), 'trash', 'history-ticket')
  tickets.set(history.ticket, history)
  mocks.query.mockResolvedValueOnce(result(history, false))
  await batch.inspect(history.ticket)
  expect(batch.batchCount.value).toBe(1)
  expect(batch.totalCount.value).toBe(2)
  expect(batch.hasNext.value).toBe(false)
  await batch.execute()
  expect(mocks.execute).toHaveBeenCalledWith({ ticket: history.ticket, acknowledgement: '' })
})
it('过期票据先查询确认部分结果，再允许重新预览剩余选择', async () => {
  const { batch } = await setup()
  await batch.review('archive', selections(51))
  mocks.execute.mockRejectedValueOnce(new Error('断线'))
  await batch.execute()
  const expired = { ...tickets.get('ticket-1')!, expiresIn: 0 }
  mocks.query.mockResolvedValueOnce(result(expired, false))
  await batch.queryResult()
  expect(batch.canNext.value).toBe(false)
  await batch.review('archive', [{ id: 2, revision: 3 }])
  expect(batch.preview.value?.ticket).toBe('ticket-2')
  expect(batch.totalCount.value).toBe(1)
})
it.each(['actor', 'context', 'unmount'])('%s 变化撤销迟到预览并禁止旧队列继续操作', async (change) => {
  const { batch, context, wrapper } = await setup()
  const response = deferred<PostBatchPreview>()
  mocks.preview.mockReturnValueOnce(response.promise)
  const request = batch.review('archive', selections(51))
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'owner-b' }
  else if (change === 'context') context.value = 'library-b'
  else wrapper.unmount()
  response.resolve(preview(selections(50)))
  await request
  expect(batch.preview.value).toBeNull()
  await batch.execute()
  await batch.nextBatch()
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
})
it('内容代次改变后丢弃迟到执行结果，避免移除新库选择', async () => {
  const { batch, context } = await setup()
  await batch.review('archive', selections(51))
  const response = deferred<PostBatchResult>()
  mocks.execute.mockReturnValueOnce(response.promise)
  const request = batch.execute()
  context.value = 'library-b'
  response.resolve(result(tickets.get('ticket-1')!))
  await request
  expect(batch.result.value).toBeNull()
  expect(batch.open.value).toBe(false)
  expect(batch.totalCount.value).toBe(0)
  expect(mocks.changed).not.toHaveBeenCalled()
})
it('面板展示进度、剩余批次未执行说明并提供下一批与键盘取消', async () => {
  const plan = preview(selections(2))
  const wrapper = mount(PostBatch, {
    props: {
      open: true,
      acknowledgement: '',
      preview: plan,
      result: result(plan),
      pending: false,
      error: '',
      attempted: true,
      batchIndex: 2,
      batchCount: 3,
      totalCount: 120,
      canNext: true,
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.text()).toContain('当前第 2 批')
  expect(wrapper.text()).toContain('关闭后剩余批次不会执行')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '预览下一批')!
    .trigger('click')
  expect(wrapper.emitted('next')).toEqual([[]])
  await wrapper.get('dialog').trigger('cancel')
  expect(wrapper.emitted('update:open')).toEqual([[false]])
})
it('失败预览可重试，删除按钮受输入确认和 pending 约束', async () => {
  const wrapper = mount(PostBatch, {
    props: {
      open: false,
      acknowledgement: '',
      preview: null,
      result: null,
      pending: false,
      error: '预览失败',
      attempted: false,
      canNext: true,
    },
  })
  wrappers.push(wrapper)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '重试本批预览')!
    .trigger('click')
  expect(wrapper.emitted('next')).toEqual([[]])
  await wrapper.setProps({ preview: preview(selections(1), 'delete'), canNext: false })
  const execute = wrapper.findAll('button').find((button) => button.text() === '确认执行')!
  expect(execute.attributes('disabled')).toBeDefined()
  await wrapper.setProps({ acknowledgement: '永久删除' })
  expect(execute.attributes('disabled')).toBeUndefined()
  await wrapper.setProps({ preview: { ...preview(selections(1), 'delete'), expiresIn: 0 } })
  expect(execute.attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('请先查询执行结果，核对剩余文章后关闭面板并重新选择、预览')
  await wrapper.setProps({ preview: preview(selections(1), 'delete') })
  await wrapper.setProps({ pending: true })
  expect(execute.attributes('disabled')).toBeDefined()
})
