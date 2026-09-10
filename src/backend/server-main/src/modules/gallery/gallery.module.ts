/** @file gallery.module.ts @description 图库业务模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GalleryController, AdminGalleryController } from './gallery.controller'
import { GalleryService } from './gallery.service'
@Module({
  imports: [AuthModule],
  controllers: [GalleryController, AdminGalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
