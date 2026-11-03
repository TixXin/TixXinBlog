/**
 * @file og.controller.ts
 * @description 公开分享卡片：/og/:theme/:lang/site.png 与 /og/:theme/:lang/:kind/:id.png，返回 1200×630 PNG。
 * 地址各段只接受白名单取值；文章编号为正整数，闪念与朋友圈编号只含字母、数字、下划线与连字符（同时可作静态文件名）。
 * 内容修改后同一地址的图片会变，缓存一天，社交平台按前端地址中的 ?v= 版本参数重新抓取。
 * @author TixXin
 * @since 2026-11-03
 */
import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { msg } from '../../common/i18n'
import { OgService, type OgCardRequest } from './og.service'
import { isOgKind, isOgLocale, isOgTheme } from './og-theme'

const POST_ID = /^[1-9][0-9]{0,9}$/
const NOTE_ID = /^[A-Za-z0-9_-]{1,64}$/

function notFound() {
  return new NotFoundException(msg('og.notFound'))
}

/** 解析地址参数；任何一段不在白名单内都按卡片不存在处理 */
export function parseOgRequest(theme: string, lang: string, kind?: string, file?: string): OgCardRequest {
  if (!isOgTheme(theme) || !isOgLocale(lang)) throw notFound()
  if (kind === undefined) return { theme, locale: lang }
  if (!isOgKind(kind) || !file?.endsWith('.png')) throw notFound()
  const id = file.slice(0, -4)
  const valid = kind === 'post' ? POST_ID.test(id) && Number(id) <= 2147483647 : NOTE_ID.test(id)
  if (!valid) throw notFound()
  return { theme, locale: lang, kind, id }
}

@Controller('og')
export class OgController {
  constructor(private readonly og: OgService) {}

  @Get(':theme/:lang/:file')
  site(
    @Param() params: { theme: string; lang: string; file: string },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (params.file !== 'site.png') throw notFound()
    return this.send(parseOgRequest(params.theme, params.lang), request, response)
  }

  @Get(':theme/:lang/:kind/:file')
  content(
    @Param() params: { theme: string; lang: string; kind: string; file: string },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.send(parseOgRequest(params.theme, params.lang, params.kind, params.file), request, response)
  }

  private async send(card: OgCardRequest, request: Request, response: Response) {
    const result = await this.og.card(card)
    response.setHeader('Cache-Control', 'public, max-age=86400')
    response.setHeader('ETag', result.etag)
    const notModified = (request.get('if-none-match') ?? '')
      .split(',')
      .some((tag) => tag.trim().replace(/^W\//, '') === result.etag)
    if (notModified) return response.status(304).end()
    response.type('image/png')
    if (request.method === 'HEAD') return response.setHeader('Content-Length', result.png.length).end()
    response.send(result.png)
  }
}
