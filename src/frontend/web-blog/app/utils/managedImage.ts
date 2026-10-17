/**
 * @file managedImage.ts
 * @description 受管媒体响应式变体：为 /api/v1/media/ 图片生成白名单宽度的 srcset，外链图片不处理
 */

/** 与后端 media-image.ts 的 MEDIA_VARIANT_WIDTHS 保持一致，修改时两端同步。 */
export const MANAGED_IMAGE_WIDTHS = [320, 640, 960, 1280] as const

const MANAGED_MEDIA = /^(?:https?:\/\/[^/]+)?\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/i

/** 仅站内受管媒体地址（可带同源 origin、不带查询参数）才有服务端变体。 */
export function isManagedImage(src: string | undefined | null): src is string {
  return !!src && MANAGED_MEDIA.test(src)
}

/** 指定宽度的变体地址；非受管地址原样返回。 */
export function managedImageUrl(src: string, width: number) {
  return isManagedImage(src) ? `${src}?w=${width}` : src
}

/**
 * 生成受管图片的 srcset。已知原图宽度时只列出小于原图的变体并补上原图，
 * 避免为同一字节产生多个缓存地址；未知时列出全部白名单宽度（大于原图的宽度服务端直接回原图）。
 */
export function managedImageSrcset(src: string | undefined | null, naturalWidth?: number | null) {
  if (!isManagedImage(src)) return undefined
  const known = typeof naturalWidth === 'number' && naturalWidth > 0
  const widths = MANAGED_IMAGE_WIDTHS.filter((width) => !known || width < naturalWidth)
  const candidates = widths.map((width) => `${managedImageUrl(src, width)} ${width}w`)
  if (known) candidates.push(`${src} ${naturalWidth}w`)
  return candidates.join(', ')
}
