/**
 * @file og-text.ts
 * @description 分享卡片的文字整理：Markdown 转纯文本、按字符截断、Pango 标记转义、首字母头像与日期格式。
 * @author TixXin
 * @since 2026-11-03
 */

/** 去掉 Markdown 语法，保留可读文字：图片与链接地址丢弃，链接文字、代码内容保留 */
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|[\s(])[*_](\S[^*_]*?)[*_](?=[\s).,!?;:]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 零宽字符、方向控制符与行/段分隔符 */
const INVISIBLE = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0xfeff])

/** 控制字符与不可见字符替换为空格并折叠空白，避免换行符和不可见字符影响排版 */
export function cleanText(value: string): string {
  return Array.from(value, (char) => {
    const code = char.codePointAt(0)!
    return code < 0x20 || (code >= 0x7f && code <= 0x9f) || INVISIBLE.has(code) ? ' ' : char
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 按字符（码位）截断，超出时补省略号 */
export function truncateText(value: string, max: number): string {
  const chars = Array.from(value)
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : value
}

/** 转义 Pango 标记中的特殊字符 */
export function escapeMarkup(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 首字母头像的字符：取名称的第一个字符，拉丁字母转大写；名称为空时用 "T" */
export function avatarInitial(name: string): string {
  const first = Array.from(cleanText(name))[0]
  return first ? first.toLocaleUpperCase() : 'T'
}

/** 以服务进程所在时区格式化为 YYYY-MM-DD；非法时间返回 undefined */
export function cardDate(value: string | Date | undefined): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
