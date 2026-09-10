/** @file link.controller.ts @description 友链公开读取和博主管理；无公开申请、探活或抓取路由 */
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
import { LinkService } from './link.service'
import { AdminLinkQuery, LinkQuery, LinkRevisionDto, SaveLinkDto, SaveLinkSettingsDto } from './link.dto'
@Controller('links')
export class LinkController {
  constructor(private readonly links: LinkService) {}
  @Get() list(@Query() query: LinkQuery) {
    return this.links.list(query)
  }
  @Get('metadata') metadata() {
    return this.links.metadata()
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.links.detail(id)
  }
}
@Controller('admin/links')
@UseGuards(AdminAuthGuard)
export class AdminLinkController {
  constructor(private readonly links: LinkService) {}
  @Get() list(@Query() query: AdminLinkQuery) {
    return this.links.list(query, true)
  }
  @Get('settings') settings() {
    return this.links.settings()
  }
  @Patch('settings') saveSettings(@Body() body: SaveLinkSettingsDto) {
    return this.links.saveSettings(body)
  }
  @Get('submissions/:requestId') submission(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.links.submission(requestId)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.links.detail(id, true)
  }
  @Post() create(@Body() body: SaveLinkDto) {
    return this.links.save(null, body)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveLinkDto) {
    return this.links.save(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: LinkRevisionDto) {
    return this.links.remove(id, query.revision)
  }
}
