/**
 * @file content-package.ts
 * @description 内容迁入包的固定版本与严格校验；完整数据库恢复由独立维护命令负责。
 */
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import type { ContentRelation } from '../../common/types/content-relation'
import { boolean, date, fail, packageHash } from './content-package-helpers'
import { parsePackageSubscriptions } from './content-package-subscriptions'
import {
  assertPackageVersionGates,
  assertRelationTargetsExist,
  checkPackageSafety,
  parsePackageRelations,
  parsePackageRoot,
} from './content-package-version-gate'
import {
  parsePackageFlashes,
  parsePackageGuestbook,
  parsePackageMoments,
  parsePackagePosts,
} from './content-package-social'
import { parsePackageGallery, parsePackageGallerySettings, parsePackageProjects } from './content-package-showcase'
import { parsePackageLinks, parsePackageLinkSettings, parsePackagePrompts } from './content-package-links-prompts'
import { parsePackageMedia, parsePackageSiteSettings, parsePackageTaxonomies } from './content-package-site-media'
import {
  MAX_PACKAGE_BYTES,
  type ContentPackage,
  type PackageComment,
  type PackageFlash,
  type PackageGalleryPhoto,
  type PackageGuestbook,
  type PackageImagePrompt,
  type PackageLink,
  type PackageMedia,
  type PackageMoment,
  type PackagePost,
  type PackageProject,
  type PackageSubscription,
} from './content-package.types'

export { MAX_PACKAGE_BYTES, packageHash }
export type {
  ContentPackage,
  PackageComment,
  PackageFlash,
  PackageGalleryPhoto,
  PackageGuestbook,
  PackageImagePrompt,
  PackageLink,
  PackageMedia,
  PackageMoment,
  PackagePost,
  PackageProject,
  PackageSubscription,
}

export async function parseContentPackage(buffer: Buffer): Promise<ContentPackage> {
  if (!buffer.length || buffer.length > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException(msg('package.tooLarge'))
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch {
    throw new BadRequestException(msg('package.invalidJson'))
  }
  checkPackageSafety(input)
  const source = parsePackageRoot(input)
  const omittedRelations = assertPackageVersionGates(source)
  const version = Number(source.version)

  const relations = (value: unknown, path: string, type: ContentRelation['type'], id: number) =>
    parsePackageRelations(version, value, path, type, id)

  const subscriptions = parsePackageSubscriptions(version >= 11 ? source.subscriptions : [])
  const mediaIncluded = boolean(source.mediaIncluded, 'mediaIncluded')

  const { posts, commentsCount: postComments } = parsePackagePosts(source.posts, relations)
  const { flashes, commentsCount: flashComments } = parsePackageFlashes(source.flashes, version)
  const { moments, commentsCount: momentComments } = parsePackageMoments(source.moments, version, posts)
  const guestbook = parsePackageGuestbook(source.guestbook, version)

  if (postComments + flashComments + momentComments > 10000) fail('package.fieldCommentsTotalOrFlashIdDuplicate')

  const gallery = parsePackageGallery(source.gallery, version, relations)
  const gallerySettings = parsePackageGallerySettings(source.gallerySettings, version)
  const projects = parsePackageProjects(source.projects, version, relations)
  const links = parsePackageLinks(source.links, version)
  const linkSettings = parsePackageLinkSettings(source.linkSettings, version)
  const prompts = parsePackagePrompts(source.prompts, version)

  const { folders, tags } = parsePackageTaxonomies(source.folders, source.tags)
  const site = parsePackageSiteSettings(source.site, version)
  const media = await parsePackageMedia(source.media, version, mediaIncluded)

  assertRelationTargetsExist(posts, projects, gallery)

  return {
    format: 'tixxin-content',
    version: 14,
    omittedRelations,
    exportedAt: date(source.exportedAt, 'package.fieldExportedAt'),
    mediaIncluded,
    posts,
    flashes,
    moments,
    guestbook,
    gallery,
    projects,
    links,
    prompts,
    subscriptions,
    linkSettings,
    gallerySettings,
    folders,
    tags,
    site,
    requireCommentApproval: boolean(source.requireCommentApproval, 'package.fieldRequireCommentApproval'),
    media,
  }
}
