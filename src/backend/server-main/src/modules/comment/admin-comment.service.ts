/**
 * @file admin-comment.service.ts
 * @description 评论管理业务；删除锁定文章并重新计算真实评论总数，避免与新评论竞争
 */
import { FilterQuery, LockMode, raw } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Comment } from '../../entities/comment.entity'
import { Post } from '../../entities/post.entity'
import { hashVisitorId } from '../../common/utils/visitor-id'
import { CommentService } from './comment.service'
import type { CommentStatus } from '../../entities/comment.entity'
import { CommentModerationService } from './comment-moderation.service'
import { unansweredCommentSql, visibleCommentWhere } from './comment-visibility'

@Injectable()
export class AdminCommentService {
  constructor(
    private readonly em: EntityManager,
    private readonly comments: CommentService,
    private readonly moderation: CommentModerationService,
  ) {}
  async list(query: {
    page: number
    pageSize: number
    postId?: number
    search?: string
    unanswered?: string
    status?: CommentStatus
    from?: string
    to?: string
  }) {
    const where: FilterQuery<Comment> = {}
    if (query.from && query.to && query.from > query.to) throw new BadRequestException('开始日期不能晚于结束日期')
    if (query.postId) where.post = query.postId
    if (query.search) where.content = { $ilike: `%${query.search}%` }
    if (query.status) where.status = query.status
    if (query.from || query.to)
      where.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lt: new Date(new Date(query.to).getTime() + 86400000) } : {}),
      }
    if (query.unanswered === 'true') {
      where.$and = [
        { [raw((alias) => `${alias}.id in (select c.id from comment c where ${unansweredCommentSql('c')})`)]: true },
      ]
    }
    const [items, total] = await this.em.findAndCount(Comment, where, {
      populate: ['post'],
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    const visible = new Set(
      (items.length
        ? await this.em.find(
            Comment,
            {
              id: { $in: items.map((item) => item.id) },
              ...visibleCommentWhere(),
              post: { status: 'published', deletedAt: null },
            },
            { fields: ['id'] },
          )
        : []
      ).map((item) => item.id),
    )
    return {
      items: items.map((comment) => ({
        id: comment.id,
        status: comment.status,
        revision: comment.revision,
        visible: visible.has(comment.id),
        author: comment.authorSnapshot.name,
        content: comment.content,
        postId: comment.post.id,
        postTitle: comment.post.title,
        postStatus: comment.post.status,
        postDeleted: !!comment.post.deletedAt,
        parentId: comment.parent?.id ?? null,
        depth: comment.depth,
        isOwner: comment.isOwner,
        createdAt: comment.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async articles() {
    return this.em
      .getConnection()
      .execute<{ id: number; title: string }[]>(
        'select p.id, p.title from post p where exists(select 1 from comment c where c.post_id=p.id) order by p.title, p.id',
      )
  }

  private async subtreeCount(em: EntityManager, id: number): Promise<number> {
    const [result] = await em.getConnection().execute<{ count: number }[]>(
      `with recursive tree as (
      select id from comment where id=? union all select c.id from comment c join tree t on c.parent_id=t.id
    ) select count(*)::int as count from tree`,
      [id],
    )
    return result?.count ?? 0
  }

  async context(id: number, page: number) {
    const target = await this.em.findOne(Comment, { id }, { populate: ['post'] })
    if (!target) throw new NotFoundException('评论不存在')
    const ancestors: Comment[] = []
    let cursor = target
    while (cursor.parent && ancestors.length < 3) {
      const parent = await this.em.findOne(Comment, { id: cursor.parent.id })
      if (!parent) break
      ancestors.unshift(parent)
      cursor = parent
    }
    const [children, total] = await this.em.findAndCount(
      Comment,
      { parent: id },
      {
        orderBy: { createdAt: 'asc', id: 'asc' },
        limit: 20,
        offset: (page - 1) * 20,
      },
    )
    const serialize = (comment: Comment) => ({
      id: comment.id,
      status: comment.status,
      revision: comment.revision,
      author: comment.authorSnapshot.name,
      content: comment.content,
      depth: comment.depth,
      isOwner: comment.isOwner,
      createdAt: comment.createdAt.toISOString(),
    })
    const scope = await this.moderation.scope(this.em, id)
    return {
      target: serialize(target),
      ancestors: ancestors.map(serialize),
      replies: children.map(serialize),
      total,
      page,
      pageSize: 20,
      deleteTotal: scope.total,
      deleteFingerprint: scope.fingerprint,
      visibleTotal: scope.visibleTotal,
      approvedVisibleTotal: scope.approvedVisibleTotal,
      visible: scope.visible,
      post: { id: target.post.id, title: target.post.title, status: target.post.status },
    }
  }

  async remove(id: number, expectedTotal: number | undefined, expectedFingerprint: string) {
    const target = await this.em.findOne(Comment, { id })
    if (!target) throw new NotFoundException('评论不存在')
    return this.em.transactional(async (em) => {
      const post = await em.findOne(Post, { id: target.post.id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!post) throw new NotFoundException('文章不存在')
      const scope = await this.moderation.scope(em, id)
      if (scope.fingerprint !== expectedFingerprint)
        throw new ConflictException('评论或回复范围已变化，请重新查看后确认')
      const deleteTotal = await this.subtreeCount(em, id)
      if (!deleteTotal) throw new NotFoundException('评论不存在')
      if (expectedTotal !== undefined && expectedTotal !== deleteTotal) {
        throw new ConflictException('回复数量已变化，请重新查看删除范围后确认')
      }
      await em.nativeDelete(Comment, { id })
      post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
      await em.flush()
      return { ok: true, deleted: deleteTotal }
    })
  }
  async reply(id: number, raw: string, admin: { id: string; username: string }) {
    const target = await this.em.findOne(Comment, { id })
    if (!target) throw new NotFoundException('评论不存在')
    const content = raw.trim()
    if (!content) throw new BadRequestException('回复不能为空')
    return this.comments.create(
      target.post.id,
      { content, author: admin.username, parentId: id },
      hashVisitorId(`admin:${admin.id}`),
      true,
    )
  }
}
