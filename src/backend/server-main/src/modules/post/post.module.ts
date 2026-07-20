/**
 * @file post.module.ts
 * @description 文章模块装配
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { PostLike } from '../../entities/post-like.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { PostView } from '../../entities/post-view.entity'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  imports: [MikroOrmModule.forFeature([Post, PostTag, PostLike, PostView])],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
