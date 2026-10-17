/** @file editorial-model.ts @description 四份候选的固定身份、内容投影和阅读关系，维护与首发裁剪共用。 */
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { parsePostMarkdown } from '../modules/post/post-markdown'
import type { ContentRelation } from '../common/types/content-relation'
import { EDITORIAL_DATASET, editorialArticles, editorialProject } from './editorial-content'
import { legacyEditorialArticles, legacyEditorialProject } from './editorial-initial'
export type EditorialKey = (typeof editorialArticles)[number]['key'] | 'tixxinblog'
export const editorialCandidates = [
  ...editorialArticles.map((article) => ({ key: article.key as EditorialKey, kind: 'post' as const })),
  { key: 'tixxinblog' as const, kind: 'project' as const },
]
export type EditorialIds = Record<EditorialKey, number>
export const editorialLedgerKey = (key: EditorialKey) =>
  `${EDITORIAL_DATASET}/${key === 'tixxinblog' ? 'project' : 'post'}/${key}`
export function editorialRelations(ids: EditorialIds, key: EditorialKey): ContentRelation[] {
  const order: Record<EditorialKey, EditorialKey[]> = {
    'content-boundaries': ['editing-recovery', 'backup-boundaries', 'tixxinblog'],
    'editing-recovery': ['backup-boundaries', 'content-boundaries', 'tixxinblog'],
    'backup-boundaries': ['content-boundaries', 'editing-recovery', 'tixxinblog'],
    tixxinblog: ['content-boundaries', 'editing-recovery', 'backup-boundaries'],
  }
  return order[key].map((target) => ({ type: target === 'tixxinblog' ? 'project' : 'post', id: ids[target] }))
}
export function editorialPostInput(key: EditorialKey, relatedContent: ContentRelation[] = [], legacy = false) {
  const article = legacy
    ? legacyEditorialArticles.find((item) => item.key === key)
    : editorialArticles.find((item) => item.key === key)
  if (!article) throw new Error('未知技术草稿')
  const latest = editorialArticles.find((item) => item.key === key)!
  return Object.assign(new SavePostDto(), {
    title: article.title,
    summary: article.summary,
    contentRaw: article.body,
    category: 'tech' as const,
    folder: '博客建设',
    tags: ['TixXinBlog', '工程实践'],
    status: 'draft' as const,
    slug: legacy ? '' : latest.slug,
    pinned: legacy ? false : latest.pinned,
    readTimeMinutes: legacy ? 5 : latest.readTimeMinutes,
    relatedContent,
  })
}
export function editorialPostSnapshot(key: EditorialKey, relatedContent: ContentRelation[] = [], legacy = false) {
  const input = editorialPostInput(key, relatedContent, legacy)
  return {
    relatedContent,
    slug: input.slug ?? '',
    coverAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoNoindex: false,
    title: input.title,
    summary: input.summary,
    cover: '',
    folder: input.folder,
    category: input.category,
    contentRaw: input.contentRaw,
    contentSections: parsePostMarkdown(input.contentRaw),
    readTimeMinutes: input.readTimeMinutes,
    status: input.status,
    pinned: input.pinned,
    tags: [...input.tags].sort(),
  }
}
export function editorialProjectInput(relatedContent: ContentRelation[] = [], legacy = false) {
  const value = legacy ? legacyEditorialProject : editorialProject
  return { ...structuredClone(value), relatedContent }
}
