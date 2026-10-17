/**
 * @file public-author-id.ts
 * @description 公开作者标识：用服务端密钥对访客哈希做带用途前缀的 HMAC，无法与其他模块的访客标识关联
 * @author TixXin
 * @since 2026-10-18
 */
import { createHmac } from 'node:crypto'

/**
 * 同一访客在同一用途下得到稳定标识，换用途或换密钥即不可关联；
 * 输出 20 位十六进制，保持与原 authorId 相同的字符串类型。
 */
export function publicAuthorId(secret: string, scope: string, visitorIdHash: string): string {
  return createHmac('sha256', secret).update(`${scope}:${visitorIdHash}`).digest('hex').slice(0, 20)
}
