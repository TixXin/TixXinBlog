/**
 * @file auth.module.ts
 * @description 鉴权模块装配:JwtModule 全局注册,导出守卫供其它模块使用
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { ACCESS_TOKEN_TTL_SECONDS, getAccessSecret } from './auth.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [
    MikroOrmModule.forFeature([AdminUser, RefreshToken]),
    JwtModule.register({
      global: true,
      secret: getAccessSecret(),
      signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard],
  exports: [AdminAuthGuard],
})
export class AuthModule {}
