/** @file project.module.ts @description 真实项目业务模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ProjectController, AdminProjectController } from './project.controller'
import { ProjectService } from './project.service'
@Module({
  imports: [AuthModule],
  controllers: [ProjectController, AdminProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
