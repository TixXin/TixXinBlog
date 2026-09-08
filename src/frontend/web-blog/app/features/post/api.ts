/**
 * @file api.ts
 * @description post 域 HTTP 取数:对接 server-main /api/v1/posts,解包统一响应并归一化字段
 * @author TixXin
 * @since 2026-07-20
 *
 * 仅在 runtimeConfig.public.postUseMockRepo === false 时被调用(见 usePostList / useArticleDetail)。
 * 后端响应契约见 docs/backend/api.md §2 / §7.2。
 */

import type { ArticleDetail, CommentItem, PostItem, PostMetadata, PostPage, RelatedPost, TocItem } from './types'
import type { CommentDraft, CommentList } from './commentController'
import { ensureVisitorId } from '~/utils/visitorId'

/** 后端统一响应包装(docs/backend/api.md §2) */
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  traceId: string
}

interface ApiPostListData {
  items: PostItem[]
  total: number
  page: number
  pageSize: number
}

/** 详情响应:ArticleDetail 字段 + toc 扩展 */
type ApiArticleDetail = ArticleDetail & { toc: TocItem[] }

function requireBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    throw new Error('apiBaseUrl 未配置:postUseMockRepo=false 时必须设置 NUXT_PUBLIC_API_BASE_URL')
  }
  return baseUrl.replace(/\/$/, '')
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.code !== 0) {
    throw new Error(`API 错误 ${envelope.code}: ${envelope.message}`)
  }
  return envelope.data
}

/** 后端 date 为 ISO 串,列表展示层期望 YYYY-MM-DD,统一在边界归一化 */
function normalizePostItem(item: PostItem): PostItem {
  return { ...item, date: item.date.slice(0, 10) }
}

/** 后端分页与筛选，保留 total 供页码和瀑布流使用。 */
export async function fetchPostPage(
  baseUrl: string,
  query: { page?: number; pageSize?: number; tag?: string; folder?: string; search?: string } = {},
): Promise<PostPage> {
  const base = requireBaseUrl(baseUrl)
  const envelope = await $fetch<ApiEnvelope<ApiPostListData>>(`${base}/posts`, {
    query: { page: 1, pageSize: 15, ...query },
    timeout: 10000,
    retry: 0,
  })
  const data = unwrap(envelope)
  return { ...data, items: data.items.map(normalizePostItem) }
}

export async function fetchPostMetadata(baseUrl: string): Promise<PostMetadata> {
  return unwrap(
    await $fetch<ApiEnvelope<PostMetadata>>(`${requireBaseUrl(baseUrl)}/posts/metadata`, { timeout: 10000, retry: 0 }),
  )
}

export async function fetchPostNavigation(
  baseUrl: string,
  id: string,
  signal?: AbortSignal,
): Promise<{ prev: RelatedPost | null; next: RelatedPost | null }> {
  return unwrap(
    await $fetch<ApiEnvelope<{ prev: RelatedPost | null; next: RelatedPost | null }>>(
      `${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/navigation`,
      { signal, timeout: 10000, retry: 0 },
    ),
  )
}

export async function fetchRelatedPosts(baseUrl: string, id: string, signal?: AbortSignal): Promise<RelatedPost[]> {
  const data = unwrap(
    await $fetch<ApiEnvelope<RelatedPost[]>>(`${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/related`, {
      signal,
      timeout: 10000,
      retry: 0,
    }),
  )
  return data.map((post) => ({ ...post, date: post.date.slice(0, 10) }))
}

export async function fetchPostInteraction(
  baseUrl: string,
  id: string,
): Promise<{ liked: boolean; likes: number; views: number }> {
  return unwrap(
    await $fetch<ApiEnvelope<{ liked: boolean; likes: number; views: number }>>(
      `${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/interaction`,
      { headers: commentVisitorHeaders(), timeout: 10000, retry: 0 },
    ),
  )
}

export async function recordPostView(baseUrl: string, id: string): Promise<{ views: number }> {
  return unwrap(
    await $fetch<ApiEnvelope<{ views: number }>>(`${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/view`, {
      method: 'POST',
      headers: commentVisitorHeaders(),
      timeout: 10000,
      retry: 0,
    }),
  )
}

export async function togglePostLike(baseUrl: string, id: string): Promise<{ liked: boolean; likes: number }> {
  return unwrap(
    await $fetch<ApiEnvelope<{ liked: boolean; likes: number }>>(
      `${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/like`,
      { method: 'POST', headers: commentVisitorHeaders(), timeout: 10000, retry: 0 },
    ),
  )
}

/** 拉取文章详情(正文块 + TOC) */
export async function fetchArticleDetail(baseUrl: string, id: string, signal?: AbortSignal): Promise<ApiArticleDetail> {
  const base = requireBaseUrl(baseUrl)
  const endpoint = /^\d+$/.test(id) ? `/posts/${encodeURIComponent(id)}` : `/posts/by-slug/${encodeURIComponent(id)}`
  const envelope = await $fetch<ApiEnvelope<ApiArticleDetail>>(`${base}${endpoint}`, {
    signal,
    timeout: 10000,
    retry: 0,
  })
  const detail = unwrap(envelope)
  return { ...detail, date: detail.date.slice(0, 10) }
}

/** 评论 time 为 ISO 串,展示层沿用 mock 的 YYYY-MM-DD 习惯,递归归一化 */
function normalizeComment(item: CommentItem): CommentItem {
  return {
    ...item,
    time: item.time.slice(0, 10),
    replies: item.replies?.map(normalizeComment),
  }
}

/** 拉取文章评论树 */
export async function fetchComments(baseUrl: string, id: string, signal?: AbortSignal): Promise<CommentList> {
  const base = requireBaseUrl(baseUrl)
  const envelope = await $fetch<ApiEnvelope<{ items: CommentItem[]; total: number }>>(
    `${base}/posts/${encodeURIComponent(id)}/comments`,
    { headers: commentVisitorHeaders(), signal, timeout: 10000, retry: 0 },
  )
  const data = unwrap(envelope)
  return { items: data.items.map(normalizeComment), total: data.total }
}

/** SSR 读取不携带设备身份；客户端重新读取以恢复个人点赞状态。 */
function commentVisitorHeaders(): Record<string, string> {
  const visitorId = ensureVisitorId()
  return visitorId ? { 'X-Visitor-Id': visitorId } : {}
}

export async function createComment(baseUrl: string, id: string, draft: CommentDraft): Promise<CommentItem> {
  const envelope = await $fetch<ApiEnvelope<CommentItem>>(
    `${requireBaseUrl(baseUrl)}/posts/${encodeURIComponent(id)}/comments`,
    { method: 'POST', body: draft, headers: commentVisitorHeaders(), timeout: 10000, retry: 0 },
  )
  return normalizeComment(unwrap(envelope))
}

export async function toggleCommentLike(baseUrl: string, id: number): Promise<{ liked: boolean; likes: number }> {
  const envelope = await $fetch<ApiEnvelope<{ liked: boolean; likes: number }>>(
    `${requireBaseUrl(baseUrl)}/comments/${id}/like`,
    { method: 'POST', headers: commentVisitorHeaders(), timeout: 10000, retry: 0 },
  )
  return unwrap(envelope)
}
