/** @file operations.module.ts @description 运营查询与通知模块；应用启动不创建循环或发送邮件 */
import { Module } from '@nestjs/common'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { OperationsController } from './operations.controller'
@Module({ controllers: [NotificationController, OperationsController], providers: [NotificationService] })
export class OperationsModule {}
