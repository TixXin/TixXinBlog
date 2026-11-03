/**
 * @file og.messages.ts
 * @description 分享卡片的中英文案：卡片左上角的内容类型标签与卡片不存在时的错误
 * @author TixXin
 * @since 2026-11-03
 */
import { defineMessages } from './types'

export const ogMessages = defineMessages({
  'og.kind.post': { zh: '文章', en: 'Post' },
  'og.kind.flash': { zh: '闪念', en: 'Flash note' },
  'og.kind.moment': { zh: '朋友圈', en: 'Moment' },
  'og.notFound': { zh: '分享卡片不存在', en: 'The share card does not exist' },
})
