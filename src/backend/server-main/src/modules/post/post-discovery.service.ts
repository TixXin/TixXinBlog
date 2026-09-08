/**
 * @file post-discovery.service.ts
 * @description 公开文章发现入口统一查询：标签/分类统计、归档、相邻文章及推荐
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { visibleCommentSql } from '../comment/comment-visibility'

interface ArchiveRow {
  slug?: string
  seo_noindex?: boolean
  id: number
  title: string
  folder: string
  published_at: Date
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

@Injectable()
export class PostDiscoveryService {
  constructor(private readonly em: EntityManager) {}

  async metadata() {
    const [archive, tags, categories, sums, commentCount, activity] = await Promise.all([
      this.em.execute<ArchiveRow[]>(
        "select id, slug, seo_noindex, title, folder, published_at from post where status = 'published' and deleted_at is null order by published_at desc, id desc",
      ),
      this.em.execute<TagRow[]>(
        "select t.label,t.slug,t.color,count(*)::int as count from post_tag t join post_tag_map m on m.post_tag_id=t.id join post p on p.id=m.post_id where p.status='published' and p.deleted_at is null group by t.id order by count desc,t.label",
      ),
      this.em.execute<CategoryRow[]>(
        "select folder as name,count(*)::int as count from post where status='published' and deleted_at is null group by folder order by count desc,folder",
      ),
      this.em.execute<Array<{ views: number }>>(
        "select coalesce(sum(views),0)::int as views from post where status='published' and deleted_at is null",
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
    ])
    return {
      tags,
      categories,
      activity,
      stats: {
        posts: archive.length,
        views: sums[0]?.views ?? 0,
        comments: commentCount[0]?.count ?? 0,
        tags: tags.length,
        uptimeDays: Math.floor(process.uptime() / 86400),
      },
      archive: archive.map((row) => ({
        id: row.id,
        slug: row.slug,
        seoNoindex: row.seo_noindex,
        title: row.title,
        folder: row.folder,
        date: new Date(row.published_at).toISOString(),
      })),
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
