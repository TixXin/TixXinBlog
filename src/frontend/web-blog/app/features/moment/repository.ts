/** @file repository.ts @description 朋友圈数据访问契约，公开内容与管理写入保持边界 */
import type {
  ManagedMoment,
  MomentCommentItem,
  MomentCommentPage,
  MomentEditable,
  MomentItem,
  MomentNavigation,
  MomentOverview,
  MomentPage,
  MomentQuery,
} from './types'

export interface MomentRepository {
  list(query: MomentQuery, signal?: AbortSignal): Promise<MomentPage>
  detail(id: string, signal?: AbortSignal): Promise<MomentItem>
  overview(signal?: AbortSignal): Promise<MomentOverview>
  navigation(id: string, signal?: AbortSignal): Promise<MomentNavigation>
  comments(id: string, page: number, signal?: AbortSignal): Promise<MomentCommentPage>
  like(id: string, liked: boolean): Promise<{ isLiked: boolean; likes: number }>
  comment(
    id: string,
    value: { requestId: string; content: string; author?: string; avatar?: string },
    owner: boolean,
  ): Promise<MomentCommentItem & { commentCount: number }>
  adminList(query: MomentQuery & { status?: string }): Promise<MomentPage & { items: ManagedMoment[] }>
  adminDetail(id: string): Promise<ManagedMoment>
  submission(requestId: string): Promise<ManagedMoment>
  update(id: string, patch: Partial<MomentEditable>, revision: number): Promise<ManagedMoment>
  save(value: MomentEditable, requestId: string, id?: string, revision?: number): Promise<ManagedMoment>
  remove(id: string, revision: number): Promise<{ ok: boolean }>
  adminComments(id: string, page: number): Promise<MomentCommentPage>
  adminCommentLocation(id: string, commentId: string): Promise<{ commentId: string; page: number; pageSize: number }>
  moderate(
    id: string,
    commentId: string,
    status: 'published' | 'pending' | 'hidden',
    expectedStatus: 'published' | 'pending' | 'hidden',
  ): Promise<MomentCommentItem & { commentCount: number }>
  removeComment(id: string, commentId: string): Promise<{ ok: boolean; commentCount: number }>
}
