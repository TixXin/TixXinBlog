/**
 * @file og-content.service.ts
 * @description 分享卡片的内容文字：经文章、闪念、朋友圈的公开详情读取，草稿、删除与不公开内容随之 404。
 * 文章取标题，闪念与朋友圈取去掉 Markdown 后的正文前 120 字，日期按服务进程时区格式化。
 * @author TixXin
 * @since 2026-11-03
 */
import { Injectable } from '@nestjs/common'
import { translate } from '../../common/i18n'
import { FlashService } from '../flash/flash.service'
import { MomentReadService } from '../moment/moment-read.service'
import { PostService } from '../post/post.service'
import type { OgCardContent } from './og-render'
import { cardDate, cleanText, markdownToPlain, truncateText } from './og-text'
import type { OgKind, OgLocale } from './og-theme'

export type OgCardText = Pick<OgCardContent, 'label' | 'headline' | 'headlineSize' | 'body' | 'date'>

@Injectable()
export class OgContentService {
  constructor(
    private readonly posts: PostService,
    private readonly flashes: FlashService,
    private readonly moments: MomentReadService,
  ) {}

  async text(kind: OgKind, id: string, locale: OgLocale): Promise<OgCardText> {
    const label = translate(locale, `og.kind.${kind}`)
    if (kind === 'post') {
      const post = await this.posts.findDetail(Number(id))
      return { label, headline: truncateText(cleanText(post.title), 80), headlineSize: 64, date: cardDate(post.date) }
    }
    const note = kind === 'flash' ? await this.flashes.findOne(id) : await this.moments.detail(id)
    return {
      label,
      headline: truncateText(cleanText(markdownToPlain(note.content)), 120),
      headlineSize: 44,
      date: cardDate('createdAt' in note ? note.createdAt : note.date),
    }
  }
}
