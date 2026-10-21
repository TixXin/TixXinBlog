/**
 * @file content-package-links-prompts.ts
 * @description 内容包中友链与图片提示词等外部/生成内容的校验与解析。
 */
import { BadRequestException } from '@nestjs/common'
import { isUUID } from 'class-validator'
import { linkLogoUrl, linkUrl } from '../link/link-values'
import { SavePromptDto } from '../prompts/prompts.dto'
import { promptValues } from '../prompts/prompts-values'
import { msg } from '../../common/i18n'
import { array, boolean, date, dto, fail, number, record, text } from './content-package-helpers'
import type { ContentPackage, PackageImagePrompt, PackageLink } from './content-package.types'

export function parsePackageLinks(rawLinks: unknown, version: number): PackageLink[] {
  const links = array(version >= 6 ? rawLinks : [], 'links', 2000).map((value, index): PackageLink => {
    const path = `links[${index}]`
    const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
    const values = record(row.values, `${path}.values`, [
      'name',
      'description',
      'url',
      'logoMediaId',
      'logoUrl',
      'status',
      'isFeatured',
      'sortOrder',
    ])
    const logoMediaId = values.logoMediaId === null ? null : text(values.logoMediaId, `${path}.logoMediaId`, 36, 1)
    if (logoMediaId !== null && !isUUID(logoMediaId, '4')) fail(`${path}.logoMediaId`)
    if (logoMediaId !== null && values.logoUrl !== null)
      throw new BadRequestException(msg('package.imageSourceConflict', { path }))
    if (typeof values.status !== 'string' || !['draft', 'published', 'withdrawn'].includes(values.status))
      fail(`${path}.status`)
    if (
      !Number.isInteger(values.sortOrder) ||
      Number(values.sortOrder) < -1000000 ||
      Number(values.sortOrder) > 1000000
    )
      fail(`${path}.sortOrder`)
    return {
      sourceId: number(row.sourceId, `${path}.sourceId`),
      createdAt: date(row.createdAt, `${path}.createdAt`),
      publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
      deleted: boolean(row.deleted, `${path}.deleted`),
      values: {
        name: text(values.name, `${path}.name`, 80, 1).trim(),
        description: text(values.description, `${path}.description`, 300).trim(),
        url: linkUrl(text(values.url, `${path}.url`, 2048, 1)),
        logoMediaId: logoMediaId?.toLowerCase() ?? null,
        logoUrl: values.logoUrl === null ? null : linkLogoUrl(text(values.logoUrl, `${path}.logoUrl`, 2048, 1)),
        status: values.status as PackageLink['values']['status'],
        isFeatured: boolean(values.isFeatured, `${path}.isFeatured`),
        sortOrder: Number(values.sortOrder),
      },
    }
  })
  if (new Set(links.map((link) => link.sourceId)).size !== links.length) fail('package.fieldLinkIdDuplicate')
  return links
}

export function parsePackageLinkSettings(rawSettings: unknown, version: number): ContentPackage['linkSettings'] {
  if (version < 6) return null
  const settings = record(rawSettings, 'linkSettings', ['rules'])
  return {
    rules: array(settings.rules, 'linkSettings.rules', 12).map((value) =>
      text(value, 'package.fieldLinkRule', 300, 1).trim(),
    ),
  }
}

export function parsePackagePrompts(rawPrompts: unknown, version: number): PackageImagePrompt[] {
  const prompts = array(version >= 10 ? rawPrompts : [], 'prompts', 3000).map((value, index): PackageImagePrompt => {
    const path = `prompts[${index}]`
    const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'values'])
    const keys = [
      'title',
      'description',
      'prompt',
      'negativePrompt',
      'model',
      'tags',
      'mediaId',
      'externalImageUrl',
      'imageAlt',
      'sourceUrl',
      'status',
    ]
    const raw = record(row.values, `${path}.values`, keys)
    if (keys.some((key) => raw[key] === undefined)) fail(`${path}.values`)
    const values = promptValues(dto(SavePromptDto, raw, `${path}.values`)) as PackageImagePrompt['values']
    if (Boolean(values.mediaId) === Boolean(values.externalImageUrl))
      throw new BadRequestException(msg('package.imageSourceConflict', { path }))
    values.mediaId = values.mediaId?.toLowerCase() ?? null
    return {
      sourceId: number(row.sourceId, `${path}.sourceId`),
      createdAt: date(row.createdAt, `${path}.createdAt`),
      publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
      values,
    }
  })
  if (new Set(prompts.map((prompt) => prompt.sourceId)).size !== prompts.length) fail('package.fieldPromptIdDuplicate')
  return prompts
}
