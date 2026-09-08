/**
 * @file flash.controller.ts
 * @description 闪念接口:列表 / 搜索 / 详情 / 点赞 / 评论(api.md §7.6;admin CRUD 与 ai-search 后续补充)
 * @author TixXin
 * @since 2026-07-20
 */

import { Body, Controller, Get, Param, Post as HttpPost, Query } from '@nestjs/common'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { CreateFlashCommentDto } from './dto/create-flash-comment.dto'
import { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'
import { FlashListResult, FlashNoteDto, FlashService } from './flash.service'

@Controller('flashes')
export class FlashController {
  constructor(private readonly flashService: FlashService) {}

  @Get()
  list(@Query() query: QueryFlashDto, @VisitorIdHash({ optional: true }) visitor: string): Promise<FlashListResult> {
    return this.flashService.findMany(query, visitor)
  }

  /** 注意:静态路由必须先于 :id 声明,否则 search 会被当作 id 匹配 */
  @Get('search')
  search(@Query() query: SearchFlashDto, @VisitorIdHash({ optional: true }) visitor: string): Promise<FlashListResult> {
    return this.flashService.search(query, visitor)
  }

  @Get(':id')
  detail(@Param('id') id: string, @VisitorIdHash({ optional: true }) visitor: string): Promise<FlashNoteDto> {
    return this.flashService.findOne(id, visitor)
  }

  @HttpPost(':id/like')
  toggleLike(
    @Param('id') id: string,
    @VisitorIdHash() visitorIdHash: string,
  ): Promise<{ liked: boolean; likes: number }> {
    return this.flashService.toggleLike(id, visitorIdHash)
  }

  @HttpPost(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateFlashCommentDto,
    @VisitorIdHash() visitorIdHash: string,
  ): Promise<FlashNoteDto['comments'][number]> {
    return this.flashService.addComment(id, dto, visitorIdHash)
  }
}
