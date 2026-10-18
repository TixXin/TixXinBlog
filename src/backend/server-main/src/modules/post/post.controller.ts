/**
 * @file post.controller.ts
 * @description 文章接口：列表 / 详情 / 点赞切换 / 浏览计数（api.md §7.2）
 * @author TixXin
 * @since 2026-07-20
 */

import { Controller, Get, Header, Param, ParseIntPipe, Post as HttpPost, Query } from '@nestjs/common'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { QueryPostDto } from './dto/query-post.dto'
import { QueryPostArchiveDto, QueryPostMetadataDto } from './dto/query-post-archive.dto'
import { QueryPostNavigationDto } from './dto/query-post-navigation.dto'
import { ArticleDetailDto, PostListResult, PostService, PostViewResult } from './post.service'
import { PostDiscoveryService } from './post-discovery.service'

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly discovery: PostDiscoveryService,
  ) {}

  @Get()
  list(@Query() query: QueryPostDto): Promise<PostListResult> {
    return this.postService.findMany(query)
  }

  @Get('metadata')
  metadata(@Query() query: QueryPostMetadataDto) {
    return this.discovery.metadata(query.includeArchive)
  }

  @Get('archive')
  archive(@Query() query: QueryPostArchiveDto) {
    return this.discovery.archive(query)
  }

  @Get('by-slug/:slug')
  bySlug(@Param('slug') slug: string): Promise<ArticleDetailDto> {
    return this.postService.findBySlug(slug)
  }

  @Get(':id/navigation')
  navigation(@Param('id', ParseIntPipe) id: number, @Query() query: QueryPostNavigationDto) {
    return this.discovery.navigation(id, query.scope)
  }

  @Get(':id/related')
  related(@Param('id', ParseIntPipe) id: number) {
    return this.discovery.related(id)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<ArticleDetailDto> {
    return this.postService.findDetail(id)
  }

  @HttpPost(':id/like')
  toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @VisitorIdHash() visitorIdHash: string,
  ): Promise<{ liked: boolean; likes: number }> {
    return this.postService.toggleLike(id, visitorIdHash)
  }

  @HttpPost(':id/view')
  @Header('Cache-Control', 'private, no-store')
  addView(@Param('id', ParseIntPipe) id: number, @VisitorIdHash() visitorIdHash: string): Promise<PostViewResult> {
    return this.postService.addView(id, visitorIdHash)
  }

  @Get(':id/interaction')
  @Header('Cache-Control', 'private, no-store')
  interaction(@Param('id', ParseIntPipe) id: number, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.postService.interaction(id, visitor)
  }
}
