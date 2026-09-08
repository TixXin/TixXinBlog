/**
 * @file auth.module.ts
 * @description 鉴权模块装配:JwtModule 全局注册,导出守卫供其它模块使用
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { AdminSession } from '../../entities/admin-session.entity'
import { AuthSessionsService } from './auth-sessions.service'
import { ACCESS_TOKEN_TTL_SECONDS, getAccessSecret } from './auth.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard'

@Module({
  imports: [
    MikroOrmModule.forFeature([AdminUser, RefreshToken, AdminSession]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getAccessSecret(config.get<string>('JWT_ACCESS_SECRET')),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard, AuthOriginGuard, AuthSessionsService],
  exports: [AdminAuthGuard],
})
export class AuthModule {}
