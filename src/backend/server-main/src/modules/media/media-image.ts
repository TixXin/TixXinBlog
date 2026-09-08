/**
 * @file media-image.ts
 * @description 校验真实图片格式并重新编码，丢弃尾随内容和原始元信息。
 */
import { BadRequestException } from '@nestjs/common'
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export interface UploadedImage {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}
export async function normalizeImage(file?: UploadedImage) {
  if (!file?.buffer?.length || file.buffer.length > MAX_IMAGE_BYTES)
    throw new BadRequestException('请选择不超过 8MB 的图片')
  let name = file.originalname
  if (typeof name !== 'string') throw new BadRequestException('文件名不合法')
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
    throw new BadRequestException('文件名不合法，仅支持 JPEG、PNG 和 WebP')
  const bytes = file.buffer
  const format = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp'
        : null
  if (!format) throw new BadRequestException('文件内容不是受支持的图片')
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' })
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
    throw new BadRequestException('图片解码失败、尺寸过大或包含不支持的多帧内容')
  }
}
