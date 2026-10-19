/**
 * @file media.controller.ts
 * @description 管理员媒体上传与资源维护；公开接口只返回规范化后的图片字节，可用 `?w=` 取白名单宽度的变体。
 */
import { msg } from '../../common/i18n'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator'
import type { Request, Response } from 'express'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { MediaService } from './media.service'
import { MAX_IMAGE_BYTES, isMediaVariantWidth } from './media-image'
import type { MediaVariantWidth, UploadedImage } from './media-image'

export class QueryMediaDto {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() @MaxLength(128) search?: string
  @IsOptional() @IsIn(['landscape', 'portrait', 'square']) orientation?: 'landscape' | 'portrait' | 'square'
  @IsOptional() @IsIn(['used', 'unused']) usage?: 'used' | 'unused'
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  deleted: boolean = false
}
export class UploadMediaDto {
  @IsOptional() @IsUUID('4') uploadId?: string
  @IsString() @MaxLength(300) alt: string = ''
}
export class UpdateMediaDto {
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(300) alt?: string
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(1000) description?: string
}

@Controller('admin/media')
@UseGuards(AdminAuthGuard)
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}
  @Get() list(@Query() query: QueryMediaDto) {
    return this.media.list(query)
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      preservePath: true,
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2, fieldSize: 4096, parts: 4 },
    }),
  )
  upload(@UploadedFile() file: UploadedImage | undefined, @Body() body: UploadMediaDto) {
    return this.media.upload(file, body.alt, body.uploadId)
  }
  @Get(':id/references') references(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: QueryMediaDto,
  ) {
    return this.media.references(id, query.page)
  }
  @Patch(':id') update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: UpdateMediaDto) {
    return this.media.update(id, body)
  }
  @Delete(':id') remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.media.remove(id)
  }
  @Post(':id/restore') restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.media.restore(id)
  }
}
@Controller('media')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}
  @Get(':file')
  async read(@Param('file') file: string, @Query('w') w: unknown, @Req() request: Request, @Res() response: Response) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(file))
      throw new NotFoundException(msg('media.notFound'))
    // 只接受白名单宽度，任意宽度会让外部请求无限制地生成缓存文件。
    let width: MediaVariantWidth | undefined
    if (w !== undefined) {
      const value = typeof w === 'string' && /^[1-9][0-9]{2,3}$/.test(w) ? Number(w) : Number.NaN
      if (!isMediaVariantWidth(value)) throw new BadRequestException(msg('media.widthUnsupported'))
      width = value
    }
    const result = await this.media.read(file.slice(0, -5).toLowerCase(), {
      ifNoneMatch: request.get('if-none-match'),
      head: request.method === 'HEAD',
      width,
    })
    // 资源键由 UUID 与内容摘要决定，文件不可变；公开媒体及其变体可长期缓存，删除后由 404 收敛。
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.setHeader('ETag', result.etag)
    if (result.notModified) return response.status(304).end()
    response.type('image/webp').setHeader('Content-Disposition', `inline; filename="${file.toLowerCase()}"`)
    if (request.method === 'HEAD') return response.setHeader('Content-Length', result.byteSize).end()
    response.send(result.content)
  }
}
