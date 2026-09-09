/**
 * @file media.service.ts
 * @description 媒体上传、检索、引用保护及回收；同一上传标识重试不重复创建资源。
 */
import { EntityManager } from '@mikro-orm/postgresql'
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
  async list(query: { page: number; pageSize: number; search?: string; deleted: boolean }) {
    const [items, total] = await this.em.findAndCount(
      MediaAsset,
      {
        deletedAt: query.deleted ? { $ne: null } : null,
        ...(query.search
          ? {
              $or: [
                { originalName: { $ilike: `%${query.search}%` } },
                { alt: { $ilike: `%${query.search}%` } },
                ...(isUUID(query.search) ? [{ id: query.search }] : []),
              ],
            }
          : {}),
      },
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
        populate: ['post', 'flashNote', 'moment', 'guestbookMessage'],
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
          '站点头像',
        url: item.post
          ? `/admin/posts/${item.post.id}`
          : item.flashNote
            ? '/admin/flashes'
            : item.moment
              ? `/admin/moments?edit=${encodeURIComponent(item.moment.id)}`
              : item.guestbookMessage
                ? `/admin/guestbook?focus=${item.guestbookMessage.id}`
                : '/admin/site',
      })),
    }
  }
  async update(id: string, alt: string) {
    const asset = await this.em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset) throw new NotFoundException('媒体不存在或已移除')
    asset.alt = alt
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
