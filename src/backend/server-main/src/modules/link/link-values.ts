/** @file link-values.ts @description 友链地址规范化保留路径参数语义，服务端不访问输入地址 */
import { BadRequestException } from '@nestjs/common'
import { managedMediaIds } from '../media/media-references'
import type { SaveLinkDto } from './link.dto'
import { msg } from '../../common/i18n'
export function linkUrl(value: string) {
  const input = value.trim()
  if (
    !/^https?:\/\/[^/]/i.test(input) ||
    /[\\\s]/u.test(input) ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BadRequestException(msg('link.urlMalformed'))
  let normalized: string
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    normalized = url.toString()
  } catch {
    throw new BadRequestException(msg('link.urlInvalid'))
  }
  if (normalized.length > 2048) throw new BadRequestException(msg('link.urlTooLong'))
  return normalized
}
export function linkLogoUrl(value: string) {
  const normalized = linkUrl(value)
  if (!normalized.startsWith('https:')) throw new BadRequestException(msg('link.logoRequiresHttps'))
  if (managedMediaIds([normalized]).length) throw new BadRequestException(msg('link.logoManaged'))
  return normalized
}
export function linkId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException(msg('link.idInvalid'))
}
export function linkValues(input: SaveLinkDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([name, value]) => !['requestId', 'revision'].includes(name) && value !== undefined),
  ) as Omit<SaveLinkDto, 'requestId' | 'revision'>
  if (input.url !== undefined) values.url = linkUrl(input.url)
  if (input.logoUrl !== undefined) values.logoUrl = input.logoUrl === null ? null : linkLogoUrl(input.logoUrl)
  if (values.logoMediaId && values.logoUrl) throw new BadRequestException(msg('link.logoExclusive'))
  return values
}
