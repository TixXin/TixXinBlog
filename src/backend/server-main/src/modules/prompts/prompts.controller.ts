/** @file prompts.controller.ts @description 图片提示词公开读取和博主维护，管理请求受会话、来源及内容上下文保护 */
import {
  Body,
  Controller,
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
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard'
import { AdminPromptQuery, PromptQuery, SavePromptDto } from './prompts.dto'
import { PromptsService } from './prompts.service'

@Controller('prompts')
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}
  @Get() list(@Query() query: PromptQuery) {
    return this.prompts.list(query)
  }
  @Get('metadata') metadata() {
    return this.prompts.metadata()
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.prompts.detail(id)
  }
}

@Controller('admin/prompts')
@UseGuards(AdminAuthGuard, AuthOriginGuard)
export class AdminPromptsController {
  constructor(private readonly prompts: PromptsService) {}
  @Get() list(@Query() query: AdminPromptQuery) {
    return this.prompts.list(query, true)
  }
  @Get('submissions/:requestId') submission(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.prompts.submission(requestId)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.prompts.detail(id, true)
  }
  @Post() create(@Body() body: SavePromptDto) {
    return this.prompts.save(null, body)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: SavePromptDto) {
    return this.prompts.save(id, body)
  }
}
