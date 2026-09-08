/**
 * @file flash.module.ts
 * @description 闪念模块装配
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { FlashComment } from '../../entities/flash-comment.entity'
import { FlashLike } from '../../entities/flash-like.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { FlashController } from './flash.controller'
import { FlashService } from './flash.service'
import { AdminFlashController } from './admin-flash.controller'
import { AdminFlashService } from './admin-flash.service'

@Module({
  imports: [MikroOrmModule.forFeature([FlashNote, FlashComment, FlashLike])],
  controllers: [FlashController, AdminFlashController],
  providers: [FlashService, AdminFlashService],
  exports: [AdminFlashService],
})
export class FlashModule {}
