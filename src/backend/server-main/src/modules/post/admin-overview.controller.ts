/** @file admin-overview.controller.ts @description 服务端汇总六域创作与真实互动待办；分区失败不伪装为零。 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { unansweredCommentSql, visibleCommentSql } from '../comment/comment-visibility'
import { unansweredGuestbookSql } from '../guestbook/guestbook-values'

interface RecentContent {
  domain: string
  id: string
  title: string
  status: string
  updatedAt: Date | string
}

@Controller('admin/overview')
@UseGuards(AdminAuthGuard)
export class AdminOverviewController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  async overview() {
    const connection = this.em.getConnection()
    const [counts, recent] = await Promise.allSettled([
      connection.execute<Record<string, number>[]>(`
        select
          (select count(*)::int from post where deleted_at is null) as "posts",
          (select count(*)::int from post where deleted_at is not null) as "trashed",
          (select count(*)::int from post where status='published' and deleted_at is null) as "published",
          (select count(*)::int from post where status='draft' and deleted_at is null) as "drafts",
          (select count(*)::int from post where status='archived' and deleted_at is null) as "archived",
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
            where c.status='pending' and c.deleted_at is null and m.deleted_at is null) as "pendingMomentComments"
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
    ])
    return {
      counts: counts.status === 'fulfilled' ? counts.value[0] : null,
      recentContent:
        recent.status === 'fulfilled'
          ? recent.value.map((item) => ({ ...item, updatedAt: new Date(item.updatedAt).toISOString() }))
          : null,
      unavailable: [
        ...(counts.status === 'rejected' ? ['counts'] : []),
        ...(recent.status === 'rejected' ? ['recentContent'] : []),
      ],
      generatedAt: new Date().toISOString(),
    }
  }
}
