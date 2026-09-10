/**
 * @file backup.controller.ts
 * @description 内容包下载和有期限的导入预览/确认，所有入口需要真实管理员。
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsString, IsUUID, Matches } from 'class-validator'
import type { Response } from 'express'
import { randomUUID } from 'node:crypto'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { ContentExportService } from './content-export.service'
import { ContentImportService } from './content-import.service'
import { MAX_PACKAGE_BYTES } from './content-package'
type Admin = { id: string; sessionVersion: number; sessionId: string }
class ExportContentDto {
  @IsBoolean() mediaIncluded: boolean = true
}
class PreviewContentDto {
  @IsUUID('4') requestId!: string
  @IsIn(['skip', 'copy']) strategy: 'skip' | 'copy' = 'skip'
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  includeSettings: boolean = false
}
class ExecuteContentDto {
  @IsString() @IsIn(['导入为新草稿']) acknowledgement!: string
  @IsString() @Matches(/^[a-f0-9]{64}$/) confirmation!: string
}
@Controller('admin/backup')
@UseGuards(AdminAuthGuard)
export class BackupController {
  constructor(
    private readonly exporter: ContentExportService,
    private readonly importer: ContentImportService,
  ) {}
  @Post('export')
  async export(@Body() body: ExportContentDto, @Res() response: Response) {
    const content = await this.exporter.snapshot(body.mediaIncluded)
    const id = randomUUID()
    response
      .type('application/json; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="tixxin-content-${new Date().toISOString().slice(0, 10)}-${id.slice(0, 8)}.json"`,
      )
    response.send(JSON.stringify(content))
    // 手动响应只返回计数给内部审计拦截器，不将内容包正文交给日志处理。
    return {
      id,
      exportedPosts: content.posts.length,
      exportedFlashes: content.flashes.length,
      exportedMoments: content.moments.length,
      exportedGuestbook: content.guestbook.length,
      exportedGallery: content.gallery.length,
      exportedProjects: content.projects.length,
      exportedMedia: body.mediaIncluded ? content.media.length : 0,
    }
  }
  @Post('imports/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      preservePath: true,
      limits: { fileSize: MAX_PACKAGE_BYTES, files: 1, fields: 3, parts: 5, fieldSize: 1024 },
    }),
  )
  preview(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Body() body: PreviewContentDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.importer.preview(file, body, admin)
  }
  @Get('imports') recent(@CurrentAdmin() admin: Admin) {
    return this.importer.recent(admin)
  }
  @Get('imports/:id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentAdmin() admin: Admin) {
    return this.importer.get(id, admin)
  }
  @Post('imports/:id/repreview') repreview(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.importer.repreview(id, admin)
  }
  @Post('imports/:id/execute') async execute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ExecuteContentDto,
    @CurrentAdmin() admin: Admin,
  ) {
    const value = await this.importer.execute(id, body.acknowledgement, body.confirmation, admin)
    return {
      ...value,
      importedPosts: value.result?.posts.length ?? 0,
      importedFlashes: value.result?.flashes.length ?? 0,
      importedMoments: value.result?.moments?.length ?? 0,
      importedGuestbook: value.result?.guestbook?.length ?? 0,
      importedGallery: value.result?.gallery?.length ?? 0,
      importedProjects: value.result?.projects?.length ?? 0,
      importedComments: value.result?.comments ?? 0,
      importedMedia: value.result?.media ?? 0,
    }
  }
}
