/**
 * @file audit.module.ts
 * @description 向全局审计守卫与拦截器提供单例存储服务。
 */
import { Global, Module } from '@nestjs/common'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'
@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
