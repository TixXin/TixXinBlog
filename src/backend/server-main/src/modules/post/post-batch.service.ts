/**
 * @file post-batch.service.ts
 * @description 批量操作先预览再逐项事务执行，范围变化时拒绝该条目并返回明确结果。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { Post } from '../../entities/post.entity'
import { PostRevisionsService } from './post-revisions.service'
import { lockTaxonomy } from './taxonomy-lock'
import { lockMedia } from '../media/media-references'
import { POST_BATCH_ACTIONS } from './dto/batch-post.dto'
import type { PostBatchAction, PreviewPostBatchDto } from './dto/batch-post.dto'
import { PostBatchOperation } from '../../entities/post-batch-operation.entity'
import type { PostBatchImpact, PostBatchPlanItem } from '../../entities/post-batch-operation.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { AdminSession } from '../../entities/admin-session.entity'

type Admin = { id: string; username?: string; sessionVersion: number; sessionId: string }
type Impact = PostBatchImpact

@Injectable()
export class PostBatchService {
  constructor(
    private readonly em: EntityManager,
    private readonly revisions: PostRevisionsService,
  ) {}
  private reason(post: Post, action: PostBatchAction): string {
    if (action === 'delete') return post.deletedAt ? '' : '永久删除仅适用于回收站文章'
    if (action === 'restore') return post.deletedAt || post.status === 'archived' ? '' : '只能恢复回收或归档文章'
    if (post.deletedAt) return '文章已在回收站，请先恢复'
    if (action === 'withdraw' && post.status !== 'published') return '仅已发布文章可撤回'
    if (action === 'archive' && post.status === 'archived') return '文章已经归档'
    return ''
  }
  private async impact(em: EntityManager, post: Post): Promise<Impact> {
    const [row] = await em.execute<Impact[]>(
      `select
      (select count(*)::int from comment where post_id=?) as comments,
      (select count(*)::int from comment_like l join comment c on c.id=l.comment_id where c.post_id=?) as "commentLikes",
      (select count(*)::int from post_revision where post_id=?) as revisions,
      (select count(*)::int from post_address where post_id=?) as addresses,
      (select count(*)::int from media_reference where post_id=?) as "mediaReferences",
      (select count(*)::int from post_like where post_id=?) as likes,
      (select count(*)::int from post_view where post_id=?) as views`,
      Array(7).fill(post.id),
    )
    return row ?? { comments: 0, commentLikes: 0, revisions: 0, addresses: 0, mediaReferences: 0, likes: 0, views: 0 }
  }
  private async fingerprint(em: EntityManager, post: Post, action: PostBatchAction, impact: Impact) {
    // 数量相同也可能换成了另一条记录；永久删除确认绑定实际记录集合。
    const rows =
      action === 'delete'
        ? await em.execute<{ signature: string }[]>(
            `select md5(coalesce(string_agg(fact, ',' order by fact), '')) as signature from (
      select 'comment:' || id::text || ':' || revision::text || ':' || status || ':' || md5(content) as fact from comment where post_id=?
      union all select 'comment-like:' || l.id::text from comment_like l join comment c on c.id=l.comment_id where c.post_id=?
      union all select 'revision:' || id::text from post_revision where post_id=?
      union all select 'address:' || slug from post_address where post_id=?
      union all select 'media:' || id::text from media_reference where post_id=?
      union all select 'like:' || id::text from post_like where post_id=?
      union all select 'view:' || id::text from post_view where post_id=?
    ) affected`,
            Array(7).fill(post.id),
          )
        : []
    return createHash('sha256')
      .update(
        JSON.stringify([
          post.id,
          post.title,
          post.revision,
          post.status,
          post.deletedAt?.toISOString(),
          action === 'delete' ? impact : null,
          rows[0]?.signature,
        ]),
      )
      .digest('hex')
  }
  private result(operation: PostBatchOperation) {
    return {
      preview: this.previewResult(operation),
      ticket: operation.id,
      action: operation.action,
      results: operation.results,
      successCount: operation.results.filter((item) => item.success).length,
      failedCount: operation.results.filter((item) => !item.success).length,
      pendingCount: operation.plan.length - operation.results.length,
      completed: !!operation.finishedAt,
    }
  }
  private previewResult(operation: PostBatchOperation) {
    return {
      ticket: operation.id,
      action: operation.action,
      items: operation.plan.map(({ fingerprint: _fingerprint, ...item }) => item),
      allowedCount: operation.plan.filter((item) => item.allowed).length,
      expiresIn: Math.max(0, Math.floor((operation.expiresAt.getTime() - Date.now()) / 1000)),
    }
  }
  async recent(admin: Admin) {
    const operations = await this.em.find(
      PostBatchOperation,
      { actorId: admin.id, startedAt: { $ne: null } },
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit: 10 },
    )
    return operations.map((item) => ({
      ticket: item.id,
      action: item.action,
      createdAt: item.createdAt.toISOString(),
      count: item.plan.length,
      completed: !!item.finishedAt,
    }))
  }
  async preview(input: PreviewPostBatchDto, admin: Admin) {
    const plan: PostBatchPlanItem[] = []
    for (const selected of input.items) {
      const post = await this.em.findOne(Post, { id: selected.id }, { refresh: true })
      const impact = post
        ? await this.impact(this.em, post)
        : { comments: 0, commentLikes: 0, revisions: 0, addresses: 0, mediaReferences: 0, likes: 0, views: 0 }
      const reason = !post
        ? '文章不存在'
        : post.revision !== selected.revision
          ? '列表版本已过期，请刷新后重新选择'
          : this.reason(post, input.action)
      plan.push({
        id: selected.id,
        title: post?.title ?? '已不存在的文章',
        revision: selected.revision,
        status: post?.status ?? '',
        deleted: !!post?.deletedAt,
        allowed: !reason,
        reason,
        impact,
        fingerprint: post ? await this.fingerprint(this.em, post, input.action, impact) : '',
      })
    }
    const operation = this.em.create(PostBatchOperation, {
      actorId: admin.id,
      actorName: admin.username ?? '管理员',
      sessionVersion: admin.sessionVersion,
      action: input.action,
      plan,
      results: [],
      expiresAt: new Date(Date.now() + 300000),
    })
    await this.em.flush()
    return this.previewResult(operation)
  }
  async get(ticket: string, admin: Admin) {
    const operation = await this.em.findOne(PostBatchOperation, { id: ticket, actorId: admin.id }, { refresh: true })
    if (!operation) throw new NotFoundException('批量操作不存在')
    return this.result(operation)
  }
  async execute(ticket: string, acknowledgement: string | undefined, admin: Admin) {
    const initial = await this.em.findOne(PostBatchOperation, { id: ticket, actorId: admin.id }, { refresh: true })
    if (!initial) throw new NotFoundException('批量操作不存在')
    if (initial.finishedAt) return this.result(initial)
    if (initial.expiresAt <= new Date() || initial.sessionVersion !== admin.sessionVersion)
      throw new BadRequestException('预览已失效，请查看现有结果并重新预览未处理条目')
    const action = initial.action as PostBatchAction
    if (!POST_BATCH_ACTIONS.includes(action)) throw new BadRequestException('无效批量操作')
    if (action === 'delete' && acknowledgement !== '永久删除') throw new BadRequestException('永久删除需要输入确认文字')
    for (const item of initial.plan) {
      await this.em.transactional(async (em) => {
        const operation = await em.findOneOrFail(
          PostBatchOperation,
          { id: ticket, actorId: admin.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
        )
        if (operation.results.some((result) => result.id === item.id)) return
        let result = { id: item.id, success: false, message: item.reason }
        if (item.allowed) {
          try {
            const user = await em.findOne(AdminUser, { id: admin.id }, { refresh: true })
            if (!user || user.sessionVersion !== admin.sessionVersion)
              throw new ConflictException('登录已失效，未执行此条目')
            if (
              !(await em.count(AdminSession, {
                id: admin.sessionId,
                adminUser: admin.id,
                revokedAt: null,
                expiresAt: { $gt: new Date() },
              }))
            )
              throw new ConflictException('会话已撤销或过期，未执行此条目')
            await em.transactional(async (content) => {
              await lockTaxonomy(content)
              await lockMedia(content)
              const post = await content.findOne(
                Post,
                { id: item.id },
                { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
              )
              if (!post) throw new NotFoundException('文章已不存在')
              const impact = await this.impact(content, post)
              if (
                post.revision !== item.revision ||
                (await this.fingerprint(content, post, action, impact)) !== item.fingerprint
              )
                throw new ConflictException('预览后内容或影响范围发生变化，请重新预览')
              const reason = this.reason(post, action)
              if (reason) throw new ConflictException(reason)
              if (action === 'delete') {
                await content.nativeDelete(Post, { id: post.id })
                return
              }
              await content.populate(post, ['tags'])
              await this.revisions.record(content, post, '批量操作前')
              if (action === 'trash') post.deletedAt = new Date()
              if (action === 'restore') post.deletedAt = undefined
              post.status = action === 'archive' ? 'archived' : 'draft'
              post.revision += 1
              post.updatedAt = new Date()
              const reasons = {
                withdraw: '批量撤回',
                archive: '批量归档',
                trash: '移入回收站',
                restore: '恢复为草稿',
                delete: '永久删除',
              }
              await this.revisions.record(content, post, reasons[action])
              await content.flush()
            })
            result = { id: item.id, success: true, message: '已完成' }
          } catch (error) {
            result.message = error instanceof HttpException ? error.message : '处理失败，该条目已回滚，请重试'
          }
        }
        operation.startedAt ??= new Date()
        operation.results = [...operation.results, result]
        if (operation.results.length === operation.plan.length) operation.finishedAt = new Date()
        await em.flush()
      })
    }
    return this.get(ticket, admin)
  }
}
