/**
 * @file avatar.ts
 * @description 初始化向导的头像工具：字母头像绘制、上传图片居中裁成方形并压缩为 data URL、Cravatar 地址；
 *              图片在浏览器内处理后随初始化请求提交，由服务端转码并登记为站内媒体
 * @author TixXin
 * @since 2026-10-20
 */
import { md5 } from './md5'

/** 头像边长：资料卡最大显示约 160px，按 3 倍屏留余量 */
export const SETUP_AVATAR_SIZE = 512
/** 与服务端 SETUP_AVATAR_DATA_MAX 一致，超过时降低质量重试 */
export const SETUP_AVATAR_DATA_MAX = 900_000

/** 字母头像底色：中等明度，白字在浅色与深色主题下都清晰 */
export const LETTER_AVATAR_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
]

/** 取名称的第一个字符（按字素，避免把表情或组合字符截断）；英文转大写 */
export function avatarInitial(name: string): string {
  const text = name.trim()
  if (!text) return '?'
  const first =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? (new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next().value
          ?.segment ?? text[0]!)
      : Array.from(text)[0]!
  return first.toUpperCase()
}

/** 同一名称总是得到同一底色 */
export function letterAvatarColor(name: string): string {
  let hash = 0
  for (const char of name.trim()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return LETTER_AVATAR_COLORS[hash % LETTER_AVATAR_COLORS.length]!
}

/** 按小写邮箱的 MD5 生成 Cravatar 地址，与服务端 cravatarUrl 一致 */
export function cravatarUrl(email: string): string {
  return `https://cn.cravatar.com/avatar/${md5(email.trim().toLowerCase())}?s=512&d=identicon`
}

function canvas(size = SETUP_AVATAR_SIZE) {
  const element = document.createElement('canvas')
  element.width = element.height = size
  const context = element.getContext('2d')
  if (!context) throw new Error('canvas unavailable')
  return { element, context }
}

/** 依次尝试 WebP、JPEG 并降低质量，直到不超过上限；Safari 不支持编码 WebP 时会回退为 PNG */
function encode(element: HTMLCanvasElement): string {
  for (const [type, quality] of [
    ['image/webp', 0.9],
    ['image/jpeg', 0.88],
    ['image/jpeg', 0.75],
  ] as const) {
    const data = element.toDataURL(type, quality)
    if (data.length <= SETUP_AVATAR_DATA_MAX && /^data:image\/(?:webp|jpeg|png);/.test(data)) return data
  }
  throw new Error('avatar too large')
}

/** 绘制字母头像：纯色圆角方底，居中一个字；返回 PNG data URL（文字边缘更清晰） */
export function drawLetterAvatar(name: string): string {
  const { element, context } = canvas()
  const size = SETUP_AVATAR_SIZE
  context.fillStyle = letterAvatarColor(name)
  context.fillRect(0, 0, size, size)
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `600 ${size * 0.46}px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`
  context.fillText(avatarInitial(name), size / 2, size / 2 + size * 0.02)
  return element.toDataURL('image/png')
}

/** 读取本地图片，居中裁成正方形并缩放到头像边长 */
export async function cropAvatarFile(file: File): Promise<string> {
  if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) throw new Error('unsupported')
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const { element, context } = canvas(Math.min(SETUP_AVATAR_SIZE, side))
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      element.width,
      element.height,
    )
    return encode(element)
  } finally {
    bitmap.close()
  }
}
