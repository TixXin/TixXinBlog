/** @file gallery-values.ts @description 图库外链只做地址校验，保留编码语义，不发起网络请求 */
import { BadRequestException } from '@nestjs/common'
import { managedMediaIds } from '../media/media-references'

export function galleryExternalUrl(value: string): string {
  if (
    !/^https?:\/\/[^/]/i.test(value) ||
    /[\\\s]/u.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    value.length > 2048
  )
    throw new BadRequestException('图片需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠')
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    if (managedMediaIds([value, url.href]).length)
      throw new BadRequestException('媒体库图片请通过媒体选择器关联，不能填写为外部图片')
  } catch (error) {
    if (error instanceof BadRequestException) throw error
    throw new BadRequestException('图片地址不合法，不能使用不完整地址或带凭据地址')
  }
  return value
}
