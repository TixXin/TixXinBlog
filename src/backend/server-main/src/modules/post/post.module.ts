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
import { AdminPostService } from './admin-post.service'
import { AdminPostController } from './admin-post.controller'
import { PostDiscoveryService } from './post-discovery.service'
import { AdminOverviewController } from './admin-overview.controller'
import { AdminTaxonomyController } from './admin-taxonomy.controller'
import { AdminTaxonomyService } from './admin-taxonomy.service'
import { PostRevisionsService } from './post-revisions.service'
import { PostBatchService } from './post-batch.service'

@Module({
  imports: [MikroOrmModule.forFeature([Post, PostTag, PostLike, PostView])],
  controllers: [PostController, AdminPostController, AdminOverviewController, AdminTaxonomyController],
  providers: [
    PostService,
    AdminPostService,
    PostDiscoveryService,
    AdminTaxonomyService,
    PostRevisionsService,
    PostBatchService,
  ],
  exports: [AdminPostService],
})
export class PostModule {}
