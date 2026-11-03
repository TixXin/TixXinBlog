/**
 * @file og.service.ts
 * @description 分享卡片的数据与缓存：只经公开详情读取文章、闪念、朋友圈与站点资料，草稿、删除与不公开内容随之 404；
 * 卡片文字全部来自后端读到的数据，不接受外部传入文字。头像只读受管媒体，外链头像改用首字母，后端不请求外部地址。
 * 渲染结果按渲染输入的哈希缓存在内存（最多 200 份），哈希同时作为 ETag。
 * @author TixXin
 * @since 2026-11-03
 */
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { MediaService } from '../media/media.service'
import { SiteSettingsService } from '../site/site-settings.service'
import { OgContentService } from './og-content.service'
import { renderOgCard, type OgCardContent } from './og-render'
import { avatarInitial, cleanText, truncateText } from './og-text'
import type { OgKind, OgLocale, OgTheme } from './og-theme'

export interface OgCardRequest {
  theme: OgTheme
  locale: OgLocale
  /** 缺省为站点卡 */
  kind?: OgKind
  id?: string
}

export interface OgCardResult {
  etag: string
  png: Buffer
}

/** 内存缓存上限：按插入顺序淘汰最早的结果 */
export const OG_CACHE_LIMIT = 200
const MANAGED_AVATAR =
  /^\/api\/v1\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp(?:\?.*)?$/i

@Injectable()
export class OgService {
  private readonly cache = new Map<string, Buffer>()

  constructor(
    private readonly contents: OgContentService,
    private readonly site: SiteSettingsService,
    private readonly media: MediaService,
  ) {}

  async card(request: OgCardRequest): Promise<OgCardResult> {
    const settings = await this.site.get(true)
    const siteName = cleanText(settings.name)
    const text = request.kind
      ? await this.contents.text(request.kind, request.id ?? '', request.locale)
      : {
          headline: truncateText(siteName, 40),
          headlineSize: 72,
          body: truncateText(cleanText(settings.description ?? ''), 90) || undefined,
        }
    const avatar = await this.avatar(settings.avatar)
    const name = truncateText(cleanText(request.kind ? siteName : settings.ownerName || siteName), 40)
    const content: OgCardContent = {
      theme: request.theme,
      ...text,
      headline: text.headline || truncateText(siteName, 40),
      name,
      initial: avatarInitial(settings.ownerName || siteName),
      avatar: avatar?.content,
    }
    const key = createHash('sha256')
      .update(JSON.stringify({ ...content, avatar: avatar?.etag ?? null }))
      .digest('hex')
    return { etag: `"og-${key.slice(0, 32)}"`, png: await this.rendered(key, content) }
  }

  /** 受管头像取 320 宽变体；文件缺失或不可读时退回首字母头像 */
  private async avatar(url: string | undefined) {
    const id = url ? MANAGED_AVATAR.exec(url)?.[1] : undefined
    if (!id) return undefined
    try {
      const result = await this.media.read(id.toLowerCase(), { width: 320 })
      return result.content ? { content: result.content, etag: result.etag } : undefined
    } catch {
      return undefined
    }
  }

  private async rendered(key: string, content: OgCardContent) {
    const cached = this.cache.get(key)
    if (cached) {
      // 命中时移到末尾，淘汰顺序近似最近最少使用
      this.cache.delete(key)
      this.cache.set(key, cached)
      return cached
    }
    const png = await renderOgCard(content)
    this.cache.set(key, png)
    if (this.cache.size > OG_CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!)
    return png
  }
}
