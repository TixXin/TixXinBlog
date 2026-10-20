/**
 * @file setup.module.ts
 * @description 浏览器初始化向导模块
 * @author TixXin
 * @since 2026-10-19
 */
import { Module } from '@nestjs/common'
import { MediaModule } from '../media/media.module'
import { SetupController } from './setup.controller'
import { SetupService } from './setup.service'

@Module({
  imports: [MediaModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
