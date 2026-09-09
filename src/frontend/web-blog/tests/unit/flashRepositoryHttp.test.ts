/**
 * @file flashRepositoryHttp.test.ts
 * @description 闪念公开读取、管理读取与写入使用一致的可读错误，保留 HTTP 状态供调用方判断
 */
import { describe, expect, it, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { HttpFlashRepository } from '../../app/features/flash/repository.http'

const offline = () =>
  Object.assign(new Error('[GET] /api/v1/admin/flashes: 502 Server Error'), {
    statusCode: 502,
    data: { message: 'upstream internal details' },
  })

describe('闪念传输错误', () => {
  it.each(['admin', 'archive', 'write'] as const)('%s 故障不暴露请求地址，且不会自动重试写入', async (operation) => {
    const request = vi.fn().mockRejectedValue(offline())
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    const task =
      operation === 'archive'
        ? repo.listArchived('owner')
        : operation === 'write'
          ? repo.setPinned('note', true)
          : repo.list('owner')
    await expect(task).rejects.toMatchObject({ message: '闪念服务暂时不可用，请稍后重试', statusCode: 502 })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('公开读取的真实 FetchError 也转换为可读提示', async () => {
    const unavailable = vi.fn(() => new Response(JSON.stringify({ message: 'upstream details' }), { status: 502 }))
    registerEndpoint('/api/v1/flashes', unavailable)
    const repo = new HttpFlashRepository('/api/v1', vi.fn(), () => false)
    await expect(repo.list('owner')).rejects.toMatchObject({
      message: '闪念服务暂时不可用，请稍后重试',
      statusCode: 502,
    })
    expect(unavailable).toHaveBeenCalledTimes(1)
  })

  it('保留可操作的业务校验信息', async () => {
    const request = vi.fn().mockRejectedValue({ statusCode: 400, data: { message: '闪念内容不能为空' } })
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    await expect(repo.update('note', { content: '' })).rejects.toMatchObject({
      statusCode: 400,
      message: '闪念内容不能为空',
    })
  })

  it('请求恢复后仍读取真实列表', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 100 })
    const repo = new HttpFlashRepository('/api/v1', request, () => true)
    await expect(repo.list('owner')).rejects.toThrow('闪念服务暂时不可用')
    await expect(repo.list('owner')).resolves.toEqual([])
  })
})
