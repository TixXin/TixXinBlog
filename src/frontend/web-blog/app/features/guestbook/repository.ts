/** @file repository.ts @description 留言数据访问契约，组件不直接访问仓储 */
import type {
  GuestbookMetadata,
  GuestbookPage,
  GuestbookQuery,
  GuestbookRecord,
  GuestbookSubmission,
  ManagedGuestbookRecord,
  MessageReaction,
} from './types'
export interface GuestbookRepository {
  list(query: GuestbookQuery, signal?: AbortSignal): Promise<GuestbookPage>
  metadata(signal?: AbortSignal): Promise<GuestbookMetadata>
  detail(id: number, signal?: AbortSignal): Promise<GuestbookRecord>
  create(body: GuestbookSubmission, owner: boolean): Promise<GuestbookRecord>
  react(id: number, emoji: string, reacted: boolean): Promise<{ id: number; reactions: MessageReaction[] }>
  adminList(query: {
    page: number
    pageSize: number
    q?: string
    date?: string
    status?: string
    unanswered?: string
  }): Promise<{ items: ManagedGuestbookRecord[]; total: number; page: number; pageSize: number }>
  adminDetail(id: number): Promise<ManagedGuestbookRecord>
  update(
    id: number,
    body: { revision: number; status?: 'published' | 'pending' | 'hidden'; isPinned?: boolean },
  ): Promise<ManagedGuestbookRecord>
  remove(id: number, revision: number): Promise<{ ok: true }>
}
