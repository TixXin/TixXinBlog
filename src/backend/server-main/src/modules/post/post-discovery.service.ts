/**
 * @file post-discovery.service.ts
 * @description 公开文章发现入口统一查询：标签/分类统计、归档、相邻文章及推荐
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { visibleCommentSql } from '../comment/comment-visibility'
import type { QueryPostArchiveDto } from './dto/query-post-archive.dto'

interface ArchiveRow {
  slug?: string
  seo_noindex?: boolean
  id: number
  title: string
  folder: string
  published_at: Date | string
  updated_at: Date | string
}
interface TagRow {
  label: string
  slug: string
  color: string
  count: number
}
interface CategoryRow {
  name: string
  count: number
}

function archiveItem(row: ArchiveRow) {
  return {
    id: row.id,
    slug: row.slug,
    seoNoindex: row.seo_noindex,
    title: row.title,
    folder: row.folder,
    date: new Date(row.published_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

/** 内容修订时间：取当前修订快照写入时间，早于发布时间或缺失时回退发布时间（与 PostService.contentUpdatedAt 同口径） */
const CONTENT_UPDATED_AT_SQL = `greatest(p.published_at, coalesce((select r.created_at from post_revision r
  where r.post_id = p.id and r.revision = p.revision), p.published_at)) as updated_at`

/** 从上线日期到今天的整天数，无效或未来日期按 0 */
function siteAgeDays(launchedAt: string | null): number {
  if (!launchedAt) return 0
  const start = Date.parse(`${launchedAt}T00:00:00Z`)
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86400000))
}
@Injectable()
export class PostDiscoveryService {
  constructor(private readonly em: EntityManager) {}

  async metadata(includeArchive = true) {
    const [archive, tags, categories, sums, commentCount, activity, launch] = await Promise.all([
      includeArchive
        ? this.em.execute<ArchiveRow[]>(
            `select p.id, p.slug, p.seo_noindex, p.title, p.folder, p.published_at, ${CONTENT_UPDATED_AT_SQL}
            from post p where p.status = 'published' and p.deleted_at is null order by p.published_at desc, p.id desc`,
          )
        : Promise.resolve(undefined),
      this.em.execute<TagRow[]>(
        "select t.label,t.slug,t.color,count(*)::int as count from post_tag t join post_tag_map m on m.post_tag_id=t.id join post p on p.id=m.post_id where p.status='published' and p.deleted_at is null group by t.id order by count desc,t.label",
      ),
      this.em.execute<CategoryRow[]>(
        "select folder as name,count(*)::int as count from post where status='published' and deleted_at is null group by folder order by count desc,folder",
      ),
      this.em.execute<Array<{ posts: number; views: number }>>(
        "select count(*)::int as posts,coalesce(sum(views),0)::int as views from post where status='published' and deleted_at is null",
      ),
      this.em.execute<Array<{ count: number }>>(
        `select count(*)::int as count from comment c join post p on p.id=c.post_id where p.status='published' and p.deleted_at is null and ${visibleCommentSql('c')}`,
      ),
      this.em.execute<Array<{ date: string; articles: number; comments: number }>>(`
        with days as (select generate_series(date_trunc('week',now() at time zone 'UTC') - interval '98 days', date_trunc('week',now() at time zone 'UTC') + interval '6 days', interval '1 day')::date as day),
        articles as (select (published_at at time zone 'UTC')::date as day,count(*)::int as total from post where status='published' and deleted_at is null and published_at >= (date_trunc('week',now() at time zone 'UTC') - interval '98 days') at time zone 'UTC' group by 1),
        comments as (select (c.created_at at time zone 'UTC')::date as day,count(*)::int as total from comment c join post p on p.id=c.post_id where p.status='published' and p.deleted_at is null and ${visibleCommentSql('c')} and c.created_at >= (date_trunc('week',now() at time zone 'UTC') - interval '98 days') at time zone 'UTC' group by 1)
        select to_char(d.day,'YYYY-MM-DD') as date,coalesce(a.total,0)::int as articles,coalesce(c.total,0)::int as comments from days d left join articles a using(day) left join comments c using(day) order by d.day
      `),
      // 站点上线日期优先取站点资料，未填写时按最早公开文章推算
      this.em.execute<Array<{ launched_at: string | null; first_published: string | null }>>(
        "select nullif(s.values->>'launchedAt','') as launched_at, to_char(min(p.published_at) at time zone 'UTC','YYYY-MM-DD') as first_published from site_settings s left join post p on p.status='published' and p.deleted_at is null where s.id='default' group by s.values",
      ),
    ])
    return {
      tags,
      categories,
      activity,
      stats: {
        posts: sums[0]?.posts ?? 0,
        views: sums[0]?.views ?? 0,
        comments: commentCount[0]?.count ?? 0,
        tags: tags.length,
        siteAgeDays: siteAgeDays(launch[0]?.launched_at ?? launch[0]?.first_published ?? null),
      },
      ...(archive ? { archive: archive.map(archiveItem) } : {}),
    }
  }

  async archive(query: QueryPostArchiveDto) {
    // 分页、筛选总量与所有年份分布来自同一条语句，避免并发发布造成同响应统计矛盾。
    const [result] = await this.em.execute<
      { items: ArchiveRow[]; total: number; years: { year: number; count: number }[] }[]
    >(
      `with public_posts as (
        select p.id,p.slug,p.seo_noindex,p.title,p.folder,p.published_at,${CONTENT_UPDATED_AT_SQL},
          extract(year from p.published_at at time zone 'UTC')::int as year
        from post p where p.status='published' and p.deleted_at is null
      ), selected as (select * from public_posts where (?::int is null or year=?::int)),
      page_items as (select * from selected order by published_at desc,id desc limit ? offset ?),
      year_counts as (select year,count(*)::int as count from public_posts group by year)
      select coalesce((select jsonb_agg(to_jsonb(p) order by published_at desc,id desc) from page_items p),'[]'::jsonb) as items,
        (select count(*)::int from selected) as total,
        coalesce((select jsonb_agg(to_jsonb(y) order by year desc) from year_counts y),'[]'::jsonb) as years`,
      [query.year ?? null, query.year ?? null, query.pageSize, (query.page - 1) * query.pageSize],
    )
    return {
      items: (result?.items ?? []).map(archiveItem),
      total: result?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      years: result?.years ?? [],
    }
  }

  async navigation(id: number) {
    const current = await this.em.findOne(
      Post,
      { id, status: 'published', deletedAt: null },
      { fields: ['id', 'publishedAt'] },
    )
    if (!current) throw new NotFoundException('文章不存在')
    const fields = ['id', 'slug', 'title', 'publishedAt', 'folder'] as const
    const [prev, next] = await Promise.all([
      this.em.findOne(
        Post,
        {
          status: 'published',
          deletedAt: null,
          $or: [{ publishedAt: { $gt: current.publishedAt } }, { publishedAt: current.publishedAt, id: { $gt: id } }],
        },
        { fields: [...fields], orderBy: { publishedAt: 'asc', id: 'asc' } },
      ),
      this.em.findOne(
        Post,
        {
          status: 'published',
          deletedAt: null,
          $or: [{ publishedAt: { $lt: current.publishedAt } }, { publishedAt: current.publishedAt, id: { $lt: id } }],
        },
        { fields: [...fields], orderBy: { publishedAt: 'desc', id: 'desc' } },
      ),
    ])
    const map = (post: Pick<Post, 'id' | 'slug' | 'title' | 'publishedAt' | 'folder'> | null) =>
      post
        ? {
            id: String(post.id),
            slug: post.slug,
            title: post.title,
            date: post.publishedAt.toISOString(),
            category: post.folder,
          }
        : null
    return { prev: map(prev), next: map(next) }
  }

  async related(id: number) {
    const current = await this.em.findOne(
      Post,
      { id, status: 'published', deletedAt: null },
      { fields: ['id', 'folder'] },
    )
    if (!current) throw new NotFoundException('文章不存在')
    const rows = await this.em.execute<ArchiveRow[]>(
      `
      select p.id,p.slug,p.title,p.folder,p.published_at from post p
      where p.status='published' and p.deleted_at is null and p.id<>?
      order by ((case when p.folder=? then 2 else 0 end) +
        (select count(*) from post_tag_map m where m.post_id=p.id and m.post_tag_id in
          (select post_tag_id from post_tag_map where post_id=?))) desc,
        p.published_at desc,p.id desc limit 4`,
      [id, current.folder, id],
    )
    return rows.map((row) => ({
      id: String(row.id),
      slug: row.slug,
      title: row.title,
      category: row.folder,
      date: new Date(row.published_at).toISOString(),
    }))
  }
}
