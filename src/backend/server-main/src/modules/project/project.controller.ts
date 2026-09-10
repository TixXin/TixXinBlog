/** @file project.controller.ts @description 项目公开读取及博主维护路由，管理写入受身份与内容上下文保护 */
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
import { ProjectService } from './project.service'
import { AdminProjectQuery, ProjectQuery, ProjectRevisionDto, SaveProjectDto } from './project.dto'
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}
  @Get() list(@Query() query: ProjectQuery) {
    return this.projects.list(query)
  }
  @Get('metadata') metadata() {
    return this.projects.metadata()
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.projects.detail(id)
  }
}
@Controller('admin/projects')
@UseGuards(AdminAuthGuard)
export class AdminProjectController {
  constructor(private readonly projects: ProjectService) {}
  @Get() list(@Query() query: AdminProjectQuery) {
    return this.projects.list(query, true)
  }
  @Get('submissions/:requestId') submission(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.projects.submission(requestId)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.projects.detail(id, true)
  }
  @Post() create(@Body() body: SaveProjectDto) {
    return this.projects.save(null, body)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveProjectDto) {
    return this.projects.save(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: ProjectRevisionDto) {
    return this.projects.remove(id, query.revision)
  }
}
