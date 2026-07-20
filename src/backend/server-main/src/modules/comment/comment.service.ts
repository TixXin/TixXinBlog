/**
 * @file comment.service.ts
 * @description 评论业务:评论树查询、发表(层级/归档校验)、点赞切换
 * @author TixXin
 * @since 2026-07-20
 */

import { UniqueConstraintViolationException } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ErrorCode } from '../../common/constants/error-codes'
import { BusinessException } from '../../common/exceptions/business.exception'
import { Comment, COMMENT_MAX_DEPTH } from '../../entities/comment.entity'
import { CommentLike } from '../../entities/comment-like.entity'
import { Post } from '../../entities/post.entity'
import { buildCommentTree, CommentTreeNode } from './comment-tree'
import { CreateCommentDto } from './dto/create-comment.dto'

/** 域错误码(api.md 附录 A) */
const POST_NOT_FOUND = 1001
const POST_ARCHIVED = 1002
const COMMENT_DEPTH_EXCEEDED = 1003

const DEFAULT_AVATAR = '/avatar.svg'

@Injectable()
export class CommentService {
  constructor(private readonly em: EntityManager) {}

  async getTree(postId: number): Promise<{ items: CommentTreeNode[]; total: number }> {
    const post = await this.em.findOne(Post, { id: postId })
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const comments = await this.em.find(Comment, { post }, { orderBy: { createdAt: 'asc' }, populate: ['parent'] })
    const rows = comments.map((c) => ({
      id: c.id,
      parentId: c.parent?.id ?? null,
      authorName: c.authorSnapshot.name,
      authorAvatar: c.authorSnapshot.avatar,
      content: c.content,
      likes: c.likes,
      isOwner: c.isOwner,
      createdAt: c.createdAt,
    }))
    return { items: buildCommentTree(rows), total: rows.length }
  }

  async create(postId: number, dto: CreateCommentDto, visitorIdHash: string): Promise<CommentTreeNode> {
    const post = await this.em.findOne(Post, { id: postId })
    if (!post || post.status === 'draft') {
      throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
    }
    if (post.status === 'archived') {
      throw new BusinessException(POST_ARCHIVED, '文章已归档,无法评论', HttpStatus.UNPROCESSABLE_ENTITY)
    }

    let parent: Comment | undefined
    if (dto.parentId) {
      parent = (await this.em.findOne(Comment, { id: dto.parentId, post })) ?? undefined
      if (!parent) {
        throw new BusinessException(ErrorCode.NotFound, '父评论不存在', HttpStatus.NOT_FOUND)
      }
      if (parent.depth >= COMMENT_MAX_DEPTH) {
        throw new BusinessException(COMMENT_DEPTH_EXCEEDED, '评论层级超限(最深 3 层)', HttpStatus.CONFLICT)
      }
    }

    const comment = this.em.create(Comment, {
      post,
      parent,
      depth: parent ? parent.depth + 1 : 0,
      authorSnapshot: { name: dto.author, avatar: dto.avatar ?? DEFAULT_AVATAR, visitorIdHash },
      content: dto.content,
      likes: 0,
      isOwner: false,
      createdAt: new Date(),
    })
    post.commentCount += 1
    await this.em.flush()

    return {
      id: comment.id,
      author: comment.authorSnapshot.name,
      avatar: comment.authorSnapshot.avatar,
      content: comment.content,
      time: comment.createdAt.toISOString(),
      likes: 0,
      isOwner: false,
      replies: [],
    }
  }

  async toggleLike(commentId: number, visitorIdHash: string): Promise<{ liked: boolean; likes: number }> {
    const comment = await this.em.findOne(Comment, { id: commentId })
    if (!comment) throw new BusinessException(ErrorCode.NotFound, '评论不存在', HttpStatus.NOT_FOUND)

    const existing = await this.em.findOne(CommentLike, { comment, visitorIdHash })
    if (existing) {
      this.em.remove(existing)
      comment.likes = Math.max(0, comment.likes - 1)
      await this.em.flush()
      return { liked: false, likes: comment.likes }
    }

    try {
      this.em.create(CommentLike, { comment, visitorIdHash, createdAt: new Date() })
      comment.likes += 1
      await this.em.flush()
      return { liked: true, likes: comment.likes }
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        return { liked: true, likes: comment.likes }
      }
      throw error
    }
  }
}
