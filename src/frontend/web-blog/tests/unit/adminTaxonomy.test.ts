/** @file adminTaxonomy.test.ts @description 后台专栏与标签纯规则：写入路径与正文、分类计数、分组、颜色选项与文章筛选跳转 */
import { describe, expect, it } from 'vitest'
import {
  taxonomyCategoryCount,
  taxonomyColorOptions,
  taxonomyGroups,
  taxonomyPostsLocation,
  taxonomyWriteRequest,
} from '../../app/features/post/adminTaxonomy'

const t = (key: string) => `t:${key}`
const data = {
  categories: [
    { category: 'tech', total: 3 },
    { category: 'life', total: 0 },
  ],
  folders: [{ id: 1, label: '前端开发', total: 2, published: 1 }],
  tags: [{ id: 2, label: '徒步', total: 0, published: 0, color: 'emerald' }],
}

describe('后台专栏与标签纯规则', () => {
  it('新建 POST 集合地址，编辑 PATCH 条目地址；名称去空白且仅标签带颜色', () => {
    expect(taxonomyWriteRequest({ kind: 'folders', editingId: null, label: '  随笔 ', color: 'sky' })).toEqual({
      path: '/admin/taxonomy/folders',
      method: 'POST',
      body: { label: '随笔' },
    })
    expect(taxonomyWriteRequest({ kind: 'tags', editingId: 0, label: '徒步', color: 'rose' })).toEqual({
      path: '/admin/taxonomy/tags/0',
      method: 'PATCH',
      body: { label: '徒步', color: 'rose' },
    })
  })

  it('分类计数缺失或未读取时为 0', () => {
    expect(taxonomyCategoryCount(data, 'tech')).toBe(3)
    expect(taxonomyCategoryCount(data, 'life')).toBe(0)
    expect(taxonomyCategoryCount(data, 'other')).toBe(0)
    expect(taxonomyCategoryCount(null, 'tech')).toBe(0)
  })

  it('分组按专栏、标签顺序给出标题与空状态，未读取时为空', () => {
    expect(taxonomyGroups(data, t)).toEqual([
      {
        kind: 'folders',
        title: 't:admin-content.taxonomy.folders',
        empty: 't:admin-content.taxonomy.group.emptyFolders',
        items: data.folders,
      },
      {
        kind: 'tags',
        title: 't:admin-content.taxonomy.tags',
        empty: 't:admin-content.taxonomy.group.emptyTags',
        items: data.tags,
      },
    ])
    expect(taxonomyGroups(null, t)).toEqual([])
  })

  it('颜色选项保持固定顺序，查看文章按专栏或标签筛选', () => {
    expect(taxonomyColorOptions(t).map((option) => option.value)).toEqual([
      'sky',
      'blue',
      'emerald',
      'rose',
      'orange',
      'amber',
    ])
    expect(taxonomyColorOptions(t)[0]!.label).toBe('t:admin-content.taxonomy.colors.sky')
    expect(taxonomyPostsLocation('folders', '前端开发')).toEqual({
      path: '/admin/posts',
      query: { folder: '前端开发' },
    })
    expect(taxonomyPostsLocation('tags', '徒步')).toEqual({ path: '/admin/posts', query: { tag: '徒步' } })
  })
})
