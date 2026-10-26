/** @file link-application.controller.ts @description 友链申请的公开提交与博主审核路由；服务器只保存文本，不探活或抓取申请地址 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { ContentWriteContextGuard } from '../../common/guards/content-write-context.guard'
import { validateVisitorSubmission } from '../../common/validation/visitor-submission'
import { AdminLinkApplicationQuery, CreateLinkApplicationDto } from './link-application.dto'
import { LinkApplicationService } from './link-application.service'
const applicationId = new ParseUUIDPipe({ version: '4' })
@Controller('links/applications')
export class LinkApplicationController {
  constructor(private readonly applications: LinkApplicationService) {}
  @Get('status') status() {
    return this.applications.status()
  }
  @Post() @UseGuards(ContentWriteContextGuard) submit(@Body() body: CreateLinkApplicationDto) {
    return this.applications.submit(validateVisitorSubmission(body))
  }
}
/** 需在 AdminLinkController 之前注册，避免 `admin/links/:id` 先匹配申请列表路径 */
@Controller('admin/links/applications')
@UseGuards(AdminAuthGuard)
export class AdminLinkApplicationController {
  constructor(private readonly applications: LinkApplicationService) {}
  @Get() list(@Query() query: AdminLinkApplicationQuery) {
    return this.applications.list(query)
  }
  @Get(':id') detail(@Param('id', applicationId) id: string) {
    return this.applications.detail(id)
  }
  @Post(':id/approve') approve(@Param('id', applicationId) id: string) {
    return this.applications.approve(id)
  }
  @Post(':id/reject') reject(@Param('id', applicationId) id: string) {
    return this.applications.reject(id)
  }
}
