/**
 * @file commentController.test.ts
 * @description 评论状态回归：请求互斥、草稿恢复、回复归属及读写失败区分
 */
import { describe, expect, it, vi } from 'vitest'
import { createCommentController } from '../../app/features/post/commentController'
import type { CommentList, CommentTransport } from '../../app/features/post/commentController'
import type { CommentItem } from '../../app/features/post/types'

const item = (id = 1): CommentItem => ({
  id,
  author: '访客',
  avatar: '',
  content: '原评论',
  time: '2026-09-06',
  likes: 0,
  replies: [],
})
const identity = { author: '联调测试' }
function setup(initial: CommentList = { items: [], total: 0 }) {
  const transport: CommentTransport = {
    load: vi.fn().mockResolvedValue(initial),
    create: vi.fn().mockResolvedValue(item(2)),
    like: vi.fn().mockResolvedValue({ liked: true, likes: 1 }),
  }
  return { transport, state: createCommentController(transport, initial) }
}

describe('评论控制器', () => {
  it('服务端返回同一次提交时，列表已含该评论也不重复追加或增加计数', async () => {
    const { state, transport } = setup({ items: [item(2)], total: 1 })
    state.draft.value = '原评论'
    vi.mocked(transport.create).mockResolvedValue(item(2))
    vi.mocked(transport.load).mockRejectedValueOnce(new Error('读取暂不可用'))
    expect(await state.submit(identity)).toBe(true)
    expect(state.comments.value).toHaveLength(1)
    expect(state.total.value).toBe(1)
    expect(state.loadError.value).toContain('已发表')
  })
  it.each(['文章已归档,无法评论', '父评论不存在', '评论层级超限(最深 3 层)'])(
    '后端业务拒绝时保留草稿并展示原因：%s',
    async (message) => {
      const { state, transport } = setup()
      state.draft.value = '联调测试业务错误'
      vi.mocked(transport.create).mockRejectedValue({ data: { message } })
      expect(await state.submit(identity)).toBe(false)
      expect(state.submitError.value).toBe(message)
      expect(state.draft.value).toBe('联调测试业务错误')
      expect(state.total.value).toBe(0)
    },
  )

  it('等待后端成功再清空草稿，并采用后端评论树及总数', async () => {
    const { state, transport } = setup()
    state.draft.value = '  联调测试正文  '
    vi.mocked(transport.load).mockResolvedValue({ items: [item(2)], total: 1 })
    expect(await state.submit(identity)).toBe(true)
    expect(transport.create).toHaveBeenCalledWith({ author: '联调测试', content: '联调测试正文' })
    expect(state.draft.value).toBe('')
    expect(state.comments.value[0]?.id).toBe(2)
    expect(state.total.value).toBe(1)
  })

  it('发送失败保留草稿与回复对象，恢复后可以重试', async () => {
    const { state, transport } = setup({ items: [item()], total: 1 })
    state.reply(item())
    state.draft.value = '回复草稿'
    vi.mocked(transport.create).mockRejectedValueOnce(new Error('offline'))
    expect(await state.submit(identity)).toBe(false)
    expect(state.draft.value).toBe('回复草稿')
    expect(state.replyTarget.value?.id).toBe(1)
    expect(state.total.value).toBe(1)
    expect(state.submitError.value).toContain('草稿已保留')
    await state.submit(identity)
    expect(transport.create).toHaveBeenLastCalledWith({ ...identity, content: '回复草稿', parentId: 1 })
    expect(state.replyTarget.value).toBeNull()
  })

  it('连续提交只发送一个请求；请求期间不能切换回复目标', async () => {
    const { state, transport } = setup()
    let resolve!: (comment: CommentItem) => void
    vi.mocked(transport.create).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    state.draft.value = '联调测试重复提交'
    const first = state.submit(identity)
    state.reply(item())
    expect(await state.submit(identity)).toBe(false)
    expect(state.replyTarget.value).toBeNull()
    expect(transport.create).toHaveBeenCalledTimes(1)
    resolve(item(2))
    await first
  })

  it('写成功后读取失败不报告发送失败，不鼓励重复发送', async () => {
    const { state, transport } = setup({ items: [item()], total: 1 })
    state.reply(item())
    state.draft.value = '联调测试回复'
    vi.mocked(transport.load).mockRejectedValue(new Error('offline'))
    expect(await state.submit(identity)).toBe(true)
    expect(state.comments.value[0]?.replies?.[0]?.id).toBe(2)
    expect(state.total.value).toBe(2)
    expect(state.loadError.value).toContain('评论已发表')
    expect(state.submitError.value).toBe('')
    expect(state.draft.value).toBe('')
  })

  it('空白与超长评论不发送；取消回复不丢草稿', async () => {
    const { state, transport } = setup()
    state.draft.value = ' \n '
    await state.submit(identity)
    state.draft.value = '字'.repeat(1001)
    await state.submit(identity)
    expect(transport.create).not.toHaveBeenCalled()
    state.reply(item())
    state.draft.value = '保留草稿'
    state.cancelReply()
    expect(state.replyTarget.value).toBeNull()
    expect(state.draft.value).toBe('保留草稿')
  })

  it('评论加载失败保持可识别的错误，成功重试后恢复', async () => {
    const { state, transport } = setup()
    vi.mocked(transport.load).mockRejectedValueOnce(new Error('offline'))
    await state.reload()
    expect(state.loadError.value).toContain('加载失败')
    await state.reload()
    expect(state.loadError.value).toBe('')
    expect(state.comments.value).toEqual([])
  })

  it('点赞等待服务端响应，互斥重复点击并恢复嵌套评论状态', async () => {
    const root = item()
    root.replies = [item(3)]
    const { state, transport } = setup({ items: [root], total: 2 })
    let resolve!: (result: { liked: boolean; likes: number }) => void
    vi.mocked(transport.like).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const first = state.like(3)
    await state.like(3)
    expect(transport.like).toHaveBeenCalledTimes(1)
    expect(state.comments.value[0]?.replies?.[0]?.likes).toBe(0)
    resolve({ liked: true, likes: 7 })
    await first
    expect(state.comments.value[0]?.replies?.[0]).toMatchObject({ liked: true, likes: 7 })
    vi.mocked(transport.like).mockRejectedValueOnce(new Error('offline'))
    await state.like(3)
    expect(state.comments.value[0]?.replies?.[0]?.likes).toBe(7)
    expect(state.likeError.value).toContain('失败')
  })
  it('待审核评论不加入公开列表或计数，即使后续读取失败也明确已提交', async () => {
    const { state, transport } = setup()
    state.draft.value = '等待审核的正文'
    vi.mocked(transport.create).mockResolvedValue({ ...item(2), moderationStatus: 'pending' })
    vi.mocked(transport.load).mockRejectedValueOnce(new Error('offline'))
    expect(await state.submit(identity)).toBe(true)
    expect(state.draft.value).toBe('')
    expect(state.total.value).toBe(0)
    expect(state.comments.value).toEqual([])
    expect(state.submitNotice.value).toContain('等待博主审核')
    expect(state.loadError.value).toContain('已提交')
  })
})
