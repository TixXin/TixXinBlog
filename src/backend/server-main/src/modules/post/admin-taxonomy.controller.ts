/**
 * @file admin-taxonomy.controller.ts
 * @description 专栏与标签管理，输入校验及管理员鉴权。
 */
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { POST_TAG_COLORS } from '../../entities/post-tag.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import { AdminTaxonomyService } from './admin-taxonomy.service'

export class SaveTaxonomyDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(64)
  label!: string
  @IsOptional() @IsIn(POST_TAG_COLORS) color?: PostTagColor
}
@Controller('admin/taxonomy')
@UseGuards(AdminAuthGuard)
export class AdminTaxonomyController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}
  @Get() list() {
    return this.taxonomy.list()
  }
  @Post(':kind') create(@Param('kind') kind: string, @Body() body: SaveTaxonomyDto) {
    return this.taxonomy.save(kind, null, body)
  }
  @Patch(':kind/:id') update(
    @Param('kind') kind: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SaveTaxonomyDto,
  ) {
    return this.taxonomy.save(kind, id, body)
  }
  @Delete(':kind/:id') remove(@Param('kind') kind: string, @Param('id', ParseIntPipe) id: number) {
    return this.taxonomy.remove(kind, id)
  }
}
