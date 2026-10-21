/**
 * @file content-package-version-gate.ts
 * @description 内容包版本门禁、原型污染防护与内容关系引用校验。
 */
import { BadRequestException } from '@nestjs/common'
import type { ContentRelation } from '../../common/types/content-relation'
import { msg } from '../../common/i18n'
import { array, fail, number, record } from './content-package-helpers'
import type { PackageGalleryPhoto, PackagePost, PackageProject } from './content-package.types'

const ROOT_KEYS = [
  'format',
  'version',
  'exportedAt',
  'mediaIncluded',
  'posts',
  'flashes',
  'moments',
  'guestbook',
  'gallery',
  'projects',
  'links',
  'prompts',
  'subscriptions',
  'linkSettings',
  'gallerySettings',
  'folders',
  'tags',
  'site',
  'requireCommentApproval',
  'media',
  'omittedRelations',
]

export function checkPackageSafety(input: unknown): void {
  let nodes = 0
  const checkKeys = (value: unknown, depth = 0) => {
    if (++nodes > 1000000 || depth > 32) fail('package.fieldNestingOrCount')
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('package.fieldUnsupportedKey')
        checkKeys(child, depth + 1)
      }
  }
  checkKeys(input)
}

export function parsePackageRoot(input: unknown): Record<string, unknown> {
  return record(input, 'package.fieldRoot', ROOT_KEYS)
}

export function assertPackageVersionGates(source: Record<string, unknown>): number {
  if (
    source.format !== 'tixxin-content' ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(Number(source.version)) ||
    typeof source.version !== 'number'
  )
    throw new BadRequestException(msg('package.unsupportedVersion'))
  if (Number(source.version) < 9 && source.omittedRelations !== undefined) fail('package.fieldLegacyOmittedRelations')
  const omittedRelations = Number(source.version) >= 9 ? (source.omittedRelations as number) : 0
  if (!Number.isSafeInteger(omittedRelations) || omittedRelations < 0 || omittedRelations > 72000)
    fail('package.fieldOmittedRelations')
  if (source.version === 1 && source.moments !== undefined) fail('package.fieldV1Moments')
  if (Number(source.version) < 3 && source.guestbook !== undefined) fail('package.fieldV2Guestbook')
  if (Number(source.version) < 4 && (source.gallery !== undefined || source.gallerySettings !== undefined))
    fail('package.fieldV3Gallery')
  if (Number(source.version) < 5 && source.projects !== undefined) fail('package.fieldV4Projects')
  if (Number(source.version) < 6 && (source.links !== undefined || source.linkSettings !== undefined))
    fail('package.fieldV5Links')
  if (Number(source.version) < 10 && source.prompts !== undefined) fail('package.fieldV9Prompts')
  if (Number(source.version) < 11 && source.subscriptions !== undefined) fail('package.fieldV10Subscriptions')
  return omittedRelations
}

export function parsePackageRelations(
  version: number,
  value: unknown,
  path: string,
  type: ContentRelation['type'],
  id: number,
): ContentRelation[] {
  if (version < 9) {
    if (value !== undefined) fail('package.fieldLegacyRelations')
    return []
  }
  const seen = new Set<string>()
  return array(value, path, 12).map((item) => {
    const row = record(item, path, ['type', 'id'])
    if (!['post', 'project', 'gallery'].includes(String(row.type))) fail('package.fieldRelationType')
    const targetId = number(row.id, path + '.id')
    const key = `${row.type}:${targetId}`
    if (seen.has(key) || (row.type === type && targetId === id)) fail('package.fieldRelationDuplicateOrSelf')
    seen.add(key)
    return { type: row.type as ContentRelation['type'], id: targetId }
  })
}

export function assertRelationTargetsExist(
  posts: PackagePost[],
  projects: PackageProject[],
  gallery: PackageGalleryPhoto[],
): void {
  const targets = new Set([
    ...posts.map((row) => `post:${row.sourceId}`),
    ...projects.map((row) => `project:${row.sourceId}`),
    ...gallery.map((row) => `gallery:${row.sourceId}`),
  ])
  for (const row of [...posts, ...projects, ...gallery])
    for (const relation of row.values.relatedContent ?? [])
      if (!targets.has(`${relation.type}:${relation.id}`)) fail('package.fieldRelationTargetMissing')
}
