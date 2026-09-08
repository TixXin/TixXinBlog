/**
 * @file repository.http.ts
 * @description 真实闪念仓库：公开读取与管理员写入分离，所有者由服务端统一决定
 */
import { ensureVisitorId } from '~/utils/visitorId'
import type { FlashNoteRepository } from './repository'
import type { FlashComment, FlashCommentDraft, FlashNote, FlashNoteDraft } from './types'

type AdminFetch = <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string | number | undefined>
  },
) => Promise<T>
interface Envelope<T> {
  code: number
  data: T
  message: string
}
interface FlashPage {
  items: FlashNote[]
  total: number
  page: number
  pageSize: number
}

export class HttpFlashRepository implements FlashNoteRepository {
  private readonly base: string
  constructor(
    base: string,
    private readonly admin: AdminFetch,
    private readonly isAdmin: () => boolean,
  ) {
    this.base = base.replace(/\/$/, '')
  }
  private headers() {
    const visitor = ensureVisitorId()
    return visitor ? { 'X-Visitor-Id': visitor } : undefined
  }
  private async publicRequest<T>(
    path: string,
    options: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string | number> } = {},
  ): Promise<T> {
    let result: Envelope<T>
    try {
      result = await $fetch<Envelope<T>>(`${this.base}${path}`, {
        ...options,
        body: options.body as Record<string, unknown> | undefined,
        headers: this.headers(),
        timeout: 10000,
        retry: 0,
      })
    } catch (cause) {
      const failure = cause as { statusCode?: number; data?: { message?: unknown } }
      const message =
        !failure.statusCode || failure.statusCode >= 500
          ? '暂时无法连接闪念服务，请稍后重试'
          : typeof failure.data?.message === 'string'
            ? failure.data.message
            : '闪念操作未完成，请检查输入后重试'
      throw Object.assign(new Error(message), { statusCode: failure.statusCode })
    }
    if (result.code !== 0) throw new Error(result.message)
    return result.data
  }
  private async all(archived: boolean, query = '', publicOnly = false): Promise<FlashNote[]> {
    const privateView = !publicOnly && this.isAdmin()
    if (archived && !privateView) throw new Error('归档内容需要博主登录')
    const notes = new Map<string, FlashNote>()
    let page = 1
    let total: number
    do {
      const result: FlashPage = privateView
        ? await this.admin<FlashPage>('/admin/flashes', {
            query: { page, pageSize: 100, archived: String(archived), search: query || undefined },
          })
        : await this.publicRequest<FlashPage>(query ? '/flashes/search' : '/flashes', {
            query: { page, pageSize: 100, ...(query ? { q: query } : {}) },
          })
      result.items.forEach((note) => notes.set(note.id, note))
      total = result.total
      if (!result.items.length) break
      page += 1
    } while ((page - 1) * 100 < total)
    return [...notes.values()]
  }
  list(_userId: string) {
    return this.all(false)
  }
  listPublic() {
    return this.all(false, '', true)
  }
  listArchived(_userId: string) {
    return this.all(true)
  }
  search(_userId: string, query: string) {
    return this.all(false, query.trim())
  }
  private body(draft: Partial<FlashNoteDraft>) {
    return {
      content: draft.content,
      tags: draft.tags,
      images: draft.images,
      type: draft.type,
      isPinned: draft.isPinned,
      isArchived: draft.isArchived,
      isDraft: draft.isDraft,
    }
  }
  create(_userId: string, draft: FlashNoteDraft): Promise<FlashNote> {
    return this.admin('/admin/flashes', { method: 'POST', body: this.body(draft) })
  }
  update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote> {
    return this.admin(`/admin/flashes/${encodeURIComponent(id)}`, { method: 'PATCH', body: this.body(patch) })
  }
  async remove(id: string): Promise<void> {
    await this.admin(`/admin/flashes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
  setPinned(id: string, value: boolean) {
    return this.update(id, { isPinned: value })
  }
  setArchived(id: string, value: boolean) {
    return this.update(id, { isArchived: value })
  }
  async toggleLike(id: string): Promise<FlashNote> {
    await this.publicRequest(`/flashes/${encodeURIComponent(id)}/like`, { method: 'POST' })
    return this.publicRequest(`/flashes/${encodeURIComponent(id)}`)
  }
  addComment(id: string, draft: FlashCommentDraft): Promise<FlashComment> {
    return this.publicRequest(`/flashes/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: { authorName: draft.authorName, authorAvatar: draft.authorAvatar || undefined, content: draft.content },
    })
  }
  async removeComment(id: string, commentId: string): Promise<void> {
    await this.admin(`/admin/flashes/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    })
  }
}
