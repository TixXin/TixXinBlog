/** @file link.module.ts @description 真实友链和独立规则模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { LinkController, AdminLinkController } from './link.controller'
import { LinkService } from './link.service'
@Module({ imports: [AuthModule], controllers: [LinkController, AdminLinkController], providers: [LinkService] })
export class LinkModule {}
