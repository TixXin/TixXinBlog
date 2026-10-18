/** @file client-error.module.ts @description 客户端错误模块，无数据库、审计写入或后台任务依赖。 */
import { Module } from '@nestjs/common'
import { ClientErrorController } from './client-error.controller'

@Module({ controllers: [ClientErrorController] })
export class ClientErrorModule {}
