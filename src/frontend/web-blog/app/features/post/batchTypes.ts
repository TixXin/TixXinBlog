/**
 * @file batchTypes.ts
 * @description 明确范围的文章批量预览与持久化执行结果契约。
 */
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
export const postBatchLabels: Record<PostBatchAction, string> = {
  withdraw: '撤回为草稿',
  archive: '归档',
  trash: '移入回收站',
  restore: '恢复为草稿',
  delete: '永久删除',
}
