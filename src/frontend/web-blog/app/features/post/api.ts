/**
 * @file api.ts
 * @description post 域 HTTP 取数:对接 server-main /api/v1/posts,解包统一响应并归一化字段
 * @author TixXin
 * @since 2026-07-20
 *
 * 仅在 runtimeConfig.public.useMockRepo === false 时被调用(见 usePostList / useArticleDetail)。
 * 后端响应契约见 docs/backend/api.md §2 / §7.2。
 */

import type { ArticleDetail, CommentItem, PostItem, TocItem } from './types'

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
    throw new Error('apiBaseUrl 未配置:useMockRepo=false 时必须设置 NUXT_PUBLIC_API_BASE_URL')
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

/** 拉取文章列表(当前数据量 50 篇,单页取全量喂给既有客户端分页/瀑布流) */
export async function fetchPostList(baseUrl: string): Promise<PostItem[]> {
  const base = requireBaseUrl(baseUrl)
  const envelope = await $fetch<ApiEnvelope<ApiPostListData>>(`${base}/posts`, {
    query: { page: 1, pageSize: 100 },
  })
  return unwrap(envelope).items.map(normalizePostItem)
}

/** 拉取文章详情(正文块 + TOC) */
export async function fetchArticleDetail(baseUrl: string, id: string): Promise<ApiArticleDetail> {
  const base = requireBaseUrl(baseUrl)
  const envelope = await $fetch<ApiEnvelope<ApiArticleDetail>>(`${base}/posts/${encodeURIComponent(id)}`)
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
export async function fetchComments(baseUrl: string, id: string): Promise<CommentItem[]> {
  const base = requireBaseUrl(baseUrl)
  const envelope = await $fetch<ApiEnvelope<{ items: CommentItem[]; total: number }>>(
    `${base}/posts/${encodeURIComponent(id)}/comments`,
  )
  return unwrap(envelope).items.map(normalizeComment)
}
