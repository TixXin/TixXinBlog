/**
 * @file comment.module.ts
 * @description 评论模块装配
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { Comment } from '../../entities/comment.entity'
import { CommentLike } from '../../entities/comment-like.entity'
import { Post } from '../../entities/post.entity'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'

@Module({
  imports: [MikroOrmModule.forFeature([Comment, CommentLike, Post])],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
