/** @file types.ts @description 项目公开资料、管理字段与统计契约，项目进展独立于内容发布状态 */
export const projectProgressLabels = { active: '维护中', dev: '开发中', archived: '已归档' } as const
export const projectStatusLabels = { draft: '草稿', published: '已公开', withdrawn: '已撤回' } as const
export const projectTagColors = ['emerald', 'blue', 'amber', 'sky', 'rose', 'slate'] as const
export const projectLinkLabels = { source: '源代码', demo: '在线预览', docs: '文档', download: '下载' } as const
export type ProjectProgress = keyof typeof projectProgressLabels
export type ProjectPublicationStatus = keyof typeof projectStatusLabels
export type ProjectLinkKind = keyof typeof projectLinkLabels
export interface ProjectLinkInput {
  kind: ProjectLinkKind
  href: string
}
export interface ProjectLink extends ProjectLinkInput {
  icon: string
  label: string
}
export interface ProjectTag {
  label: string
  color: (typeof projectTagColors)[number]
}
export interface ProjectItem {
  relatedContent?: import('~/features/content-relation/types').RelatedContentItem[]
  id: number
  title: string
  description: string
  cover: string | null
  width: number | null
  height: number | null
  progress: ProjectProgress
  tags: ProjectTag[]
  links: ProjectLink[]
  publishedAt: string | null
}
export interface ProjectEditable {
  relatedContent?: import('~/features/content-relation/types').ContentRelation[]
  title: string
  description: string
  coverMediaId: string | null
  progress: ProjectProgress
  tags: ProjectTag[]
  links: ProjectLinkInput[]
  status: ProjectPublicationStatus
  sortOrder: number
}
export interface ManagedProject extends ProjectEditable {
  id: number
  cover: string | null
  width: number | null
  height: number | null
  publishedAt: string | null
  revision: number
  createdAt: string
  updatedAt: string
}
export interface ProjectQuery {
  q?: string
  progress?: ProjectProgress
  tag?: string
  page: number
  pageSize: number
}
export interface ProjectPage<T = ProjectItem> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface ProjectStats {
  label: string
  value: string
}
export interface TechStackItem extends ProjectTag {
  count: number
  percent: number
}
export interface ProjectMetadata {
  stats: { projects: number; active: number; dev: number; archived: number; tags: number }
  tags: TechStackItem[]
}
