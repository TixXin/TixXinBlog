/** @file promptDrafts.test.ts @description 草稿缓存同步清理、请求所有权和筛选失败恢复回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePromptDrafts } from '../../app/composables/usePromptDrafts'
import type { ManagedPrompt, PromptPage, PromptQuery } from '../../app/features/prompt/types'

const mocks = vi.hoisted(() => ({
  repo: { adminList: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null> },
}))
mockNuxtImport('usePromptRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

function page(id = 1): PromptPage<ManagedPrompt> {
  return {
    items: [
      {
        id,
        title: `光影草稿 ${id}`,
        description: '',
        prompt: 'A quiet sunlit room',
        negativePrompt: '',
        model: 'ImageGen',
        tags: [],
        imageUrl: '/draft.webp',
        imageAlt: '',
        width: 1200,
        height: 800,
        sourceUrl: '',
        publishedAt: null,
        mediaId: 'draft-image',
        externalImageUrl: null,
        status: 'draft',
        revision: 0,
        createdAt: '2026-10-03',
        updatedAt: '2026-10-03',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 12,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'owner' }) }
  mocks.repo.adminList.mockReset().mockResolvedValue(page())
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(initiallyEnabled = true) {
  let state!: ReturnType<typeof usePromptDrafts>
  let context!: Ref<string>
  const query = ref<PromptQuery>({ page: 1, pageSize: 12 }),
    enabled = ref(initiallyEnabled)
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'original-library'
        state = usePromptDrafts(
          computed(() => query.value),
          computed(() => enabled.value),
        )
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { state, query, enabled, context, wrapper }
}

describe('私有图片提示词草稿', () => {
  it.each(['account', 'library'] as const)('%s 变化立即清空旧草稿与错误，失败也不恢复旧所有者内容', async (change) => {
    const { state, context } = await setup()
    expect(state.drafts.value).toEqual(page())
    mocks.repo.adminList.mockRejectedValueOnce(new Error('旧范围读取失败'))
    await state.refresh()
    expect(state.error.value).toBe('旧范围读取失败')
    const next = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(next.promise)
    if (change === 'account') mocks.auth.currentUser.value = { id: 'next-owner' }
    else context.value = 'restored-library'
    // 不等待 nextTick：权限边界变化必须在当前调用栈就完成清理。
    expect(state.drafts.value).toBeNull()
    expect(state.error.value).toBe('')
    expect(state.stale.value).toBe(false)
    expect(state.pending.value).toBe(true)
    next.reject(new Error('新范围暂时不可用'))
    await flushPromises()
    expect(state.drafts.value).toBeNull()
    expect(state.error.value).toBe('新范围暂时不可用')
  })

  it('同一身份切筛选保留旧成功页并标记过期，失败后重试接纳当前结果', async () => {
    const { state, query } = await setup()
    const next = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(next.promise)
    query.value = { ...query.value, model: 'Flux' }
    expect(state.drafts.value).toEqual(page())
    expect(state.stale.value).toBe(true)
    expect(state.pending.value).toBe(true)
    next.reject(new Error('筛选暂时不可用'))
    await flushPromises()
    expect(state.drafts.value).toEqual(page())
    expect(state.pending.value).toBe(false)
    expect(state.stale.value).toBe(true)
    mocks.repo.adminList.mockResolvedValueOnce(page(2))
    await state.refresh()
    expect(mocks.repo.adminList).toHaveBeenLastCalledWith({ page: 1, pageSize: 12, model: 'Flux', status: 'draft' })
    expect(state.drafts.value).toEqual(page(2))
    expect(state.error.value).toBe('')
    expect(state.stale.value).toBe(false)
  })

  it.each(['account', 'library'] as const)('%s 切换后旧响应不能重填已清空的草稿', async (change) => {
    const { state, context } = await setup()
    const old = deferred<PromptPage<ManagedPrompt>>()
    const next = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const reading = state.refresh()
    if (change === 'account') mocks.auth.currentUser.value = { id: 'next-owner' }
    else context.value = 'restored-library'
    expect(state.drafts.value).toBeNull()
    old.resolve(page(8))
    await reading
    expect(state.drafts.value).toBeNull()
    expect(state.pending.value).toBe(true)
    next.resolve(page(9))
    await flushPromises()
    expect(state.drafts.value).toEqual(page(9))
    expect(state.pending.value).toBe(false)
  })

  it.each(['success', 'failure'] as const)('迟到的%s不能覆盖新查询或提前结束新请求', async (outcome) => {
    const { state, query } = await setup()
    const old = deferred<PromptPage<ManagedPrompt>>(),
      latest = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    query.value = { ...query.value, q: '旧筛选' }
    query.value = { ...query.value, q: '新筛选' }
    if (outcome === 'success') old.resolve(page(8))
    else old.reject(new Error('旧请求错误'))
    await flushPromises()
    expect(state.drafts.value).toEqual(page())
    expect(state.error.value).toBe('')
    expect(state.pending.value).toBe(true)
    latest.resolve(page(9))
    await flushPromises()
    expect(state.drafts.value).toEqual(page(9))
    expect(state.pending.value).toBe(false)
    expect(state.stale.value).toBe(false)
  })

  it('关闭草稿范围立即清空，并拒绝关闭前的结果；重新开启重新读取', async () => {
    const { state, enabled } = await setup()
    const old = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(old.promise)
    const reading = state.refresh()
    enabled.value = false
    expect(state.drafts.value).toBeNull()
    expect(state.pending.value).toBe(false)
    expect(state.error.value).toBe('')
    old.resolve(page(5))
    await reading
    expect(state.drafts.value).toBeNull()
    mocks.repo.adminList.mockResolvedValueOnce(page(7))
    enabled.value = true
    await flushPromises()
    expect(state.drafts.value).toEqual(page(7))
  })

  it('退出账号与组件卸载均拒绝在途私有响应，未启用不请求', async () => {
    const { state, enabled, wrapper } = await setup(false)
    expect(mocks.repo.adminList).not.toHaveBeenCalled()
    const old = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(old.promise)
    enabled.value = true
    mocks.auth.currentUser.value = null
    expect(state.pending.value).toBe(false)
    expect(state.drafts.value).toBeNull()
    old.resolve(page(5))
    await flushPromises()
    expect(state.drafts.value).toBeNull()
    const later = deferred<PromptPage<ManagedPrompt>>()
    mocks.repo.adminList.mockReturnValueOnce(later.promise)
    mocks.auth.currentUser.value = { id: 'another-owner' }
    wrapper.unmount()
    later.resolve(page(6))
    await flushPromises()
    expect(state.drafts.value).toBeNull()
    expect(state.pending.value).toBe(false)
    expect(state.error.value).toBe('')
  })
})
