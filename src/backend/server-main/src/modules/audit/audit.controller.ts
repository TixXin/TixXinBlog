/**
 * @file audit.controller.ts
 * @description 管理审计只读检索，不提供修改或删除日志接口。
 */
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AuditService } from './audit.service'
import { auditActions } from './audit-description'
import type { AuditState } from '../../entities/audit-entry.entity'
class QueryAuditDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @IsIn(Object.keys(auditActions)) @IsOptional() action?: string
  @IsIn(['pending', 'success', 'partial', 'failure', 'unknown']) @IsOptional() state?: AuditState
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsOptional() from?: string
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsOptional() to?: string
}
@Controller('admin/audit')
@UseGuards(AdminAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() list(@Query() query: QueryAuditDto) {
    if (query.from && query.to && query.from > query.to) throw new BadRequestException('开始日期不能晚于结束日期')
    return this.audit.list(query)
  }
  @Get('actions') actions() {
    return auditActions
  }
}
