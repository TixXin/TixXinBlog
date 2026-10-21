/** @file operations.controller.ts @description 管理员运行状态与显式任务重试；只返回脱敏结果，不开放外部启用 */
import { Body, ConflictException, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsIn, IsInt, Min } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { msg } from '../../common/i18n'
import { OperationsService } from './operations.service'

class TaskQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1
}

class RetryTaskDto {
  @IsIn(['failed', 'uncertain', 'restored']) expectedState!: string
  @IsInt() @Min(0) expectedAttempts!: number
  @IsIn(['重试失败任务', '已核对未送达并承担重复投递风险', '明确重新投递恢复前任务']) acknowledgement!: string
}

@Controller('admin/operations')
@UseGuards(AdminAuthGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('tasks/:id')
  async task(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.operationsService.getTask(id)
  }

  @Get()
  async status(@Query() query: TaskQuery) {
    return this.operationsService.getStatus(query.page)
  }

  @Post('tasks/:id/retry')
  async retry(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: RetryTaskDto) {
    const expected =
      body.expectedState === 'uncertain'
        ? '已核对未送达并承担重复投递风险'
        : body.expectedState === 'restored'
          ? '明确重新投递恢复前任务'
          : '重试失败任务'
    if (body.acknowledgement !== expected) throw new ConflictException(msg('operations.retryNotAcknowledged'))
    return this.operationsService.retryTask(id, body.expectedState, body.expectedAttempts)
  }
}
