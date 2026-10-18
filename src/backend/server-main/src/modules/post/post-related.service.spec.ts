/** @file post-related.service.spec.ts @description 相关文章查询的公开边界、加权衰减、专栏补齐与响应兼容性 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { PostDiscoveryService } from './post-discovery.service'

interface RelatedRow {
  id: number
  slug: string | null
  title: string
  folder: string
  published_at: Date | string
}

function serviceFor(
  rows: RelatedRow[] = [],
  current: { id: number; folder: string } | null = { id: 7, folder: '前端开发' },
) {
  const findOne = jest.fn().mockResolvedValue(current)
  const execute = jest.fn().mockResolvedValue(rows)
  const service = new PostDiscoveryService({ findOne, execute } as unknown as EntityManager)
  return { service, findOne, execute }
}

async function relatedQuery(folder = '前端开发') {
  const { service, execute } = serviceFor([], { id: 7, folder })
  await service.related(7)
  // 不连接数据库；检查实际发给 ORM 的查询及绑定值，SQL 执行结果仍需数据库回归确认。
  const [sql, params] = execute.mock.calls[0] as [string, unknown[]]
  return { sql: sql.replace(/\s+/g, ' ').trim(), params, execute }
}

describe('相关文章查询规则', () => {
  it('来源不存在、非公开或已回收时沿用 404，不继续查询候选', async () => {
    const { service, findOne, execute } = serviceFor([], null)
    await expect(service.related(7)).rejects.toBeInstanceOf(NotFoundException)
    expect(findOne).toHaveBeenCalledWith(
      Post,
      { id: 7, status: 'published', deletedAt: null },
      { fields: ['id', 'folder'] },
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('候选统一排除当前文章、草稿、归档及回收文章，最多返回四篇', async () => {
    const { sql, params } = await relatedQuery()
    expect(sql).toContain("where p.status='published' and p.deleted_at is null and p.id<>?")
    expect(sql.endsWith('limit 4')).toBe(true)
    expect(params).toEqual([7, '前端开发', 7, '前端开发'])
  })

  it('按标签编号交集去重计数，每个共同标签三分且同专栏额外两分', async () => {
    const { sql } = await relatedQuery()
    expect(sql).toContain('count(distinct m.post_tag_id)::int as tag_count')
    expect(sql).toContain('join post_tag_map source on source.post_tag_id=m.post_tag_id where source.post_id=?')
    expect(sql).toContain('group by m.post_id')
    expect(sql).toContain('(t.tag_count*3 + case when p.folder=? then 2 else 0 end) /')
    expect(sql).not.toContain('post_tag.count')
  })

  it('分数随发布年龄衰减且保留不足一天的小数差异，未来日期不获得额外加分', async () => {
    const { sql } = await relatedQuery()
    expect(sql).toContain('(1 + greatest(extract(epoch from (current_timestamp-p.published_at)),0) / 86400.0 / 180)')
    expect(sql).not.toContain('p.updated_at')
  })

  it('只纳入共同标签或同专栏候选，无标签文章仍可按专栏补齐', async () => {
    const { sql } = await relatedQuery()
    expect(sql).toContain('coalesce(t.tag_count,0) as tag_count')
    expect(sql).toContain('from post p left join shared_tags t on t.post_id=p.id')
    expect(sql).toContain('and (t.tag_count>0 or p.folder=?)')
  })

  it('标签推荐优先，缺额才按发布时间和编号倒序补齐，不提前截断候选或重复拼接', async () => {
    const { sql, execute } = await relatedQuery()
    expect(sql).toContain('case when t.tag_count>0 then')
    expect(sql).toContain('else 0 end as score')
    expect(sql.endsWith('order by (tag_count>0) desc,score desc,published_at desc,id desc limit 4')).toBe(true)
    expect(sql.match(/\blimit\b/g)).toHaveLength(1)
    expect(sql).not.toMatch(/\bunion\b/)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('专栏名始终使用参数绑定，特殊字符不进入 SQL 模板', async () => {
    const folder = "读书'与笔记"
    const { sql, params } = await relatedQuery(folder)
    expect(sql).not.toContain(folder)
    expect(params).toEqual([7, folder, 7, folder])
  })
})

describe('相关文章响应兼容', () => {
  it('保留查询顺序、字符串编号、原卡片字段与 ISO 日期，不暴露内部评分', async () => {
    const { service } = serviceFor([
      {
        id: 9,
        slug: 'vue-reactivity',
        title: '响应式笔记',
        folder: '前端开发',
        published_at: '2026-10-17T08:00:00+08:00',
      },
      {
        id: 2,
        slug: null,
        title: '类型练习',
        folder: '编程语言',
        published_at: new Date('2026-09-01T00:00:00Z'),
      },
    ])
    expect(await service.related(7)).toEqual([
      {
        id: '9',
        slug: 'vue-reactivity',
        title: '响应式笔记',
        category: '前端开发',
        date: '2026-10-17T00:00:00.000Z',
      },
      {
        id: '2',
        slug: null,
        title: '类型练习',
        category: '编程语言',
        date: '2026-09-01T00:00:00.000Z',
      },
    ])
  })

  it('没有相关候选时返回空数组，不改为全站最新文章', async () => {
    const { service, execute } = serviceFor()
    expect(await service.related(7)).toEqual([])
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('数据库读取失败时保留原错误，不回退伪造推荐', async () => {
    const { service, execute } = serviceFor()
    const error = new Error('读取失败')
    execute.mockRejectedValueOnce(error)
    await expect(service.related(7)).rejects.toBe(error)
  })
})
