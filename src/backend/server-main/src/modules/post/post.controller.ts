/**
 * @file post.controller.ts
 * @description 文章接口：列表 / 详情 / 点赞切换 / 浏览计数（api.md §7.2）
 * @author TixXin
 * @since 2026-07-20
 */

import { Controller, Get, Param, ParseIntPipe, Post as HttpPost, Query } from '@nestjs/common'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { QueryPostDto } from './dto/query-post.dto'
import { ArticleDetailDto, PostListResult, PostService } from './post.service'

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  list(@Query() query: QueryPostDto): Promise<PostListResult> {
    return this.postService.findMany(query)
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
  addView(@Param('id', ParseIntPipe) id: number, @VisitorIdHash() visitorIdHash: string): Promise<{ views: number }> {
    return this.postService.addView(id, visitorIdHash)
  }
}
