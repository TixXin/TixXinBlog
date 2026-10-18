/** @file taxonomy.ts @description 标签与专栏公开页的名称路径及接口筛选映射 */
import type { PostSummary } from './types'

export type PostTaxonomyKind = 'tag' | 'category'

export function postTagPath(name: string) {
  return `/tags/${encodeURIComponent(name)}`
}

/** 专栏沿用 folder 名称，不另造 slug 或持久字段。 */
export function postCategoryPath(name: string) {
  return `/categories/${encodeURIComponent(name)}`
}

export function resolvePostTaxonomy(kind: PostTaxonomyKind, name: string, summary: PostSummary) {
  if (kind === 'tag') {
    const tag = summary.tags.find((item) => item.label === name && item.count > 0)
    return tag ? { name: tag.label, tag: tag.slug, folder: null, path: postTagPath(tag.label) } : null
  }
  const category = summary.categories.find((item) => item.name === name && item.count > 0)
  return category
    ? { name: category.name, tag: null, folder: category.name, path: postCategoryPath(category.name) }
    : null
}
