/** @file prompts-values.ts @description 提示词规范化与查询条件，外部图片只校验地址且不主动抓取 */
import { BadRequestException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import { raw } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import type { ImagePrompt } from '../../entities/image-prompt.entity'
import { galleryExternalUrl } from '../gallery/gallery-values'
import type { AdminPromptQuery, PromptQuery, SavePromptDto } from './prompts.dto'

export function promptId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException(msg('prompt.idInvalid'))
}

export function promptSourceUrl(value: string) {
  const input = value.trim()
  if (!input) return ''
  if (
    !/^https?:\/\/[^/]/i.test(input) ||
    /[\\\s]/u.test(input) ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BadRequestException(msg('prompt.sourceUrlMalformed'))
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    if (url.href.length > 2048) throw new Error('too long')
    return url.href
  } catch {
    throw new BadRequestException(msg('prompt.sourceUrlInvalid'))
  }
}

export function promptValues(input: SavePromptDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([name, value]) => !['requestId', 'revision'].includes(name) && value !== undefined),
  ) as Omit<SavePromptDto, 'requestId' | 'revision'>
  for (const key of ['title', 'description', 'prompt', 'negativePrompt', 'model', 'imageAlt'] as const)
    if (values[key] !== undefined) values[key] = values[key]!.trim()
  if (values.title === '' || values.prompt === '') throw new BadRequestException(msg('prompt.titleAndPromptRequired'))
  if (input.tags) {
    const seen = new Set<string>()
    values.tags = input.tags
      .map((tag) => tag.trim())
      .filter((tag) => {
        if (!tag) throw new BadRequestException(msg('prompt.tagEmpty'))
        const key = tag.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }
  if (values.externalImageUrl !== undefined && values.externalImageUrl !== null)
    values.externalImageUrl = galleryExternalUrl(values.externalImageUrl)
  if (values.sourceUrl !== undefined) values.sourceUrl = promptSourceUrl(values.sourceUrl)
  return values
}

export function promptWhere(query: PromptQuery | AdminPromptQuery, admin = false): FilterQuery<ImagePrompt> {
  const where: FilterQuery<ImagePrompt> = admin ? {} : { status: 'published' }
  const status = (query as AdminPromptQuery).status
  if (admin && status && status !== 'all') where.status = status
  if (query.model) where.model = { $ilike: query.model.replace(/[\\%_]/g, '\\$&') }
  if (query.tag)
    where.$and = [
      {
        [raw(
          (alias) => `exists(select 1 from jsonb_array_elements_text(${alias}.tags) tag where lower(tag)=?)`,
          [query.tag.toLowerCase()],
        )]: true,
      },
    ]
  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
    where.$or = [
      { title: { $ilike: pattern } },
      { description: { $ilike: pattern } },
      { prompt: { $ilike: pattern } },
      { model: { $ilike: pattern } },
      { [raw((alias) => `${alias}.tags::text`)]: { $ilike: pattern } },
    ]
  }
  return where
}
