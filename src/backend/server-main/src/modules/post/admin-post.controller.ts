/**
 * @file admin-post.controller.ts
 * @description 文章管理接口，所有入口统一经过真实管理员 JWT 守卫
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AdminPostService } from './admin-post.service'
import { ExpectedPostRevisionDto, QueryAdminPostsDto, SavePostDto } from './dto/save-post.dto'
import { PostRevisionsService } from './post-revisions.service'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { PostBatchService } from './post-batch.service'
import { ExecutePostBatchDto, PreviewPostBatchDto } from './dto/batch-post.dto'
import { PostPreviewService } from './post-preview.service'
import { RequestLocale } from '../../common/decorators/request-locale.decorator'
import type { ApiLocale } from '../../common/i18n'

@Controller('admin/posts')
@UseGuards(AdminAuthGuard)
export class AdminPostController {
  constructor(
    private readonly posts: AdminPostService,
    private readonly revisions: PostRevisionsService,
    private readonly batch: PostBatchService,
    private readonly previews: PostPreviewService,
  ) {}
  @Get()
  list(@Query() query: QueryAdminPostsDto) {
    return this.posts.list(query)
  }
  @Get('filters')
  filters() {
    return this.posts.filters()
  }
  @Post('batch/preview')
  previewBatch(
    @Body() body: PreviewPostBatchDto,
    @CurrentAdmin() admin: { id: string; sessionVersion: number; sessionId: string },
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.batch.preview(body, admin, locale)
  }
  @Get('batch')
  recentBatches(@CurrentAdmin() admin: { id: string; sessionVersion: number; sessionId: string }) {
    return this.batch.recent(admin)
  }
  @Post('batch/execute')
  executeBatch(
    @Body() body: ExecutePostBatchDto,
    @CurrentAdmin() admin: { id: string; sessionVersion: number; sessionId: string },
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.batch.execute(body.ticket, body.acknowledgement, admin, locale)
  }
  @Get('batch/:ticket')
  batchResult(
    @Param('ticket', new ParseUUIDPipe({ version: '4' })) ticket: string,
    @CurrentAdmin() admin: { id: string; sessionVersion: number; sessionId: string },
    @RequestLocale() locale: ApiLocale,
  ) {
    return this.batch.get(ticket, admin, locale)
  }
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number, @Query() query: ExpectedPostRevisionDto) {
    return this.posts.restore(id, query.revision)
  }
  @Post(':id/preview-link')
  previewLink(@Param('id', ParseIntPipe) id: number) {
    return this.previews.issue(id)
  }
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.posts.detail(id)
  }
  @Post()
  create(@Body() body: SavePostDto) {
    return this.posts.save(null, body)
  }
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SavePostDto) {
    return this.posts.save(id, body)
  }
  @Delete(':id')
  archive(@Param('id', ParseIntPipe) id: number, @Query() query: ExpectedPostRevisionDto) {
    return this.posts.archive(id, query.revision)
  }
  @Get(':id/revisions')
  history(@Param('id', ParseIntPipe) id: number, @Query() query: QueryAdminPostsDto) {
    return this.revisions.list(id, query.page)
  }
  @Post(':id/revisions/:historical/restore')
  restoreRevision(
    @Param('id', ParseIntPipe) id: number,
    @Param('historical', ParseIntPipe) historical: number,
    @Body() body: ExpectedPostRevisionDto,
  ) {
    return this.posts.restoreRevision(id, historical, body.revision)
  }
  @Get(':id/revisions/:revision')
  historyDetail(@Param('id', ParseIntPipe) id: number, @Param('revision', ParseIntPipe) revision: number) {
    return this.revisions.detail(id, revision)
  }
}
