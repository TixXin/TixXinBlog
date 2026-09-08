/**
 * @file site-settings.controller.ts
 * @description 公开站点资料读取与管理员版本化修改；部署配置不属于该接口。
 */
import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { SiteSettingsService } from './site-settings.service'
import { ExpectedSiteRevisionDto, SaveSiteSettingsDto } from './site-settings.dto'
class SiteHistoryQuery {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1
}
@Controller('site')
export class PublicSiteController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() @Header('Cache-Control', 'no-store') async get(@Res({ passthrough: true }) response: Response) {
    response.setHeader('X-Content-Context', (await this.settings.context()).generation)
    return this.settings.get()
  }
}
@Controller('admin/site')
@UseGuards(AdminAuthGuard)
export class AdminSiteController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() {
    return this.settings.get()
  }
  @Patch() save(@Body() input: SaveSiteSettingsDto) {
    return this.settings.save(input)
  }
  @Get('revisions') history(@Query() query: SiteHistoryQuery) {
    return this.settings.history(query.page)
  }
  @Get('revisions/:revision') historical(@Param('revision', ParseIntPipe) revision: number) {
    return this.settings.historical(revision)
  }
  @Post('revisions/:revision/restore') restore(
    @Param('revision', ParseIntPipe) revision: number,
    @Body() input: ExpectedSiteRevisionDto,
  ) {
    return this.settings.restore(revision, input.revision)
  }
}
