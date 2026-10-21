/**
 * @file editor.ts
 * @description 闪念编辑器纯逻辑：图片地址校验与标签输入合法性检查
 * @author TixXin
 * @since 2026-10-21
 */

/**
 * 校验多行图片地址输入：
 * - 至多 9 张
 * - 允许同源受管媒体路径 /api/v1/media/<uuid>.webp
 * - 允许 http/https 外链，禁止用户名密码鉴权信息
 */
export function validateFlashImageUrls(input: string): { valid: boolean; images: string[] } {
  const list = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(list))
  if (
    unique.length > 9 ||
    unique.some((value) => {
      try {
        if (/^\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/.test(value)) return false
        const url = new URL(value)
        return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password
      } catch {
        return true
      }
    })
  ) {
    return { valid: false, images: [] }
  }
  return { valid: true, images: unique }
}

/** 校验新输入标签：长度至多 64 字符，总数至多 20 个 */
export function validateFlashTag(tag: string, existingTags: string[]): boolean {
  if (!tag) return true
  if (tag.length > 64 || (existingTags.length >= 20 && !existingTags.includes(tag))) {
    return false
  }
  return true
}
