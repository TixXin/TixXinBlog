/**
 * @file types.ts
 * @description 后端中英字典的条目结构：每个 key 同时给出中文原文与英文译文，可选登记稳定的业务错误码
 * @author TixXin
 * @since 2026-10-19
 */
import type { ErrorCode } from '../../constants/error-codes'

export interface MessageEntry {
  /** 中文原文；与迁移前的接口文案逐字一致，未带 Accept-Language 时原样返回 */
  zh: string
  /** 英文译文；具名占位符与中文完全相同 */
  en: string
  /** 普通 HttpException 携带此文案时使用的业务码；未登记时按 HTTP 状态映射 */
  code?: ErrorCode
}

export type MessageTable = Readonly<Record<string, MessageEntry>>

/** 声明字典时保留字面量 key，便于 msg() 做类型检查 */
export function defineMessages<const T extends MessageTable>(table: T): T {
  return table
}
