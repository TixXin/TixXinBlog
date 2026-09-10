/** @file gallery.controller.ts @description 图库公开读取与认证管理路由分离 */
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
import { GalleryService } from './gallery.service'
import {
  AdminGalleryQuery,
  GalleryQuery,
  GalleryRevisionDto,
  SaveGalleryDto,
  SaveGallerySettingsDto,
} from './gallery.dto'

@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get() list(@Query() query: GalleryQuery) {
    return this.gallery.list(query)
  }
  @Get('metadata') metadata() {
    return this.gallery.metadata()
  }
  @Get(':id/navigation') navigation(@Param('id', ParseIntPipe) id: number, @Query() query: GalleryQuery) {
    return this.gallery.navigation(id, query)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.gallery.detail(id)
  }
}
@Controller('admin/gallery')
@UseGuards(AdminAuthGuard)
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get('settings') settings() {
    return this.gallery.settings()
  }
  @Patch('settings') saveSettings(@Body() body: SaveGallerySettingsDto) {
    return this.gallery.saveSettings(body)
  }
  @Get() list(@Query() query: AdminGalleryQuery) {
    return this.gallery.list(query, true)
  }
  @Get('submissions/:requestId') submission(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.gallery.submission(requestId)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.gallery.detail(id, true)
  }
  @Post() create(@Body() body: SaveGalleryDto) {
    return this.gallery.save(null, body)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveGalleryDto) {
    return this.gallery.save(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: GalleryRevisionDto) {
    return this.gallery.remove(id, query.revision)
  }
}
