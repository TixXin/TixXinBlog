/** @file admin-content-relations.controller.ts @description 博主关联选择只读入口；缺失目标不影响源内容编辑。 */
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { QueryContentRelationsDto, ResolveContentRelationsDto } from './content-relations.dto'
import { normalizeContentRelations, resolveContentRelations, searchContentRelations } from './content-relations'
@Controller('admin/content-relations')
@UseGuards(AdminAuthGuard)
export class AdminContentRelationsController {
  constructor(private readonly em: EntityManager) {}
  @Get() list(@Query() query: QueryContentRelationsDto) {
    return searchContentRelations(this.em, query.type, query.q, query.page)
  }
  @Post('resolve') resolve(@Body() input: ResolveContentRelationsDto) {
    return resolveContentRelations(this.em, normalizeContentRelations(input.relatedContent), true)
  }
}
