/** @file promptRepository.test.ts @description 提示词错误分流：只有真实版本冲突可合并，身份与内容库变更保留准确原因 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { usePromptRepository } from '../../app/composables/usePromptRepository'
import { promptForm } from '../../app/features/prompt/editor'

const mocks = vi.hoisted(() => ({ admin: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.admin)
const wrappers: { unmount(): void }[] = []
const form = promptForm({ title: '窗边光影', prompt: 'A quiet sunlit room', mediaId: 'selected-image' })
const revisionMessage = '提示词已被修改，请保留输入并重新读取'

function apiFailure(message: string, statusCode = 409, code = 40) {
  return Object.assign(new Error(`[PATCH] "/api/v1/admin/prompts/7": ${statusCode} Conflict`), {
    statusCode,
    data: { code, message, data: null, traceId: 'request-trace' },
  })
}
async function setup() {
  let repository!: ReturnType<typeof usePromptRepository>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          repository = usePromptRepository()
          return () => h('div')
        },
      }),
    ),
  )
  return repository
}
beforeEach(() => mocks.admin.mockReset())
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('图片提示词请求冲突分流', () => {
  it('后端统一错误信封明确提示版本冲突时才标记 revision', async () => {
    const repository = await setup()
    const cause = apiFailure(revisionMessage, 409, 41)
    mocks.admin.mockRejectedValueOnce(cause)
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'revision',
      message: revisionMessage,
      cause,
    })
    expect(mocks.admin).toHaveBeenCalledTimes(1)
  })

  it('真实 FetchError 的后端 message 优先于含路径的请求异常描述', async () => {
    const repository = await setup()
    const handler = vi.fn(
      () =>
        new Response(
          JSON.stringify({
            code: 41,
            message: revisionMessage,
            data: null,
            traceId: 'http-trace',
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    )
    registerEndpoint('/api/v1/prompts/987654', handler)
    await expect(repository.detail(987654)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'revision',
      message: revisionMessage,
    })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('内容库恢复的 409 保留刷新指引，不假称提示词版本改变', async () => {
    const repository = await setup()
    const message = '站点数据上下文已变化，请保留输入并刷新页面后再编辑'
    mocks.admin.mockRejectedValueOnce(apiFailure(message, 409, 42))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'context',
      message,
    })
  })

  it('useAdminApi 直接抛出的身份 Error.message 也归为 context', async () => {
    const repository = await setup()
    const message = '登录账号或内容库已变化，请保留输入并重新核对后操作'
    mocks.admin.mockRejectedValueOnce(Object.assign(new Error(message), { statusCode: 409, ownershipChanged: true }))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'context',
      message: `${message}；请保留当前输入，刷新页面后重新打开编辑器。`,
    })
  })

  it('创建去重冲突保持原提交核查语义，不诱导合并或自动重试', async () => {
    const repository = await setup()
    const message = '此提交已处理，请核查原提示词'
    mocks.admin.mockRejectedValueOnce(apiFailure(message, 409, 44))
    await expect(repository.save(form, 'request-id')).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'submission',
      message: `${message}；当前输入已保留。`,
    })
    expect(mocks.admin).toHaveBeenCalledTimes(1)
  })

  it.each(['内容引用的媒体已移除或不存在，请重新选择图片', '版本冲突', '未知的业务冲突，请核查站点状态'])(
    '其它 409 保留实际原因且归为 unknown：%s',
    async (message) => {
      const repository = await setup()
      mocks.admin.mockRejectedValueOnce(apiFailure(message))
      await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
        statusCode: 409,
        conflictKind: 'unknown',
        message: `${message}；当前输入已保留。`,
      })
    },
  )

  it('英文界面下按业务码分流，不依赖中文文案', async () => {
    const repository = await setup()
    const message = 'This prompt has been modified. Keep your input and reload it.'
    mocks.admin.mockRejectedValueOnce(apiFailure(message, 409, 41))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'revision',
      message,
    })
    mocks.admin.mockRejectedValueOnce(apiFailure('The site data context has changed.', 409, 42))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({ conflictKind: 'context' })
    mocks.admin.mockRejectedValueOnce(apiFailure('This submission was already processed.', 409, 44))
    await expect(repository.save(form, 'request-id')).rejects.toMatchObject({ conflictKind: 'submission' })
    // 仅中文文案相同、业务码为通用冲突时不再进入合并流程
    mocks.admin.mockRejectedValueOnce(apiFailure(revisionMessage))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({ conflictKind: 'unknown' })
  })

  it('无业务信息的 409 不展示请求地址或凭空生成版本合并提示', async () => {
    const repository = await setup()
    mocks.admin.mockRejectedValueOnce(
      Object.assign(new Error('[PATCH] "/api/v1/admin/prompts/7": 409 Conflict'), { status: 409 }),
    )
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 409,
      conflictKind: 'unknown',
      message: '操作发生冲突，请核对当前状态后重试；当前输入已保留。',
    })
  })

  it('非 409 即使正文提及版本也不能开启合并，服务故障不泄露内部详情', async () => {
    const repository = await setup()
    mocks.admin.mockRejectedValueOnce(apiFailure(revisionMessage, 503, 41))
    await expect(repository.save(form, 'request-id', 7, 1)).rejects.toMatchObject({
      statusCode: 503,
      conflictKind: undefined,
      message: '提示词服务暂时不可用，请稍后重试。',
    })
  })
})
