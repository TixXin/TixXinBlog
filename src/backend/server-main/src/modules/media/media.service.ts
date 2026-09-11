/**
 * @file media.service.ts
 * @description 媒体上传、检索、引用保护及回收；同一上传标识重试不重复创建资源。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { raw } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { isUUID } from 'class-validator'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { MediaStorage } from './media-storage'
import { normalizeImage } from './media-image'
import type { UploadedImage } from './media-image'
import { lockMedia, mediaUrl } from './media-references'

@Injectable()
export class MediaService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: MediaStorage,
  ) {}
  private dto(asset: MediaAsset) {
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
  async upload(file: UploadedImage | undefined, alt: string, uploadId?: string) {
    const image = await normalizeImage(file)
    const id = uploadId?.toLowerCase() ?? randomUUID()
    const key = `${id}.webp`
    const sha256 = createHash('sha256').update(image.buffer).digest('hex')
    let written = false
    try {
      return await this.em.transactional(async (em) => {
        await lockMedia(em)
        const existing = await em.findOne(MediaAsset, { id })
        if (existing) {
          if (existing.sha256 !== sha256 || existing.deletedAt)
            throw new ConflictException('上传标识已使用，请重新选择文件')
          return this.dto(existing)
        }
        const previous = await this.storage.readIfExists(key)
        if (previous) {
          if (createHash('sha256').update(previous).digest('hex') !== sha256)
            throw new ConflictException('资源标识对应的文件不同，请重新选择文件')
        } else {
          await this.storage.put(key, image.buffer)
          written = true
        }
        const asset = em.create(MediaAsset, {
          id,
          originalName: image.name,
          storageKey: key,
          mimeType: 'image/webp',
          byteSize: image.buffer.length,
          width: image.width,
          height: image.height,
          sha256,
          alt,
        })
        await em.flush()
        return this.dto(asset)
      })
    } catch (error) {
      if (written)
        await this.em
          .fork()
          .transactional(async (em) => {
            await lockMedia(em)
            // 提交结果不确定或其他请求已接管同一文件时，不能误删已登记的资源。
            if (!(await em.findOne(MediaAsset, { id }))) await this.storage.remove(key)
          })
          .catch(() => undefined)
      if (error instanceof HttpException) throw error
      throw new ServiceUnavailableException('媒体保存失败，请稍后重试')
    }
  }
  async list(query: {
    page: number
    pageSize: number
    search?: string
    deleted: boolean
    orientation?: 'landscape' | 'portrait' | 'square'
    usage?: 'used' | 'unused'
  }) {
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
    const [items, total] = await this.em.findAndCount(
      MediaAsset,
      { $and: conditions },
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.pageSize, offset: (query.page - 1) * query.pageSize },
    )
    return { items: items.map((item) => this.dto(item)), total, page: query.page, pageSize: query.pageSize }
  }
  async references(id: string, page: number) {
    if (!(await this.em.findOne(MediaAsset, { id }))) throw new NotFoundException('媒体不存在')
    const [items, total] = await this.em.findAndCount(
      MediaReference,
      { asset: id },
      {
        populate: ['post', 'flashNote', 'moment', 'guestbookMessage', 'galleryPhoto', 'project', 'friendLink'],
        orderBy: { id: 'asc' },
        limit: 20,
        offset: (page - 1) * 20,
      },
    )
    return {
      total,
      page,
      pageSize: 20,
      items: items.map((item) => ({
        kind: item.kind,
        revision: item.revision,
        title:
          item.post?.title ??
          item.flashNote?.content.slice(0, 100) ??
          item.moment?.content.slice(0, 100) ??
          item.guestbookMessage?.content.slice(0, 100) ??
          item.galleryPhoto?.title ??
          item.project?.title ??
          item.friendLink?.name ??
          '站点头像',
        url:
          item.momentComment && item.moment
            ? `/admin/moments?comments=${encodeURIComponent(item.moment.id)}&commentId=${encodeURIComponent(item.momentComment.id)}`
            : item.flashComment && item.flashNote
              ? `/admin/flashes?comments=${encodeURIComponent(item.flashNote.id)}&commentId=${encodeURIComponent(item.flashComment.id)}`
              : item.comment
                ? `/admin/comments?commentId=${item.comment.id}`
                : item.post
                  ? `/admin/posts/${item.post.id}`
                  : item.flashNote
                    ? `/admin/flashes?edit=${encodeURIComponent(item.flashNote.id)}`
                    : item.moment
                      ? `/admin/moments/${encodeURIComponent(item.moment.id)}`
                      : item.guestbookMessage
                        ? `/admin/guestbook?focus=${item.guestbookMessage.id}`
                        : item.galleryPhoto
                          ? `/admin/gallery/${item.galleryPhoto.id}`
                          : item.project
                            ? `/admin/projects/${item.project.id}`
                            : item.friendLink
                              ? `/admin/links/${item.friendLink.id}`
                              : '/admin/site',
      })),
    }
  }
  async update(id: string, fields: { alt?: string; description?: string }) {
    const asset = await this.em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset) throw new NotFoundException('媒体不存在或已移除')
    if (fields.alt !== undefined) asset.alt = fields.alt
    if (fields.description !== undefined) asset.description = fields.description
    await this.em.flush()
    return this.dto(asset)
  }
  async remove(id: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const asset = await em.findOne(MediaAsset, { id })
      if (!asset) throw new NotFoundException('媒体不存在')
      const count = await em.count(MediaReference, { asset: id })
      if (count) throw new ConflictException(`媒体仍有 ${count} 处引用（含历史修订），不能移除`)
      asset.deletedAt = new Date()
      await em.flush()
      return { ok: true }
    })
  }
  async restore(id: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const asset = await em.findOne(MediaAsset, { id })
      if (!asset) throw new NotFoundException('媒体不存在')
      try {
        await this.storage.get(asset.storageKey)
      } catch {
        throw new ServiceUnavailableException('文件暂不可用，不能恢复')
      }
      asset.deletedAt = undefined
      await em.flush()
      return this.dto(asset)
    })
  }
  async read(id: string) {
    const asset = await this.em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset) throw new NotFoundException('媒体不存在或已移除')
    try {
      return await this.storage.get(asset.storageKey)
    } catch {
      throw new ServiceUnavailableException('媒体文件暂不可用')
    }
  }
}
