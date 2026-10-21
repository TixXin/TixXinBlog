/**
 * @file admin-overview.controller.ts
 * @description 服务端汇总六域创作、真实互动待办与近 30 天按日趋势（UTC 日期，新建内容与收到的互动）；
 *              分区失败不伪装为零
 */
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AdminOverviewService } from './admin-overview.service'

@Controller('admin/overview')
@UseGuards(AdminAuthGuard)
export class AdminOverviewController {
  constructor(private readonly overviewService: AdminOverviewService) {}

  @Get()
  async overview() {
    const data = await this.overviewService.getOverview()
    return {
      ...data,
      generatedAt: new Date().toISOString(),
    }
  }
}
