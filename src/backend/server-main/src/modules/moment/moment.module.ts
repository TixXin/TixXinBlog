/** @file moment.module.ts @description 朋友圈独立业务装配，复用全局认证、审计与媒体事务 */
import { Module } from '@nestjs/common'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { MomentController } from './moment.controller'
import { AdminMomentController } from './admin-moment.controller'
import { MomentReadService } from './moment-read.service'
import { MomentWriteService } from './moment-write.service'
import { MomentInteractionService } from './moment-interaction.service'

@Module({
  imports: [MikroOrmModule.forFeature([Moment, MomentComment, MomentLike])],
  controllers: [MomentController, AdminMomentController],
  providers: [MomentReadService, MomentWriteService, MomentInteractionService],
  exports: [MomentReadService, MomentWriteService],
})
export class MomentModule {}
