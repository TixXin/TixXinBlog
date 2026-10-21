/**
 * @file content-package-site-media.ts
 * @description 内容包中站点设置、分类标签与受管媒体解码校验。
 */
import { PayloadTooLargeException } from '@nestjs/common'
import { isUUID } from 'class-validator'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { SaveSiteSettingsDto } from '../site/site-settings.dto'
import { normalizeSiteExtrasInput, SiteExtrasError } from '../site/site-navigation'
import { POST_TAG_COLORS } from '../../entities/post-tag.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import { msg } from '../../common/i18n'
import { array, boolean, date, dto, fail, number, packageImageUrl, record, text } from './content-package-helpers'
import { MAX_PACKAGE_BYTES, type ContentPackage, type PackageMedia } from './content-package.types'

/** v12 引入的站点字段 */
const SITE_EXTRA_KEYS = ['navigation', 'footerLinks', 'quotes', 'icpNumber', 'icpUrl', 'copyright']

export function parsePackageTaxonomies(
  rawFolders: unknown,
  rawTags: unknown,
): { folders: string[]; tags: { label: string; color: PostTagColor }[] } {
  const folders = array(rawFolders, 'folders', 1000).map((value) =>
    text(value, 'package.fieldFolderName', 64, 1).trim(),
  )
  const tags = array(rawTags, 'tags', 3000).map((value) => {
    const tag = record(value, 'package.fieldTag', ['label', 'color'])
    if (!POST_TAG_COLORS.includes(tag.color as PostTagColor)) fail('package.fieldTagColor')
    return { label: text(tag.label, 'package.fieldTagLabel', 64, 1).trim(), color: tag.color as PostTagColor }
  })
  if (
    folders.some((value) => !value) ||
    tags.some((tag) => !tag.label) ||
    new Set(folders).size !== folders.length ||
    new Set(tags.map((tag) => tag.label)).size !== tags.length
  )
    fail('package.fieldFolderOrTagDuplicate')
  return { folders, tags }
}

export function parsePackageSiteSettings(rawSite: unknown, version: number): ContentPackage['site'] {
  const siteData = dto(
    SaveSiteSettingsDto,
    {
      ...record(rawSite, 'site', [
        'name',
        'description',
        'ownerName',
        'ownerTitle',
        'avatar',
        'avatarAlt',
        'seoTitle',
        'seoDescription',
        'announcement',
        'socials',
        ...(version >= 8 ? ['about'] : []),
        // v11 起可选携带在线状态、签名、状态类型与上线日期；旧版本出现即按未知字段拒绝。
        ...(version >= 11 ? ['presenceLabel', 'presenceSignature', 'presenceStatus', 'launchedAt'] : []),
        // v12 起可选携带导航、页脚链接、每日一言、备案号与版权文案；v1–v11 出现即按未知字段拒绝。
        ...(version >= 12 ? SITE_EXTRA_KEYS : []),
        // v14 起可选携带搜索引擎收录开关；v1–v13 出现即按未知字段拒绝。
        ...(version >= 14 ? ['searchIndexing'] : []),
      ]),
      revision: 0,
    },
    'package.fieldSite',
  )
  const { revision: ignoredRevision, ...site } = siteData
  try {
    Object.assign(site, normalizeSiteExtrasInput(site))
  } catch (error) {
    if (error instanceof SiteExtrasError) fail('package.fieldSiteNavigation')
    throw error
  }
  if (site.about && new Set(site.about.sections.map((section) => section.kind)).size !== site.about.sections.length)
    fail('package.fieldAboutSectionDuplicate')
  if (ignoredRevision !== 0 || !packageImageUrl(site.avatar)) fail('package.fieldSiteAvatar')
  for (const social of site.socials) {
    let valid = /^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/.test(social.href)
    try {
      const url = new URL(social.href)
      valid ||= ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      /* 后续统一拒绝非法链接。 */
    }
    if (!valid) fail('package.fieldSiteSocial')
  }
  return site
}

export async function parsePackageMedia(
  rawMedia: unknown,
  version: number,
  mediaIncluded: boolean,
): Promise<PackageMedia[]> {
  const media: PackageMedia[] = []
  let decodedPixels = 0
  for (const value of array(rawMedia, 'media', 300)) {
    const item = record(value, 'package.fieldMedia', [
      'id',
      ...(version >= 9 ? ['description'] : []),
      'name',
      'alt',
      'sha256',
      'byteSize',
      'width',
      'height',
      'createdAt',
      'deleted',
      'base64',
    ])
    const id = text(item.id, 'package.fieldMediaId', 36)
    const name = text(item.name, 'package.fieldMediaName', 240, 1)
    const sha256 = text(item.sha256, 'package.fieldMediaSha256', 64)
    const byteSize = number(item.byteSize, 'package.fieldMediaByteSize')
    const width = number(item.width, 'package.fieldMediaWidth'),
      height = number(item.height, 'package.fieldMediaHeight')
    if (
      !isUUID(id, '4') ||
      !/^[0-9a-f]{64}$/.test(sha256) ||
      /[\\/\u202a-\u202e\u2066-\u2069]/.test(name) ||
      [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      !/\.(?:jpe?g|png|webp)$/i.test(name) ||
      byteSize > 32 * 1024 * 1024 ||
      width > 4096 ||
      height > 4096
    )
      fail('package.fieldMediaAttributes')
    const base64 =
      item.base64 === undefined ? undefined : text(item.base64, 'package.fieldMediaBase64', MAX_PACKAGE_BYTES)
    if (mediaIncluded !== (base64 !== undefined)) fail('package.fieldMediaIncludedMismatch')
    if (base64 !== undefined) {
      decodedPixels += width * height
      if (decodedPixels > 100000000) throw new PayloadTooLargeException(msg('package.pixelsTooLarge'))
      if (base64.length % 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(base64)) fail('package.fieldMediaEncoding')
      const bytes = Buffer.from(base64, 'base64')
      if (
        bytes.length !== byteSize ||
        createHash('sha256').update(bytes).digest('hex') !== sha256 ||
        bytes.length < 12 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        bytes.readUInt32LE(4) + 8 !== bytes.length
      )
        fail('package.fieldMediaIntegrity')
      try {
        const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: 'warning' })
        const info = await image.metadata()
        if (
          info.format !== 'webp' ||
          info.width !== width ||
          info.height !== height ||
          (info.pages ?? 1) > 1 ||
          info.exif ||
          info.xmp ||
          info.iptc
        )
          fail('package.fieldMediaMetadata')
        await image.timeout({ seconds: 8 }).stats()
      } catch {
        fail('package.fieldMediaDecode')
      }
    }
    media.push({
      id: id.toLowerCase(),
      description: version >= 9 ? text(item.description, 'package.fieldMediaDescription', 1000) : '',
      name,
      alt: text(item.alt, 'package.fieldMediaAlt', 300),
      sha256,
      byteSize,
      width,
      height,
      createdAt: date(item.createdAt, 'package.fieldMediaCreatedAt'),
      deleted: boolean(item.deleted, 'package.fieldMediaDeleted'),
      ...(base64 === undefined ? {} : { base64 }),
    })
  }
  if (new Set(media.map((item) => item.id)).size !== media.length) fail('package.fieldMediaIdDuplicate')
  return media
}
