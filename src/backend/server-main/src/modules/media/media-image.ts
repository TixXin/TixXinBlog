/**
 * @file media-image.ts
 * @description 校验真实图片格式并重新编码，丢弃尾随内容和原始元信息；按白名单宽度生成可再生的 WebP 变体。
 */
import { BadRequestException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
// 解码像素上限：原图上传后最长边不超过 4096，变体解码同样受限，防止异常文件耗尽内存。
export const MAX_INPUT_PIXELS = 40000000
/**
 * 公开变体宽度白名单（CSS 像素 × 设备像素比后的目标宽度）：
 * 320 覆盖九宫格与侧栏缩略图（约 80–160px 的 2x 屏），640 覆盖列表卡片（约 230–320px 的 2x 屏），
 * 960 覆盖双列画廊与 3x 手机卡片，1280 覆盖宽屏单列与大图；更大的需求直接使用原图。
 * 前端 app/utils/managedImage.ts 保留同一列表，修改时需同步。
 */
export const MEDIA_VARIANT_WIDTHS = [320, 640, 960, 1280] as const
export type MediaVariantWidth = (typeof MEDIA_VARIANT_WIDTHS)[number]
export function isMediaVariantWidth(value: number): value is MediaVariantWidth {
  return (MEDIA_VARIANT_WIDTHS as readonly number[]).includes(value)
}
export interface UploadedImage {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}
export async function normalizeImage(file?: UploadedImage) {
  if (!file?.buffer?.length || file.buffer.length > MAX_IMAGE_BYTES)
    throw new BadRequestException(msg('media.tooLarge'))
  let name = file.originalname
  if (typeof name !== 'string') throw new BadRequestException(msg('media.fileNameInvalid'))
  if ([...name].every((value) => value.charCodeAt(0) <= 255)) {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (!decoded.includes('\uFFFD')) name = decoded
  }
  if (
    !name ||
    name.length > 240 ||
    [...name].some((value) => value.charCodeAt(0) < 32 || value.charCodeAt(0) === 127) ||
    /[\\/\u202a-\u202e\u2066-\u2069]/.test(name) ||
    !/\.(?:jpe?g|png|webp)$/i.test(name)
  )
    throw new BadRequestException(msg('media.fileTypeUnsupported'))
  const bytes = file.buffer
  const format = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp'
        : null
  if (!format) throw new BadRequestException(msg('media.contentUnsupported'))
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== format || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      throw new Error('不支持的图片内容')
    const result = await image
      .rotate()
      .resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .timeout({ seconds: 8 })
      .toBuffer({ resolveWithObject: true })
    return { name, buffer: result.data, width: result.info.width, height: result.info.height }
  } catch {
    throw new BadRequestException(msg('media.decodeFailed'))
  }
}

/** 从已规范化的原图生成指定宽度的 WebP 变体；不放大、不保留元信息。 */
export async function resizeImageVariant(original: Buffer, width: MediaVariantWidth) {
  return sharp(original, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'warning' })
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .timeout({ seconds: 8 })
    .toBuffer()
}
