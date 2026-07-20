/**
 * @file comment.controller.ts
 * @description 评论接口:评论树 / 发表评论 / 评论点赞(api.md §7.2)
 * @author TixXin
 * @since 2026-07-20
 */

import { Body, Controller, Get, Param, ParseIntPipe, Post as HttpPost } from '@nestjs/common'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { CommentService } from './comment.service'
import { CommentTreeNode } from './comment-tree'
import { CreateCommentDto } from './dto/create-comment.dto'

@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('posts/:id/comments')
  tree(@Param('id', ParseIntPipe) postId: number): Promise<{ items: CommentTreeNode[]; total: number }> {
    return this.commentService.getTree(postId)
  }

  @HttpPost('posts/:id/comments')
  create(
    @Param('id', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
    @VisitorIdHash() visitorIdHash: string,
  ): Promise<CommentTreeNode> {
    return this.commentService.create(postId, dto, visitorIdHash)
  }

  @HttpPost('comments/:id/like')
  toggleLike(
    @Param('id', ParseIntPipe) commentId: number,
    @VisitorIdHash() visitorIdHash: string,
  ): Promise<{ liked: boolean; likes: number }> {
    return this.commentService.toggleLike(commentId, visitorIdHash)
  }
}
