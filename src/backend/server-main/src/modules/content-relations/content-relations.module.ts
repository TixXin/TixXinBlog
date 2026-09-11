/** @file content-relations.module.ts @description 三域内容关联选择入口复用现有博主认证。 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminContentRelationsController } from './admin-content-relations.controller'
@Module({ imports: [AuthModule], controllers: [AdminContentRelationsController] })
export class ContentRelationsModule {}
