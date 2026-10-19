/**
 * @file batchTypes.ts
 * @description 明确范围的文章批量预览与持久化执行结果契约。
 */
export const POST_BATCH_LIMIT = 50
export const POST_SELECTION_LIMIT = 500

export type PostBatchAction = 'withdraw' | 'archive' | 'trash' | 'restore' | 'delete'
export interface PostSelection {
  id: number
  revision: number
}
export interface PostBatchPreview {
  ticket: string
  action: PostBatchAction
  allowedCount: number
  expiresIn: number
  items: (PostSelection & {
    title: string
    allowed: boolean
    reason: string
    impact: {
      comments: number
      commentLikes: number
      revisions: number
      addresses: number
      mediaReferences: number
      likes: number
      views: number
    }
  })[]
}
export interface PostBatchResult {
  preview: PostBatchPreview
  ticket: string
  action: PostBatchAction
  results: { id: number; success: boolean; message: string }[]
  successCount: number
  failedCount: number
  pendingCount: number
  completed: boolean
}
/** 批量操作名称的字典 key，由调用方按当前界面语言翻译 */
export const postBatchActions: readonly PostBatchAction[] = ['withdraw', 'archive', 'trash', 'restore', 'delete']
export function postBatchLabelKey(action: PostBatchAction) {
  return `admin-content.postBatch.actions.${action}`
}
/** 永久删除时提交的确认原值：后端逐字校验，属于接口约定，不随界面语言变化 */
export const POST_DELETE_ACKNOWLEDGEMENT = '永久删除'
/** 界面要求用户亲手输入的当前语言短语（中文界面与 POST_DELETE_ACKNOWLEDGEMENT 相同） */
export const POST_DELETE_PHRASE_KEY = 'admin-content.postBatch.deletePhrase'
/** 输入与当前语言短语完全一致时返回后端认可的原值，否则返回 null，不执行永久删除 */
export function postDeleteAcknowledgement(input: string, t: (key: string) => string): string | null {
  return input === t(POST_DELETE_PHRASE_KEY) ? POST_DELETE_ACKNOWLEDGEMENT : null
}
