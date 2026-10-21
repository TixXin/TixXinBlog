/**
 * @file media-query.ts
 * @description 媒体检索条件构造、资产 DTO 组装与关联引用文本/链接映射
 * @author TixXin
 * @since 2026-10-21
 */
import { raw, type FilterQuery } from '@mikro-orm/core'
import { isUUID } from 'class-validator'
import { translate, type ApiLocale } from '../../common/i18n'
import type { MediaAsset } from '../../entities/media-asset.entity'
import type { MediaReference } from '../../entities/media-reference.entity'
import { mediaUrl } from './media-references'

export function toMediaDto(asset: MediaAsset) {
  return {
    id: asset.id,
    name: asset.originalName,
    url: mediaUrl(asset.id),
    alt: asset.alt,
    description: asset.description,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    mimeType: asset.mimeType,
    createdAt: asset.createdAt.toISOString(),
    deleted: !!asset.deletedAt,
  }
}

export function buildMediaFilter(query: {
  search?: string
  deleted: boolean
  orientation?: 'landscape' | 'portrait' | 'square'
  usage?: 'used' | 'unused'
}): FilterQuery<MediaAsset> {
  const conditions: FilterQuery<MediaAsset>[] = [{ deletedAt: query.deleted ? { $ne: null } : null }]
  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`
    conditions.push({
      $or: [
        { originalName: { $ilike: pattern } },
        { alt: { $ilike: pattern } },
        { description: { $ilike: pattern } },
        ...(isUUID(query.search) ? [{ id: query.search }] : []),
      ],
    })
  }
  if (query.orientation) {
    const operator = { landscape: '>', portrait: '<', square: '=' }[query.orientation]
    conditions.push({ [raw((alias) => `(${alias}.width ${operator} ${alias}.height)`)]: true })
  }
  if (query.usage) {
    // 历史版本、草稿和所有业务引用共同决定是否使用，不能只统计当前公开内容。
    conditions.push({
      [raw((alias) => `(exists (select 1 from media_reference r where r.asset_id = ${alias}.id))`)]:
        query.usage === 'used',
    })
  }
  return { $and: conditions }
}

export function formatMediaReference(item: MediaReference, locale: ApiLocale) {
  const title =
    item.post?.title ??
    item.flashNote?.content.slice(0, 100) ??
    item.moment?.content.slice(0, 100) ??
    item.guestbookMessage?.content.slice(0, 100) ??
    item.galleryPhoto?.title ??
    item.project?.title ??
    item.subscription?.name ??
    item.friendLink?.name ??
    item.imagePrompt?.title ??
    translate(locale, 'media.referenceSiteAvatar')

  let url = '/admin/site'
  if (item.momentComment && item.moment) {
    url = `/admin/moments?comments=${encodeURIComponent(item.moment.id)}&commentId=${encodeURIComponent(item.momentComment.id)}`
  } else if (item.flashComment && item.flashNote) {
    url = `/admin/flashes?comments=${encodeURIComponent(item.flashNote.id)}&commentId=${encodeURIComponent(item.flashComment.id)}`
  } else if (item.comment) {
    url = `/admin/comments?commentId=${item.comment.id}`
  } else if (item.post) {
    url = `/admin/posts/${item.post.id}`
  } else if (item.flashNote) {
    url = `/admin/flashes?edit=${encodeURIComponent(item.flashNote.id)}`
  } else if (item.moment) {
    url = `/admin/moments/${encodeURIComponent(item.moment.id)}`
  } else if (item.guestbookMessage) {
    url = `/admin/guestbook?focus=${item.guestbookMessage.id}`
  } else if (item.galleryPhoto) {
    url = `/admin/gallery/${item.galleryPhoto.id}`
  } else if (item.project) {
    url = `/admin/projects/${item.project.id}`
  } else if (item.subscription) {
    url = `/admin/subscriptions/${item.subscription.id}`
  } else if (item.friendLink) {
    url = `/admin/links/${item.friendLink.id}`
  } else if (item.imagePrompt) {
    url = `/prompts?edit=${item.imagePrompt.id}`
  }

  return {
    kind: item.kind,
    revision: item.revision,
    title,
    url,
  }
}
