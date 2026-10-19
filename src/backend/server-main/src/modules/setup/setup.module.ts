/**
 * @file setup.module.ts
 * @description 浏览器初始化向导模块
 * @author TixXin
 * @since 2026-10-19
 */
import { Module } from '@nestjs/common'
import { SetupController } from './setup.controller'
import { SetupService } from './setup.service'

@Module({
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
