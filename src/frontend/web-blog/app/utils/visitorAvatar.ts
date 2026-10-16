/** @file visitorAvatar.ts @description 访客没有头像时按名字生成确定性的首字母头像；博主仍回退到站点默认头像 */
const PALETTE = [
  '#2563eb',
  '#0d9488',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#0891b2',
  '#9333ea',
  '#be123c',
  '#4f46e5',
  '#65a30d',
] as const
export const DEFAULT_AVATAR = '/avatar.svg'
/** 取名字里第一个字母或汉字；英文大写 */
export function avatarInitial(name: string) {
  const trimmed = name.trim()
  const first = [...trimmed].find((char) => /[\p{L}\p{N}]/u.test(char)) ?? trimmed[0] ?? '?'
  return first.toUpperCase()
}
/** 同一名字总是同一底色与首字，SSR 与客户端结果一致 */
export function visitorAvatar(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  const background = PALETTE[hash % PALETTE.length]!
  const initial = avatarInitial(name).replace(/[<>&"]/g, '')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="32" fill="${background}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="#fff">${initial}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
/** 展示用头像：博主缺省用站点头像，访客缺省或仍是站点默认图时用首字母头像 */
export function displayAvatar(avatar: string | undefined | null, name: string, isOwner = false) {
  if (isOwner) return avatar || DEFAULT_AVATAR
  return avatar && avatar !== DEFAULT_AVATAR ? avatar : visitorAvatar(name)
}
