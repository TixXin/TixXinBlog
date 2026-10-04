/** @file types.ts @description 图片提示词的公开展示、管理编辑与查询契约 */
export type PromptStatus = 'draft' | 'published'
export type PromptConflictKind = 'revision' | 'context' | 'submission' | 'unknown'
export interface PromptRequestError extends Error {
  statusCode?: number
  conflictKind?: PromptConflictKind
}
export interface ImagePrompt {
  id: number
  title: string
  description: string
  prompt: string
  negativePrompt: string
  model: string
  tags: string[]
  imageUrl: string
  imageAlt: string
  width: number | null
  height: number | null
  sourceUrl: string
  publishedAt: string | null
}
export interface ManagedPrompt extends ImagePrompt {
  mediaId: string | null
  externalImageUrl: string | null
  status: PromptStatus
  revision: number
  createdAt: string
  updatedAt: string
}
export interface PromptForm {
  title: string
  description: string
  prompt: string
  negativePrompt: string
  model: string
  tags: string[]
  imageSource: 'media' | 'external'
  mediaId: string | null
  externalImageUrl: string
  imageAlt: string
  sourceUrl: string
  status: PromptStatus
}
export interface PromptQuery {
  q?: string
  model?: string
  tag?: string
  page: number
  pageSize: number
}
export interface PromptPage<T = ImagePrompt> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface PromptMetadata {
  models: { label: string; count: number }[]
  tags: { label: string; count: number }[]
  stats: { prompts: number; models: number; tags: number }
}
