/**
 * @file site.module.ts
 * @description 运行时站点资料模块。
 */
import { Module } from '@nestjs/common'
import { PublicSiteController, AdminSiteController } from './site-settings.controller'
import { SiteSettingsService } from './site-settings.service'
@Module({
  controllers: [PublicSiteController, AdminSiteController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteModule {}
