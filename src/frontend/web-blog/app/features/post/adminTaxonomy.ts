/** @file adminTaxonomy.ts @description 后台专栏与标签管理的数据结构与纯规则：写入路径与正文、分类计数、颜色选项与文章筛选跳转 */
import type { Translate } from '~/utils/format'

export type AdminTaxonomyKind = 'folders' | 'tags'

export interface AdminTaxonomyItem {
  id: number
  label: string
  total: number
  published: number
  color?: string
}

export interface AdminTaxonomyData {
  folders: AdminTaxonomyItem[]
  tags: AdminTaxonomyItem[]
  categories: { category: string; total: number }[]
}

export interface AdminTaxonomyGroup {
  kind: AdminTaxonomyKind
  title: string
  empty: string
  items: AdminTaxonomyItem[]
}

const TAG_COLORS = ['sky', 'blue', 'emerald', 'rose', 'orange', 'amber']

export function taxonomyColorOptions(t: Translate) {
  return TAG_COLORS.map((value) => ({ value, label: t(`admin-content.taxonomy.colors.${value}`) }))
}

export function taxonomyGroups(data: AdminTaxonomyData | null, t: Translate): AdminTaxonomyGroup[] {
  return data
    ? [
        {
          kind: 'folders' as const,
          title: t('admin-content.taxonomy.folders'),
          empty: t('admin-content.taxonomy.group.emptyFolders'),
          items: data.folders,
        },
        {
          kind: 'tags' as const,
          title: t('admin-content.taxonomy.tags'),
          empty: t('admin-content.taxonomy.group.emptyTags'),
          items: data.tags,
        },
      ]
    : []
}

export function taxonomyCategoryCount(data: AdminTaxonomyData | null, value: string) {
  return data?.categories.find((item) => item.category === value)?.total ?? 0
}

/** 新建走集合地址 POST，编辑走条目地址 PATCH；仅标签携带颜色 */
export function taxonomyWriteRequest(input: {
  kind: AdminTaxonomyKind
  editingId: number | null
  label: string
  color: string
}) {
  const { kind, editingId, label, color } = input
  return {
    path: `/admin/taxonomy/${kind}${editingId === null ? '' : `/${editingId}`}`,
    method: editingId === null ? ('POST' as const) : ('PATCH' as const),
    body: { label: label.trim(), ...(kind === 'tags' ? { color } : {}) },
  }
}

/** 查看引用文章：专栏按 folder、标签按 tag 筛选文章管理列表 */
export function taxonomyPostsLocation(kind: AdminTaxonomyKind, label: string) {
  return {
    path: '/admin/posts',
    query: kind === 'folders' ? { folder: label } : { tag: label },
  }
}
