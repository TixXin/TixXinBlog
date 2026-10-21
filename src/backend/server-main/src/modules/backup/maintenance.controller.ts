/**
 * @file maintenance.controller.ts
 * @description 管理员运行诊断与媒体完整性核验，不向公开探针暴露内部连接配置。
 */
import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { RequestLocale } from '../../common/decorators/request-locale.decorator'
import type { ApiLocale } from '../../common/i18n'
import { MaintenanceService } from './maintenance.service'

@Controller('admin/maintenance')
@UseGuards(AdminAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('diagnostics')
  diagnostics() {
    return this.maintenanceService.diagnostics()
  }

  @Post('media-check')
  mediaCheck(@RequestLocale() locale: ApiLocale = 'zh-CN') {
    return this.maintenanceService.mediaCheck(locale)
  }
}
