/**
 * @file media.controller.ts
 * @description 管理员媒体上传与资源维护；公开接口只返回规范化后的图片字节。
 */
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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator'
import type { Response } from 'express'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { MediaService } from './media.service'
import { MAX_IMAGE_BYTES } from './media-image'
import type { UploadedImage } from './media-image'

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
  async read(@Param('file') file: string, @Res() response: Response) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(file))
      throw new NotFoundException('媒体不存在')
    const content = await this.media.read(file.slice(0, -5).toLowerCase())
    response.type('image/webp').setHeader('Content-Disposition', `inline; filename="${file.toLowerCase()}"`)
    response.send(content)
  }
}
