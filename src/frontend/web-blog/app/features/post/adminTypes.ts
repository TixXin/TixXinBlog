/**
 * @file adminTypes.ts
 * @description 文章编辑契约，与后端 SavePostDto 保持一致
 */
export interface AdminPostDraft {
  slug?: string
  coverAlt?: string
  seoTitle?: string
  seoDescription?: string
  seoNoindex?: boolean
  id?: number
  revision?: number
  savedAt?: string
  deletedAt?: string
  title: string
  summary: string
  cover: string
  folder: string
  category: 'tech' | 'life'
  status: 'draft' | 'published' | 'archived'
  contentRaw: string
  pinned: boolean
  readTimeMinutes: number
  tags: string[]
}
