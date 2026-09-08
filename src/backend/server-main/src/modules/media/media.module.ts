/**
 * @file media.module.ts
 * @description 媒体模块，以存储接口绑定默认本地目录实现。
 */
import { Module } from '@nestjs/common'
import { AdminMediaController, PublicMediaController } from './media.controller'
import { MediaService } from './media.service'
import { LocalMediaStorage, MediaStorage } from './media-storage'
@Module({
  controllers: [AdminMediaController, PublicMediaController],
  providers: [MediaService, { provide: MediaStorage, useClass: LocalMediaStorage }],
  exports: [MediaStorage],
})
export class MediaModule {}
