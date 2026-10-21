/**
 * @file admin-overview.service.ts
 * @description 运营工作台统计服务：查询六域创作、互动待办与近 30 天日趋势，分区失败保持未知状态
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'
import { unansweredCommentSql, visibleCommentSql } from '../comment/comment-visibility'
import { unansweredGuestbookSql } from '../guestbook/guestbook-values'

export interface TrendDay {
  date: string
  content: number
  interactions: number
}

/** 趋势覆盖的天数（含今天） */
const TREND_DAYS = 30

export interface RecentContent {
  domain: string
  id: string
  title: string
  status: string
  updatedAt: Date | string
}

export interface FormattedRecentContent {
  domain: string
  id: string
  title: string
  status: string
  updatedAt: string
}

export interface AdminOverviewData {
  counts: Record<string, number> | null
  recentContent: FormattedRecentContent[] | null
  trends: TrendDay[] | null
  unavailable: string[]
}

@Injectable()
export class AdminOverviewService {
  constructor(private readonly em: EntityManager) {}

  async getOverview(): Promise<AdminOverviewData> {
    const connection = this.em.getConnection()
    const [counts, recent, trends] = await Promise.allSettled([
      connection.execute<Record<string, number>[]>(`
        select
          (select count(*)::int from post where deleted_at is null) as "posts",
          (select count(*)::int from post where deleted_at is not null) as "trashed",
          (select count(*)::int from post where status='published' and deleted_at is null) as "published",
          (select count(*)::int from post where status='draft' and deleted_at is null) as "drafts",
          (select count(*)::int from post where status='archived' and deleted_at is null) as "archived",
          (select coalesce(sum(views),0)::int from post where status='published' and deleted_at is null) as "views",
          (select count(*)::int from comment) as "comments",
          (select count(*)::int from comment where status='pending') as "pendingComments",
          (select count(*)::int from comment where status='spam') as "spamComments",
          (select count(*)::int from comment c join post p on p.id=c.post_id
            where p.status='published' and p.deleted_at is null and ${visibleCommentSql('c')}) as "publicComments",
          (select count(*)::int from comment c where ${unansweredCommentSql('c')}) as "unanswered",
          (select count(*)::int from flash_note) as "flashes",
          (select count(*)::int from flash_note where is_draft and not is_archived) as "flashDrafts",
          (select count(*)::int from moment where deleted_at is null) as "moments",
          (select count(*)::int from moment where status='draft' and deleted_at is null) as "momentDrafts",
          (select count(*)::int from gallery_photo where deleted_at is null) as "gallery",
          (select count(*)::int from gallery_photo where status='draft' and deleted_at is null) as "galleryDrafts",
          (select count(*)::int from project where deleted_at is null) as "projects",
          (select count(*)::int from project where status='draft' and deleted_at is null) as "projectDrafts",
          (select count(*)::int from friend_link where deleted_at is null) as "links",
          (select count(*)::int from friend_link where status='draft' and deleted_at is null) as "linkDrafts",
          (select count(*)::int from guestbook_message where status='pending' and deleted_at is null) as "pendingGuestbook",
          (select count(*)::int from guestbook_message g where ${unansweredGuestbookSql('g')}) as "unansweredGuestbook",
          (select count(*)::int from moment_comment c join moment m on m.id=c.moment_id
            where c.status='pending' and c.deleted_at is null and m.deleted_at is null) as "pendingMomentComments",
          (select count(*)::int from flash_comment where status='pending') as "pendingFlashComments"
      `),
      // 每域先限量再合并，应用端只接收全局最近十二项，不拉取完整内容。
      connection.execute<RecentContent[]>(`
        select * from (
          (select 'post' as domain,id::text,title,status::text,updated_at as "updatedAt"
            from post where deleted_at is null order by updated_at desc,id desc limit 12)
          union all (select 'flash',id,left(content,120),
            case when is_archived then 'archived' when is_draft then 'draft' else 'published' end,updated_at
            from flash_note order by updated_at desc,id desc limit 12)
          union all (select 'moment',id,left(content,120),status,updated_at
            from moment where deleted_at is null order by updated_at desc,id desc limit 12)
          union all (select 'gallery',id::text,title,status,updated_at
            from gallery_photo where deleted_at is null order by updated_at desc,id desc limit 12)
          union all (select 'project',id::text,title,status,updated_at
            from project where deleted_at is null order by updated_at desc,id desc limit 12)
          union all (select 'link',id::text,name,status,updated_at
            from friend_link where deleted_at is null order by updated_at desc,id desc limit 12)
        ) recent order by "updatedAt" desc,domain,id desc limit 12
      `),
      // 每日新建内容（六域）与收到的互动（四类评论与留言），已删除的不计
      connection.execute<TrendDay[]>(`
        with days as (
          select generate_series((now() at time zone 'UTC')::date - ${TREND_DAYS - 1}, (now() at time zone 'UTC')::date, interval '1 day')::date as day
        ),
        since as (select ((now() at time zone 'UTC')::date - ${TREND_DAYS - 1})::timestamp at time zone 'UTC' as at),
        content as (
          select (created_at at time zone 'UTC')::date as day, count(*)::int as total from (
            select created_at from post where deleted_at is null
            union all select created_at from flash_note
            union all select created_at from moment where deleted_at is null
            union all select created_at from gallery_photo where deleted_at is null
            union all select created_at from project where deleted_at is null
            union all select created_at from friend_link where deleted_at is null
          ) items where created_at >= (select at from since) group by 1
        ),
        interactions as (
          select (created_at at time zone 'UTC')::date as day, count(*)::int as total from (
            select created_at from comment
            union all select created_at from moment_comment where deleted_at is null
            union all select created_at from flash_comment
            union all select created_at from guestbook_message where deleted_at is null
          ) items where created_at >= (select at from since) group by 1
        )
        select to_char(d.day,'YYYY-MM-DD') as date, coalesce(c.total,0)::int as content, coalesce(i.total,0)::int as interactions
        from days d left join content c using(day) left join interactions i using(day) order by d.day
      `),
    ])
    return {
      counts: counts.status === 'fulfilled' ? (counts.value[0] ?? null) : null,
      recentContent:
        recent.status === 'fulfilled'
          ? recent.value.map((item) => ({ ...item, updatedAt: new Date(item.updatedAt).toISOString() }))
          : null,
      trends: trends.status === 'fulfilled' ? trends.value : null,
      unavailable: [
        ...(counts.status === 'rejected' ? ['counts'] : []),
        ...(recent.status === 'rejected' ? ['recentContent'] : []),
        ...(trends.status === 'rejected' ? ['trends'] : []),
      ],
    }
  }
}
