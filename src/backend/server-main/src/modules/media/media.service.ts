/**
 * @file media.service.ts
 * @description 媒体上传、检索、引用保护及回收；同一上传标识重试不重复创建资源。
 * 公开读取可按白名单宽度返回 WebP 变体，变体首次请求时生成并缓存到磁盘，同一变体并发只生成一次。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { msg, type ApiLocale } from '../../common/i18n'
import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { MediaStorage, mediaVariantName } from './media-storage'
import { normalizeImage, resizeImageVariant } from './media-image'
import type { MediaVariantWidth, UploadedImage } from './media-image'
import { lockMedia } from './media-references'
import { buildMediaFilter, formatMediaReference, toMediaDto } from './media-query'

// 同时生成变体的上限：变体只在首次请求时生成，限制并发避免公开请求集中占满 CPU。
const VARIANT_CONCURRENCY = 2

@Injectable()
export class MediaService {
  private readonly pendingVariants = new Map<string, Promise<Buffer>>()
  private activeVariants = 0
  private readonly variantQueue: (() => void)[] = []

  constructor(
    private readonly em: EntityManager,
    private readonly storage: MediaStorage,
  ) {}

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
          if (existing.sha256 !== sha256 || existing.deletedAt) throw new ConflictException(msg('media.uploadIdUsed'))
          return toMediaDto(existing)
        }
        const previous = await this.storage.readIfExists(key)
        if (previous) {
          if (createHash('sha256').update(previous).digest('hex') !== sha256)
            throw new ConflictException(msg('media.resourceIdMismatch'))
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
        return toMediaDto(asset)
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
      throw new ServiceUnavailableException(msg('media.saveFailed'))
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
    const [items, total] = await this.em.findAndCount(MediaAsset, buildMediaFilter(query), {
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: items.map((item) => toMediaDto(item)), total, page: query.page, pageSize: query.pageSize }
  }

  async references(id: string, page: number, locale: ApiLocale = 'zh-CN') {
    if (!(await this.em.findOne(MediaAsset, { id }))) throw new NotFoundException(msg('media.notFound'))
    const [items, total] = await this.em.findAndCount(
      MediaReference,
      { asset: id },
      {
        populate: [
          'post',
          'flashNote',
          'moment',
          'guestbookMessage',
          'galleryPhoto',
          'project',
          'subscription',
          'friendLink',
          'imagePrompt',
        ],
        orderBy: { id: 'asc' },
        limit: 20,
        offset: (page - 1) * 20,
      },
    )
    return {
      total,
      page,
      pageSize: 20,
      items: items.map((item) => formatMediaReference(item, locale)),
    }
  }

  async update(id: string, fields: { alt?: string; description?: string }) {
    const asset = await this.em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset) throw new NotFoundException(msg('media.notFoundOrRemoved'))
    if (fields.alt !== undefined) asset.alt = fields.alt
    if (fields.description !== undefined) asset.description = fields.description
    await this.em.flush()
    return toMediaDto(asset)
  }

  async remove(id: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const asset = await em.findOne(MediaAsset, { id })
      if (!asset) throw new NotFoundException(msg('media.notFound'))
      const count = await em.count(MediaReference, { asset: id })
      if (count) throw new ConflictException(msg('media.stillReferenced', { count }))
      asset.deletedAt = new Date()
      await em.flush()
      // 回收后公开读取即返回 404，变体同步清理；恢复时按需重新生成。
      await this.storage.removeVariants(asset.storageKey).catch(() => undefined)
      return { ok: true }
    })
  }

  async restore(id: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const asset = await em.findOne(MediaAsset, { id })
      if (!asset) throw new NotFoundException(msg('media.notFound'))
      try {
        await this.storage.get(asset.storageKey)
      } catch {
        throw new ServiceUnavailableException(msg('media.fileUnavailableForRestore'))
      }
      asset.deletedAt = undefined
      await em.flush()
      return toMediaDto(asset)
    })
  }

  async read(id: string, options: { ifNoneMatch?: string; head?: boolean; width?: MediaVariantWidth } = {}) {
    const asset = await this.em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset) throw new NotFoundException(msg('media.notFoundOrRemoved'))
    try {
      await this.storage.assertReadable(asset.storageKey)
      // 请求宽度不小于原图宽度时直接返回原图，避免为同一字节生成多份缓存。
      const width = options.width && options.width < asset.width ? options.width : undefined
      const etag = width ? `"${asset.sha256}-w${width}"` : `"${asset.sha256}"`
      const notModified = (options.ifNoneMatch ?? '')
        .split(',')
        .some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag)
      if (!width || notModified)
        return {
          etag,
          byteSize: asset.byteSize,
          notModified,
          content: notModified || options.head ? undefined : await this.storage.get(asset.storageKey),
        }
      const content = await this.variant(asset, width)
      return { etag, byteSize: content.length, notModified, content: options.head ? undefined : content }
    } catch {
      throw new ServiceUnavailableException(msg('media.fileUnavailable'))
    }
  }

  private variant(asset: MediaAsset, width: MediaVariantWidth) {
    const name = mediaVariantName(asset.id, width, asset.sha256)
    const pending = this.pendingVariants.get(name)
    if (pending) return pending
    const operation = this.loadVariant(asset.storageKey, name, width).finally(() => this.pendingVariants.delete(name))
    this.pendingVariants.set(name, operation)
    return operation
  }

  private async loadVariant(key: string, name: string, width: MediaVariantWidth) {
    const cached = await this.storage.readVariant(name)
    if (cached) return cached
    await this.acquireVariantSlot()
    try {
      const content = await resizeImageVariant(await this.storage.get(key), width)
      // 缓存写入失败（磁盘满、只读挂载）不影响本次响应，下次请求重新生成。
      await this.storage.writeVariant(name, content).catch(() => undefined)
      return content
    } finally {
      this.releaseVariantSlot()
    }
  }

  private acquireVariantSlot() {
    if (this.activeVariants < VARIANT_CONCURRENCY) {
      this.activeVariants++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => this.variantQueue.push(resolve))
  }

  private releaseVariantSlot() {
    const next = this.variantQueue.shift()
    if (next) next()
    else this.activeVariants--
  }
}
