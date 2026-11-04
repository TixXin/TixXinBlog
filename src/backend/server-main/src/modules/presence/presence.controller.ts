/**
 * @file presence.controller.ts
 * @description 公开心跳接口与后台开关接口。心跳不要求登录：携带有效博主访问令牌时记为博主在线，
 *   令牌缺失、过期或无效都按普通访客处理，不返回错误。
 */
import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { isUUID } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import type { AccessTokenPayload } from '../auth/auth.service'
import { isAutomatedClient, PresenceHeartbeatDto, SavePresenceSettingsDto } from './presence.dto'
import { PresenceService } from './presence.service'

@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
  ) {}

  @Post()
  @HttpCode(200)
  async heartbeat(
    @Body() body: PresenceHeartbeatDto,
    @VisitorIdHash({ optional: true }) visitorHash: string,
    @Req() request: Request,
  ) {
    return this.presence.heartbeat(body, {
      visitorHash,
      isOwner: await this.isOwner(request.headers.authorization),
      automated: isAutomatedClient(request.headers['user-agent']),
    })
  }

  /** 只校验访问令牌签名与有效期，不查会话表：心跳频繁，退出后最多在令牌到期前仍显示在线 */
  private async isOwner(header: string | undefined): Promise<boolean> {
    if (!header?.startsWith('Bearer ')) return false
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice('Bearer '.length))
      return typeof payload.sub === 'string' && isUUID(payload.sub)
    } catch {
      return false
    }
  }
}

@Controller('admin/presence')
@UseGuards(AdminAuthGuard)
export class AdminPresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get() settings() {
    return this.presence.settings()
  }

  @Patch() save(@Body() body: SavePresenceSettingsDto) {
    return this.presence.saveSettings(body)
  }
}
