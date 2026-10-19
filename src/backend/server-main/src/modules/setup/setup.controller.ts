/**
 * @file setup.controller.ts
 * @description 浏览器初始化向导接口：查询是否需要初始化，以及凭一次性令牌创建首个管理员
 * @author TixXin
 * @since 2026-10-19
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { SetupService } from './setup.service'

@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('status')
  status() {
    return this.setup.status()
  }

  /**
   * 请求体声明为 unknown，让全局 ValidationPipe 跳过：接口关闭后任何请求都只得到 404，
   * 参数校验与来源校验在服务内确认接口仍开放之后才执行。限流由全局 RateLimitGuard 按更严格的 setup 配额执行。
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  complete(@Body() body: unknown, @Req() request: Request) {
    return this.setup.complete(body, { origin: request.headers.origin, host: request.headers.host })
  }
}
