/**
 * @file content-package-showcase.ts
 * @description 内容包中图库与项目等展示内容的校验与解析。
 */
import { isISO8601, isUUID } from 'class-validator'
import { GALLERY_STATUSES } from '../../entities/gallery-photo.entity'
import type { GalleryStatus } from '../../entities/gallery-photo.entity'
import { galleryExternalUrl } from '../gallery/gallery-values'
import { projectUrl } from '../project/project-values'
import type { ContentRelation } from '../../common/types/content-relation'
import { array, boolean, date, fail, number, record, text } from './content-package-helpers'
import type { ContentPackage, PackageGalleryPhoto, PackageProject } from './content-package.types'

export function parsePackageGallery(
  rawGallery: unknown,
  version: number,
  relations: (value: unknown, path: string, type: ContentRelation['type'], id: number) => ContentRelation[],
): PackageGalleryPhoto[] {
  const gallery = array(version >= 4 ? rawGallery : [], 'gallery', 3000).map((value, index): PackageGalleryPhoto => {
    const path = `gallery[${index}]`
    const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
    const values = record(row.values, `${path}.values`, [
      'mediaId',
      ...(version >= 9 ? ['relatedContent'] : []),
      ...(version >= 7 ? ['externalUrl'] : []),
      'title',
      'description',
      'category',
      'takenOn',
      'location',
      'device',
      'status',
      'sortOrder',
    ])
    const mediaId = version >= 7 && values.mediaId === null ? null : text(values.mediaId, `${path}.mediaId`, 36, 1)
    const externalUrl =
      version >= 7 && values.externalUrl !== null
        ? galleryExternalUrl(text(values.externalUrl, `${path}.externalUrl`, 2048, 1))
        : null
    if (
      (mediaId !== null && !isUUID(mediaId, '4')) ||
      Boolean(mediaId) === Boolean(externalUrl) ||
      !GALLERY_STATUSES.includes(values.status as GalleryStatus)
    )
      fail(path)
    const takenOn = values.takenOn === null ? null : text(values.takenOn, `${path}.takenOn`, 10, 10)
    if (takenOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || !isISO8601(takenOn, { strict: true })))
      fail(`${path}.takenOn`)
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
        mediaId: mediaId?.toLowerCase() ?? null,
        relatedContent: relations(
          values.relatedContent,
          `${path}.relatedContent`,
          'gallery',
          number(row.sourceId, `${path}.sourceId`),
        ),
        externalUrl,
        title: text(values.title, `${path}.title`, 160, 1).trim(),
        description: text(values.description, `${path}.description`, 5000).trim(),
        category: text(values.category, `${path}.category`, 40).trim(),
        takenOn,
        location: text(values.location, `${path}.location`, 160).trim(),
        device: text(values.device, `${path}.device`, 160).trim(),
        status: values.status as GalleryStatus,
        sortOrder: Number(values.sortOrder),
      },
    }
  })
  if (new Set(gallery.map((photo) => photo.sourceId)).size !== gallery.length) fail('package.fieldGalleryIdDuplicate')
  return gallery
}

export function parsePackageGallerySettings(rawSettings: unknown, version: number): ContentPackage['gallerySettings'] {
  if (version < 4) return null
  const settings = record(rawSettings, 'gallerySettings', ['gear'])
  return {
    gear: array(settings.gear, 'gallerySettings.gear', 12).map((value) => {
      const row = record(value, 'package.fieldGalleryGear', ['icon', 'name', 'description'])
      if (typeof row.icon !== 'string' || !['lucide:camera', 'lucide:circle', 'lucide:smartphone'].includes(row.icon))
        fail('package.fieldGalleryGearIcon')
      return {
        icon: row.icon as 'lucide:camera' | 'lucide:circle' | 'lucide:smartphone',
        name: text(row.name, 'package.fieldGalleryGearName', 80, 1).trim(),
        description: text(row.description, 'package.fieldGalleryGearDescription', 300).trim(),
      }
    }),
  }
}

export function parsePackageProjects(
  rawProjects: unknown,
  version: number,
  relations: (value: unknown, path: string, type: ContentRelation['type'], id: number) => ContentRelation[],
): PackageProject[] {
  const projects = array(version >= 5 ? rawProjects : [], 'projects', 2000).map((value, index): PackageProject => {
    const path = `projects[${index}]`
    const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'])
    const values = record(row.values, `${path}.values`, [
      'title',
      ...(version >= 9 ? ['relatedContent'] : []),
      'description',
      'coverMediaId',
      'tags',
      'links',
      'progress',
      'status',
      'sortOrder',
    ])
    const coverMediaId = values.coverMediaId === null ? null : text(values.coverMediaId, `${path}.coverMediaId`, 36, 1)
    if (coverMediaId !== null && !isUUID(coverMediaId, '4')) fail(`${path}.coverMediaId`)
    if (
      typeof values.progress !== 'string' ||
      !['active', 'dev', 'archived'].includes(values.progress) ||
      typeof values.status !== 'string' ||
      !['draft', 'published', 'withdrawn'].includes(values.status)
    )
      fail(`${path}.progress/status`)
    if (
      !Number.isInteger(values.sortOrder) ||
      Number(values.sortOrder) < -1000000 ||
      Number(values.sortOrder) > 1000000
    )
      fail(`${path}.sortOrder`)
    const tagLabels = new Set<string>()
    const tags = array(values.tags, `${path}.tags`, 20)
      .map((tagVal): PackageProject['values']['tags'][number] => {
        const tag = record(tagVal, `${path}.tags`, ['label', 'color'])
        if (typeof tag.color !== 'string' || !['emerald', 'blue', 'amber', 'sky', 'rose', 'slate'].includes(tag.color))
          fail(`${path}.tags.color`)
        return {
          label: text(tag.label, `${path}.tags.label`, 40, 1).trim(),
          color: tag.color as PackageProject['values']['tags'][number]['color'],
        }
      })
      .filter((tag) => {
        const key = tag.label.toLowerCase()
        if (tagLabels.has(key)) return false
        tagLabels.add(key)
        return true
      })
    const kinds = new Set<string>()
    const links = array(values.links, `${path}.links`, 4).map((linkVal): PackageProject['values']['links'][number] => {
      const link = record(linkVal, `${path}.links`, ['kind', 'href'])
      const kind = text(link.kind, `${path}.links.kind`, 20, 1)
      if (!['source', 'demo', 'docs', 'download'].includes(kind) || kinds.has(kind)) fail(`${path}.links.kind`)
      kinds.add(kind)
      const href = text(link.href, `${path}.links.href`, 2048, 1).trim()
      if (!/^https?:\/\//i.test(href)) fail(`${path}.links.href`)
      try {
        return { kind: kind as PackageProject['values']['links'][number]['kind'], href: projectUrl(href) }
      } catch {
        return fail(`${path}.links.href`)
      }
    })
    return {
      sourceId: number(row.sourceId, `${path}.sourceId`),
      createdAt: date(row.createdAt, `${path}.createdAt`),
      publishedAt: row.publishedAt === null ? null : date(row.publishedAt, `${path}.publishedAt`),
      deleted: boolean(row.deleted, `${path}.deleted`),
      values: {
        title: text(values.title, `${path}.title`, 160, 1).trim(),
        relatedContent: relations(
          values.relatedContent,
          `${path}.relatedContent`,
          'project',
          number(row.sourceId, `${path}.sourceId`),
        ),
        description: text(values.description, `${path}.description`, 5000).trim(),
        coverMediaId: coverMediaId?.toLowerCase() ?? null,
        tags,
        links,
        progress: values.progress as PackageProject['values']['progress'],
        status: values.status as PackageProject['values']['status'],
        sortOrder: Number(values.sortOrder),
      },
    }
  })
  if (new Set(projects.map((project) => project.sourceId)).size !== projects.length)
    fail('package.fieldProjectIdDuplicate')
  return projects
}
