/**
 * @file package.messages.ts
 * @description 内容包解析与结构校验的中英文案汇总
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'
import { packageBaseMessages } from './package-base.messages'
import { packageContentMessages } from './package-content.messages'
import { packageMediaMessages } from './package-media.messages'

/**
 * 字段校验失败统一为「内容包字段不合法：<字段>」。
 * 字段路径（如 posts[0].values）作为 {path} 参数传入；中文字段名不作参数，按字段拆为 package.field* 独立条目。
 */
export const packageMessages = defineMessages({
  ...packageBaseMessages,
  ...packageContentMessages,
  ...packageMediaMessages,
})
