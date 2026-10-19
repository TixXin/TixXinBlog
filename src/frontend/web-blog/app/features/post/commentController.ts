/**
 * @file commentController.ts
 * @description 评论状态与操作：隔离传输层，处理草稿、回复、失败恢复及请求互斥
 */
import { computed, ref } from 'vue'
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import { apiErrorMessage } from '~/utils/apiError'
import { currentTranslate, type Translate } from '~/utils/format'
import type { CommentItem } from './types'

export interface CommentDraft extends VisitorSubmissionFields {
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

/** 优先显示后端返回的可读 message，否则显示兜底文案的当前语言版本 */
export function commentError(error: unknown, fallbackKey: string, t?: Translate): string {
  return apiErrorMessage(error, fallbackKey, { t })
}

export function findComment(items: CommentItem[], id: number): CommentItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const found = findComment(item.replies ?? [], id)
    if (found) return found
  }
}

/**
 * @param t 翻译函数；缺省时在每次产生提示时读取当前界面语言，控制器跨页面复用也不会固定创建时的语言
 */
export function createCommentController(
  transport: CommentTransport,
  initial: CommentList,
  initialError = '',
  t?: Translate,
) {
  const translate: Translate = (key, params) => (t ?? currentTranslate())(key, params)
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
      loadError.value = commentError(error, 'article.comment.loadFailed', translate)
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

  async function submit(
    identity: { author: string; avatar?: string },
    fields: VisitorSubmissionFields = {},
  ): Promise<boolean> {
    if (busy.value) return false
    const content = draft.value.trim()
    if (!content || content.length > 1000) {
      submitError.value = translate('article.comment.lengthInvalid')
      return false
    }
    const target = replyTarget.value
    submitting.value = true
    submitError.value = ''
    try {
      const created = await transport.create({
        ...identity,
        ...fields,
        content,
        ...(target ? { parentId: target.id } : {}),
      })
      const parent = target ? findComment(comments.value, target.id) : undefined
      if (created.moderationStatus !== 'pending' && !findComment(comments.value, created.id)) {
        if (parent) (parent.replies ??= []).push(created)
        else comments.value.push(created)
        total.value += 1
      }
      submitNotice.value =
        created.moderationStatus === 'pending'
          ? translate('article.comment.pendingNotice')
          : translate('article.comment.publishedNotice')
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
            ? translate('article.comment.pendingSyncFailed')
            : translate('article.comment.publishedSyncFailed')
      }
      return true
    } catch (error) {
      submitError.value = commentError(error, 'article.comment.submitFailed', translate)
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
      likeError.value = commentError(error, 'article.comment.likeFailed', translate)
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
