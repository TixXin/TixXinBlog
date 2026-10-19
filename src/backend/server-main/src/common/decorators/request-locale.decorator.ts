/**
 * @file request-locale.decorator.ts
 * @description 注入请求的接口语言（按 Accept-Language 解析，只认 zh-CN 与 en，缺省中文）
 * @author TixXin
 * @since 2026-10-19
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { requestLocale, type ApiLocale } from '../i18n'

export const RequestLocale = createParamDecorator((_data: unknown, ctx: ExecutionContext): ApiLocale =>
  requestLocale(ctx.switchToHttp().getRequest()),
)
