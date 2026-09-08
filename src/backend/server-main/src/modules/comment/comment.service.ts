/**
 * @file comment.service.ts
 * @description 评论业务:评论树查询、发表(层级/归档校验)、点赞切换
 * @author TixXin
 * @since 2026-07-20
 */

import { LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ErrorCode } from '../../common/constants/error-codes'
import { BusinessException } from '../../common/exceptions/business.exception'
import { Comment, COMMENT_MAX_DEPTH } from '../../entities/comment.entity'
import { CommentLike } from '../../entities/comment-like.entity'
import { Post } from '../../entities/post.entity'
import { buildCommentTree, CommentTreeNode } from './comment-tree'
import { CreateCommentDto } from './dto/create-comment.dto'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { visibleCommentWhere } from './comment-visibility'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'

/** 域错误码(api.md 附录 A) */
const POST_NOT_FOUND = 1001
const POST_ARCHIVED = 1002
const COMMENT_DEPTH_EXCEEDED = 1003

const DEFAULT_AVATAR = '/avatar.svg'

@Injectable()
export class CommentService {
  constructor(private readonly em: EntityManager) {}

  async getTree(postId: number, visitorIdHash = ''): Promise<{ items: CommentTreeNode[]; total: number }> {
    const post = await this.em.findOne(Post, { id: postId })
    if (!post || post.status !== 'published' || post.deletedAt)
      throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const comments = await this.em.find(
      Comment,
      { post, ...visibleCommentWhere() },
      { orderBy: { createdAt: 'asc', id: 'asc' }, populate: ['parent'] },
    )
    const likedRows =
      visitorIdHash && comments.length
        ? await this.em.find(CommentLike, { comment: { $in: comments.map((c) => c.id) }, visitorIdHash })
        : []
    const likedIds = new Set(likedRows.map((like) => like.comment.id))
    const rows = comments.map((c) => ({
      id: c.id,
      parentId: c.parent?.id ?? null,
      authorName: c.authorSnapshot.name,
      authorAvatar: c.authorSnapshot.avatar,
      content: c.content,
      likes: c.likes,
      liked: likedIds.has(c.id),
      isOwner: c.isOwner,
      createdAt: c.createdAt,
    }))
    return { items: buildCommentTree(rows), total: rows.length }
  }

  async create(
    postId: number,
    dto: CreateCommentDto,
    visitorIdHash: string,
    isOwner = false,
  ): Promise<CommentTreeNode> {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const post = await em.findOne(Post, { id: postId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!post || post.status === 'draft' || post.deletedAt) {
        throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
      }
      if (post.status === 'archived') {
        throw new BusinessException(POST_ARCHIVED, '文章已归档,无法评论', HttpStatus.UNPROCESSABLE_ENTITY)
      }

      let parent: Comment | undefined
      if (dto.parentId) {
        parent = (await em.findOne(Comment, { id: dto.parentId, post, ...visibleCommentWhere() })) ?? undefined
        if (!parent) {
          throw new BusinessException(ErrorCode.NotFound, '父评论不存在', HttpStatus.NOT_FOUND)
        }
        if (parent.depth >= COMMENT_MAX_DEPTH) {
          throw new BusinessException(COMMENT_DEPTH_EXCEEDED, '评论层级超限(最深 3 层)', HttpStatus.CONFLICT)
        }
      }

      const policy = await em.findOne(CommentPolicy, { id: 'default' }, { refresh: true })
      const requiresApproval = !isOwner && !!policy?.requireApproval
      const currentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
      const comment = em.create(Comment, {
        status: requiresApproval ? 'pending' : 'published',
        post,
        parent,
        depth: parent ? parent.depth + 1 : 0,
        authorSnapshot: { name: dto.author, avatar: dto.avatar ?? DEFAULT_AVATAR, visitorIdHash },
        content: dto.content,
        likes: 0,
        isOwner,
        createdAt: new Date(),
      })
      // 老种子可能带有展示计数；写入时以真实评论总数校准，并由文章行锁串行保护。
      post.commentCount = currentCount + (requiresApproval ? 0 : 1)
      await em.flush()

      await synchronizeMediaReferences(em, `comment:${comment.id}`, 'comment', [comment.authorSnapshot.avatar], {
        post,
        comment,
      })
      await em.flush()

      return {
        moderationStatus: requiresApproval ? 'pending' : 'published',
        id: comment.id,
        author: comment.authorSnapshot.name,
        avatar: comment.authorSnapshot.avatar,
        content: comment.content,
        time: comment.createdAt.toISOString(),
        likes: 0,
        liked: false,
        isOwner,
        replies: [],
      }
    })
  }

  async toggleLike(commentId: number, visitorIdHash: string): Promise<{ liked: boolean; likes: number }> {
    // 锁定评论行，避免不同访客并发点赞时覆盖计数；取消点赞同样处于事务内。
    return this.em.transactional(async (em) => {
      const target = await em.findOne(Comment, { id: commentId })
      if (!target) throw new BusinessException(ErrorCode.NotFound, '评论不存在', HttpStatus.NOT_FOUND)
      // 与回收和评论管理采用相同的文章→评论锁顺序，未公开内容不能通过点赞接口泄露计数。
      const post = await em.findOne(
        Post,
        { id: target.post.id, status: 'published', deletedAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!post) throw new BusinessException(ErrorCode.NotFound, '评论不存在', HttpStatus.NOT_FOUND)
      const visible = await em.count(Comment, { id: commentId, ...visibleCommentWhere() })
      if (!visible) throw new BusinessException(ErrorCode.NotFound, '评论不存在', HttpStatus.NOT_FOUND)
      const comment = await em.findOne(Comment, { id: commentId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!comment) throw new BusinessException(ErrorCode.NotFound, '评论不存在', HttpStatus.NOT_FOUND)
      const existing = await em.findOne(CommentLike, { comment, visitorIdHash })
      if (existing) {
        em.remove(existing)
        comment.likes = Math.max(0, comment.likes - 1)
      } else {
        em.create(CommentLike, { comment, visitorIdHash, createdAt: new Date() })
        comment.likes += 1
      }
      await em.flush()
      return { liked: !existing, likes: comment.likes }
    })
  }
}
