/**
 * @file auth.controller.ts
 * @description 鉴权接口:登录 / 刷新 / 登出 / 当前管理员(api.md §7.1)
 * @author TixXin
 * @since 2026-07-20
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { getRefreshCookieOptions, REFRESH_COOKIE_NAME } from './auth.constants'
import { AuthService, LoginResult } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard'
import { AuthSessionsService } from './auth-sessions.service'
import type { AuditRequest } from '../audit/audit-request'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'
class QuerySessionsDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
}

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
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: AuthSessionsService,
  ) {}

  @Get('sessions')
  @UseGuards(AdminAuthGuard)
  sessionsList(@CurrentAdmin() admin: { id: string; sessionId: string }, @Query() query: QuerySessionsDto) {
    return this.sessions.list(admin.id, admin.sessionId, query.page)
  }
  @Delete('sessions/:id')
  @UseGuards(AdminAuthGuard)
  async revokeSession(
    @CurrentAdmin() admin: { id: string; sessionId: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = id.toLowerCase()
    const result = await this.sessions.revoke(admin.id, sessionId, admin.sessionId)
    if (sessionId === admin.sessionId) res.clearCookie(REFRESH_COOKIE_NAME, { path: getRefreshCookieOptions().path })
    return { ...result, current: sessionId === admin.sessionId }
  }
  @Post('sessions/revoke-others')
  @UseGuards(AdminAuthGuard)
  revokeOthers(@CurrentAdmin() admin: { id: string; sessionId: string }) {
    return this.sessions.revokeOthers(admin.id, admin.sessionId)
  }

  @Get('session')
  async session(@Req() req: Request): Promise<{ authenticated: boolean }> {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME]
    return { authenticated: await this.authService.hasSession(cookie) }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayload> {
    const result = await this.authService.login(dto.username, dto.password, req.headers['user-agent'])
    const auditRequest = req as AuditRequest
    auditRequest.auditActor = { id: result.user.id, name: result.user.username }
    auditRequest.auditResourceId = result.user.id
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
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ ok: true; revoked: number }> {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME]
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined
    const actor = await this.authService.logout(cookie, bearer)
    const auditRequest = req as AuditRequest
    if (actor) {
      auditRequest.auditActor = actor
      auditRequest.auditResourceId = actor.sessionId
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: getRefreshCookieOptions().path })
    return { ok: true, revoked: actor?.revoked ?? 0 }
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: { id: string }): Promise<{ id: string; username: string; lastLoginAt?: string }> {
    return this.authService.getMe(admin.id)
  }
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminAuthGuard)
  async password(
    @CurrentAdmin() admin: { id: string; sessionVersion: number },
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      admin.id,
      admin.sessionVersion,
      body.currentPassword,
      body.newPassword,
    )
    res.clearCookie(REFRESH_COOKIE_NAME, { path: getRefreshCookieOptions().path })
    return result
  }
}
