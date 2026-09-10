/** @file link-values.ts @description 友链地址规范化保留路径参数语义，服务端不访问输入地址 */
import { BadRequestException } from '@nestjs/common'
import { managedMediaIds } from '../media/media-references'
import type { SaveLinkDto } from './link.dto'
export function linkUrl(value: string) {
  const input = value.trim()
  if (
    !/^https?:\/\//i.test(input) ||
    /[\\\s]/u.test(input) ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BadRequestException('友链需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠')
  let normalized: string
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    normalized = url.toString()
  } catch {
    throw new BadRequestException('友链地址不合法，不能使用占位符或带凭据地址')
  }
  if (normalized.length > 2048) throw new BadRequestException('规范化后的友链地址不能超过2048个字符')
  return normalized
}
export function linkLogoUrl(value: string) {
  const normalized = linkUrl(value)
  if (!normalized.startsWith('https:')) throw new BadRequestException('外部头像需要完整的 HTTPS 地址')
  if (managedMediaIds([normalized]).length)
    throw new BadRequestException('媒体库图片请通过媒体选择器关联，不能填写为外部头像')
  return normalized
}
export function linkId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException('友链编号不合法')
}
export function linkValues(input: SaveLinkDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([name, value]) => !['requestId', 'revision'].includes(name) && value !== undefined),
  ) as Omit<SaveLinkDto, 'requestId' | 'revision'>
  if (input.url !== undefined) values.url = linkUrl(input.url)
  if (input.logoUrl !== undefined) values.logoUrl = input.logoUrl === null ? null : linkLogoUrl(input.logoUrl)
  if (values.logoMediaId && values.logoUrl) throw new BadRequestException('媒体库图片和外部头像只能选择一种')
  return values
}
