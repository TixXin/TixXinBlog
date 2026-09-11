/**
 * @file commentController.ts
 * @description 评论状态与操作：隔离传输层，处理草稿、回复、失败恢复及请求互斥
 */
import { computed, ref } from 'vue'
import type { CommentItem } from './types'

export interface CommentDraft {
  requestId?: string
  author: string
  avatar?: string
  content: string
  parentId?: number
}

export interface CommentList {
  items: CommentItem[]
  total: number
}

export interface CommentTransport {
  load(): Promise<CommentList>
  create(draft: CommentDraft): Promise<CommentItem>
  like(id: number): Promise<{ liked: boolean; likes: number }>
}

export function commentError(error: unknown, fallback: string): string {
  const response = error as { data?: { message?: unknown } }
  return typeof response?.data?.message === 'string' ? response.data.message : fallback
}

export function findComment(items: CommentItem[], id: number): CommentItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const found = findComment(item.replies ?? [], id)
    if (found) return found
  }
}

export function createCommentController(transport: CommentTransport, initial: CommentList, initialError = '') {
  const comments = ref<CommentItem[]>(initial.items)
  const total = ref(initial.total)
  const draft = ref('')
  const replyTarget = ref<{ id: number; author: string } | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const pendingLikes = ref<number[]>([])
  const loadError = ref(initialError)
  const submitError = ref('')
  const submitNotice = ref('')
  const likeError = ref('')
  const busy = computed(() => loading.value || submitting.value || pendingLikes.value.length > 0)
  const canSubmit = computed(() => !!draft.value.trim() && draft.value.trim().length <= 1000 && !busy.value)

  async function reload() {
    if (busy.value) return
    loading.value = true
    try {
      const data = await transport.load()
      comments.value = data.items
      total.value = data.total
      loadError.value = ''
      likeError.value = ''
    } catch (error) {
      loadError.value = commentError(error, '评论加载失败，请重试')
    } finally {
      loading.value = false
    }
  }

  function reply(comment: CommentItem) {
    if (busy.value) return
    replyTarget.value = { id: comment.id, author: comment.author }
    submitError.value = ''
  }

  function cancelReply() {
    if (!submitting.value) replyTarget.value = null
  }

  async function submit(identity: { author: string; avatar?: string }): Promise<boolean> {
    if (busy.value) return false
    const content = draft.value.trim()
    if (!content || content.length > 1000) {
      submitError.value = '评论需要 1–1000 个字符'
      return false
    }
    const target = replyTarget.value
    submitting.value = true
    submitError.value = ''
    try {
      const created = await transport.create({ ...identity, content, ...(target ? { parentId: target.id } : {}) })
      const parent = target ? findComment(comments.value, target.id) : undefined
      if (created.moderationStatus !== 'pending' && !findComment(comments.value, created.id)) {
        if (parent) (parent.replies ??= []).push(created)
        else comments.value.push(created)
        total.value += 1
      }
      submitNotice.value =
        created.moderationStatus === 'pending' ? '评论已提交，等待博主审核，通过后公开显示' : '评论发布成功'
      draft.value = ''
      replyTarget.value = null
      // 写入成功与随后读取失败分开呈现，避免用户因刷新失败再次提交同一条评论。
      try {
        const data = await transport.load()
        comments.value = data.items
        total.value = data.total
        loadError.value = ''
      } catch {
        loadError.value =
          created.moderationStatus === 'pending'
            ? '评论已提交，等待审核；列表同步失败，请重试加载'
            : '评论已发表，列表同步失败，请重试加载'
      }
      return true
    } catch (error) {
      submitError.value = commentError(error, '评论发送失败，草稿已保留；若连接中断，请先刷新评论确认是否已发表')
      return false
    } finally {
      submitting.value = false
    }
  }

  async function like(id: number) {
    if (busy.value) return
    pendingLikes.value = [...pendingLikes.value, id]
    likeError.value = ''
    try {
      const result = await transport.like(id)
      const comment = findComment(comments.value, id)
      if (comment) Object.assign(comment, result)
    } catch (error) {
      likeError.value = commentError(error, '点赞操作失败，请刷新评论确认状态后重试')
    } finally {
      pendingLikes.value = pendingLikes.value.filter((pending) => pending !== id)
    }
  }

  return {
    comments,
    total,
    draft,
    replyTarget,
    loading,
    submitting,
    pendingLikes,
    loadError,
    submitError,
    submitNotice,
    likeError,
    busy,
    canSubmit,
    reload,
    reply,
    cancelReply,
    submit,
    like,
  }
}
