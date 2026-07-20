/**
 * @file visitor-id.ts
 * @description 访客 id 哈希工具：后端只存 SHA-256 哈希，不保存原文（api.md §5.1）
 * @author TixXin
 * @since 2026-07-20
 */

import { createHash } from 'node:crypto'

/** 访客 id 合法格式：8-128 位可打印 ASCII（前端生成的 uuid / nanoid 均满足） */
export const VISITOR_ID_PATTERN = /^[\x21-\x7e]{8,128}$/

export function hashVisitorId(visitorId: string): string {
  return createHash('sha256').update(visitorId).digest('hex')
}
