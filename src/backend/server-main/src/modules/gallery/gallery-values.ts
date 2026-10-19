/** @file gallery-values.ts @description 图库外链只做地址校验，保留编码语义，不发起网络请求 */
import { BadRequestException } from '@nestjs/common'
import { managedMediaIds } from '../media/media-references'
import { msg } from '../../common/i18n'

export function galleryExternalUrl(value: string): string {
  if (
    !/^https?:\/\/[^/]/i.test(value) ||
    /[\\\s]/u.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    value.length > 2048
  )
    throw new BadRequestException(msg('gallery.imageUrlMalformed'))
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    if (managedMediaIds([value, url.href]).length) throw new BadRequestException(msg('gallery.imageUrlManaged'))
  } catch (error) {
    if (error instanceof BadRequestException) throw error
    throw new BadRequestException(msg('gallery.imageUrlInvalid'))
  }
  return value
}
