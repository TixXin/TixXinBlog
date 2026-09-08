/**
 * @file admin-overview.controller.ts
 * @description 真实内容概览与待回复数量，仅管理员可读。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { Post } from '../../entities/post.entity'
import { visibleCommentSql } from '../comment/comment-visibility'

@Controller('admin/overview')
@UseGuards(AdminAuthGuard)
export class AdminOverviewController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  async overview() {
    const [counts] = await this.em.getConnection().execute(`
      select
        (select count(*)::int from post where deleted_at is null) as "posts",
        (select count(*)::int from post where deleted_at is not null) as "trashed",
        (select count(*)::int from post where status = 'published' and deleted_at is null) as "published",
        (select count(*)::int from post where status = 'draft' and deleted_at is null) as "drafts",
        (select count(*)::int from post where status = 'archived' and deleted_at is null) as "archived",
        (select count(*)::int from comment) as "comments",
        (select count(*)::int from comment where status='pending') as "pendingComments",
        (select count(*)::int from comment where status='spam') as "spamComments",
        (select count(*)::int from comment c join post p on p.id=c.post_id where p.status='published' and p.deleted_at is null and ${visibleCommentSql('c')}) as "publicComments",
        (select count(*)::int from flash_note) as "flashes",
        (select count(*)::int from flash_note where is_draft and not is_archived) as "flashDrafts",
        (select count(*)::int from comment c join post p on p.id = c.post_id
          where p.status = 'published' and p.deleted_at is null and ${visibleCommentSql('c')} and c.parent_id is null and not c.is_owner
          and not exists (select 1 from comment r where r.parent_id = c.id and r.is_owner and ${visibleCommentSql('r')})) as "unanswered"
    `)
    const recent = await this.em.find(
      Post,
      { deletedAt: null },
      {
        fields: ['id', 'title', 'status', 'updatedAt'],
        orderBy: { updatedAt: 'desc', id: 'desc' },
        limit: 6,
      },
    )
    return {
      counts,
      recentPosts: recent.map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        updatedAt: post.updatedAt.toISOString(),
      })),
    }
  }
}
