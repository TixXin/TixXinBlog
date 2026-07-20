/**
 * @file auth.controller.ts
 * @description 鉴权接口:登录 / 刷新 / 登出 / 当前管理员(api.md §7.1)
 * @author TixXin
 * @since 2026-07-20
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { getRefreshCookieOptions, REFRESH_COOKIE_NAME } from './auth.constants'
import { AuthService, LoginResult } from './auth.service'
import { LoginDto } from './dto/login.dto'

/** 响应体形状(refresh token 只走 httpOnly cookie) */
interface AuthPayload {
  accessToken: string
  expiresIn: number
  user: { id: string; username: string }
}

function toPayload(result: LoginResult): AuthPayload {
  return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayload> {
    const result = await this.authService.login(dto.username, dto.password, req.headers['user-agent'])
    res.cookie(REFRESH_COOKIE_NAME, result.refreshTokenPlain, getRefreshCookieOptions())
    return toPayload(result)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthPayload> {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME] ?? ''
    const result = await this.authService.refresh(cookie, req.headers['user-agent'])
    res.cookie(REFRESH_COOKIE_NAME, result.refreshTokenPlain, getRefreshCookieOptions())
    return toPayload(result)
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME]
    await this.authService.logout(cookie)
    res.clearCookie(REFRESH_COOKIE_NAME, { path: getRefreshCookieOptions().path })
    return { ok: true }
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: { id: string }): Promise<{ id: string; username: string; lastLoginAt?: string }> {
    return this.authService.getMe(admin.id)
  }
}
