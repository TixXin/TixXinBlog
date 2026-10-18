/** @file visitorSubmissionTransport.test.ts @description 四类公开请求的防垃圾字段透传、管理边界与文章重试凭据兼容 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createComment } from '~/features/post/api'
import { HttpFlashRepository } from '~/features/flash/repository.http'
import { useGuestbookRepository } from '~/composables/useGuestbookRepository'
import { useMomentRepository } from '~/composables/useMomentRepository'
import { ensureVisitorId } from '~/utils/visitorId'
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), admin: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useAdminApi', () => () => mocks.admin)
const wrappers: { unmount(): void }[] = []
const fields = { website: ' robot ', formElapsedMs: 1000 }
const comment = { id: 1, author: '访客', content: '正文', time: '2026-10-18T00:00:00Z', likes: 0, avatar: '' }
beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({ code: 0, data: comment })
  mocks.admin.mockReset().mockResolvedValue(comment)
  vi.stubGlobal('$fetch', mocks.fetch)
  sessionStorage.clear()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
async function repositories() {
  let guestbook!: ReturnType<typeof useGuestbookRepository>
  let moment!: ReturnType<typeof useMomentRepository>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          guestbook = useGuestbookRepository()
          moment = useMomentRepository()
          return () => h('div')
        },
      }),
    ),
  )
  return { guestbook, moment }
}

describe('公开提交的传输边界', () => {
  it('文章发送实际蜜罐，改变渲染时刻仍复用升级前存储的提交凭据', async () => {
    const business = { author: '访客', avatar: '', content: '正文', parentId: 2 }
    const headers = { 'X-Visitor-Id': ensureVisitorId() }
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(['/api/v1', '1', headers, business])),
    )
    const key = `blog-comment-submit:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    const requestId = crypto.randomUUID()
    sessionStorage.setItem(key, requestId)
    mocks.fetch.mockRejectedValueOnce(new Error('响应丢失'))
    await expect(createComment('/api/v1', '1', { ...business, ...fields })).rejects.toThrow('响应丢失')
    expect(mocks.fetch.mock.calls[0]?.[1].body).toEqual({ ...business, ...fields, requestId })
    await createComment('/api/v1', '1', { ...business, website: '', formElapsedMs: 3000 })
    expect(mocks.fetch.mock.calls[1]?.[1].body).toEqual({ ...business, website: '', formElapsedMs: 3000, requestId })
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('闪念公开请求不会在字段白名单转换中丢掉蜜罐与时间戳', async () => {
    const repo = new HttpFlashRepository('/api/v1', mocks.admin, () => false)
    await repo.addComment('flash', {
      authorId: 'guest',
      authorName: '访客',
      authorAvatar: '',
      content: '正文',
      ...fields,
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/v1/flashes/flash/comments',
      expect.objectContaining({
        method: 'POST',
        body: { authorName: '访客', authorAvatar: undefined, content: '正文', ...fields },
      }),
    )
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('留言与朋友圈只在公开写入发送防垃圾字段，管理接口继续使用原白名单', async () => {
    const { guestbook, moment } = await repositories()
    const body = { requestId: crypto.randomUUID(), author: '访客', content: '正文', ...fields }
    await guestbook.create(body, false)
    await moment.comment('moment', body, false)
    expect(mocks.fetch.mock.calls[0]?.[1].body).toEqual(body)
    expect(mocks.fetch.mock.calls[1]?.[1].body).toEqual(body)
    await guestbook.create(body, true)
    await moment.comment('moment', body, true)
    expect(mocks.admin.mock.calls[0]?.[1].body).toEqual({ requestId: body.requestId, content: '正文', replyToId: null })
    expect(mocks.admin.mock.calls[1]?.[1].body).toEqual({ requestId: body.requestId, content: '正文' })
  })
})
