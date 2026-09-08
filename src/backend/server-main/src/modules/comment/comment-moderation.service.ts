/**
 * @file comment-moderation.service.ts
 * @description 审核只改变选中评论；祖先隐藏使回复不可见，恢复不会复活单独标记的垃圾回复。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { Comment } from '../../entities/comment.entity'
import type { CommentStatus } from '../../entities/comment.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { Post } from '../../entities/post.entity'
import { visibleCommentWhere } from './comment-visibility'
import { lockMedia } from '../media/media-references'
interface ScopeRow {
  id: number
  parentId: number | null
  revision: number
  status: CommentStatus
}

@Injectable()
export class CommentModerationService {
  constructor(private readonly em: EntityManager) {}
  async policy() {
    const value = await this.em.findOneOrFail(CommentPolicy, { id: 'default' })
    return {
      requireApproval: value.requireApproval,
      revision: value.revision,
      updatedAt: value.updatedAt.toISOString(),
      notification: 'not_configured',
    }
  }
  async savePolicy(input: { requireApproval: boolean; revision: number }) {
    await this.em.transactional(async (em) => {
      await lockMedia(em)
      const policy = await em.findOneOrFail(
        CommentPolicy,
        { id: 'default' },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (policy.revision !== input.revision) throw new ConflictException('审核策略已更新，请重新加载后比较')
      policy.requireApproval = input.requireApproval
      policy.revision += 1
      policy.updatedAt = new Date()
      await em.flush()
    })
    return this.policy()
  }
  async scope(em: EntityManager, id: number) {
    const target = await em.findOne(Comment, { id }, { populate: ['post'], refresh: true })
    if (!target) throw new NotFoundException('评论不存在')
    const rows = await em.execute<ScopeRow[]>(
      `with recursive tree as (
      select id,parent_id,revision,status from comment where id=? union all
      select c.id,c.parent_id,c.revision,c.status from comment c join tree t on c.parent_id=t.id
    ) select id,parent_id as "parentId",revision,status from tree order by id`,
      [id],
    )
    if (!rows.length) throw new NotFoundException('评论不存在')
    const ancestors: ScopeRow[] = []
    let parentId = target.parent?.id
    while (parentId && ancestors.length < 3) {
      const parent = await em.findOne(Comment, { id: parentId }, { refresh: true })
      if (!parent) break
      ancestors.push({
        id: parent.id,
        parentId: parent.parent?.id ?? null,
        revision: parent.revision,
        status: parent.status,
      })
      parentId = parent.parent?.id
    }
    const [likes] = await em.execute<{ signature: string }[]>(
      `select md5(coalesce(string_agg(l.id::text, ',' order by l.id),'')) as signature from comment_like l where l.comment_id in (?)`,
      [rows.map((row) => row.id)],
    )
    const map = new Map([...rows, ...ancestors].map((row) => [row.id, row]))
    const visible = (row: ScopeRow, status?: CommentStatus, depth = 0): boolean => {
      if (depth > 2 || (row.id === id && status ? status : row.status) !== 'published') return false
      if (row.parentId === null) return true
      const parent = map.get(row.parentId)
      return !!parent && visible(parent, status, depth + 1)
    }
    const postPublic = target.post.status === 'published' && !target.post.deletedAt
    return {
      target,
      fingerprint: createHash('sha256')
        .update(
          JSON.stringify([
            target.post.id,
            target.post.revision,
            target.post.deletedAt?.toISOString(),
            ancestors,
            rows,
            likes?.signature,
          ]),
        )
        .digest('hex'),
      total: rows.length,
      visibleTotal: postPublic ? rows.filter((row) => visible(row)).length : 0,
      approvedVisibleTotal: postPublic ? rows.filter((row) => visible(row, 'published')).length : 0,
      visible: postPublic && visible(rows.find((row) => row.id === id)!),
    }
  }
  async change(id: number, input: { status: CommentStatus; revision: number; expectedFingerprint: string }) {
    return this.em.transactional(async (em) => {
      const target = await em.findOne(Comment, { id })
      if (!target) throw new NotFoundException('评论不存在')
      const post = await em.findOneOrFail(
        Post,
        { id: target.post.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      const scope = await this.scope(em, id)
      if (scope.fingerprint !== input.expectedFingerprint || scope.target.revision !== input.revision)
        throw new ConflictException('评论状态或回复范围已变化，请重新查看影响后确认')
      scope.target.status = input.status
      scope.target.revision += 1
      scope.target.moderatedAt = new Date()
      await em.flush()
      post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
      await em.flush()
      return {
        ok: true,
        status: scope.target.status,
        revision: scope.target.revision,
        publicComments: post.commentCount,
      }
    })
  }
}
