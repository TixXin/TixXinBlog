/** @file subscription.controller.ts @description 订阅公开白名单读取与受身份/内容上下文保护的博主管理 */
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
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { SubscriptionService } from './subscription.service'
import { SubscriptionFaviconService } from './subscription-favicon.service'
import {
  AdminSubscriptionQuery,
  FetchFaviconDto,
  SaveSubscriptionDto,
  SubscriptionQuery,
  SubscriptionRevisionDto,
  SubscriptionSortDto,
} from './subscription.dto'
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly favicons: SubscriptionFaviconService,
  ) {}
  @Get() list(@Query() query: SubscriptionQuery) {
    return this.subscriptions.list(query)
  }
  @Get('stats') stats(@Query() query: SubscriptionQuery) {
    return this.subscriptions.stats(query)
  }
  @Get('favicons/:key') async favicon(@Param('key') key: string, @Res() response: Response) {
    const image = await this.favicons.read(key)
    response
      .set({
        'Content-Type': 'image/webp',
        'Content-Length': image.length,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      })
      .send(image)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptions.detail(id)
  }
}
@Controller('admin/subscriptions')
@UseGuards(AdminAuthGuard)
export class AdminSubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly favicons: SubscriptionFaviconService,
  ) {}
  @Get() list(@Query() query: AdminSubscriptionQuery) {
    return this.subscriptions.list(query, true)
  }
  @Get('submissions/:requestId') submission(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.subscriptions.submission(requestId)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptions.detail(id, true)
  }
  @Post('fetch-favicon') fetchFavicon(@Body() body: FetchFaviconDto) {
    return this.favicons.fetch(body.url, body.force)
  }
  @Post() create(@Body() body: SaveSubscriptionDto) {
    return this.subscriptions.save(null, body)
  }
  @Patch('sort') sort(@Body() body: SubscriptionSortDto) {
    return this.subscriptions.sort(body)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveSubscriptionDto) {
    return this.subscriptions.save(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: SubscriptionRevisionDto) {
    return this.subscriptions.remove(id, query.revision)
  }
}
