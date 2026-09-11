/** @file gallery.service.ts @description 图库公开投影、稳定分页与带去重和版本保护的管理事务 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { galleryExternalUrl } from './gallery-values'
import type { AdminGalleryQuery, GalleryQuery, SaveGalleryDto, SaveGallerySettingsDto } from './gallery.dto'
import {
  normalizeContentRelations,
  resolveContentRelations,
  validateContentRelations,
} from '../content-relations/content-relations'

const publicPhotos = { deletedAt: null, status: 'published' } as const
function galleryId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException('作品编号不合法')
}
@Injectable()
export class GalleryService {
  constructor(private readonly em: EntityManager) {}

  serialize(photo: GalleryPhoto, admin = false) {
    const result = {
      id: photo.id,
      title: photo.title,
      description: photo.description,
      source: photo.media ? 'media' : 'external',
      src: photo.media ? mediaUrl(photo.media.id) : photo.externalUrl!,
      srcLarge: photo.media ? mediaUrl(photo.media.id) : photo.externalUrl!,
      width: photo.media?.width,
      height: photo.media?.height,
      format: photo.media?.mimeType,
      category: photo.category,
      date: photo.takenOn ?? '',
      location: photo.location,
      device: photo.device,
      publishedAt: photo.publishedAt?.toISOString() ?? null,
    }
    return admin
      ? {
          ...result,
          mediaId: photo.media?.id ?? null,
          relatedContent: photo.relatedContent,
          externalUrl: photo.externalUrl ?? null,
          takenOn: photo.takenOn ?? null,
          status: photo.status,
          revision: photo.revision,
          sortOrder: photo.sortOrder,
          createdAt: photo.createdAt.toISOString(),
          updatedAt: photo.updatedAt.toISOString(),
        }
      : result
  }
  async list(query: GalleryQuery | AdminGalleryQuery, admin = false) {
    const where: FilterQuery<GalleryPhoto> = admin ? { deletedAt: null } : { ...publicPhotos }
    const status = (query as AdminGalleryQuery).status
    if (admin && status && status !== 'all') where.status = status
    if (query.category !== undefined) where.category = query.category
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      where.$or = ['title', 'description', 'location'].map((key) => ({ [key]: { $ilike: pattern } }))
    }
    const [items, total] = await this.em.findAndCount(GalleryPhoto, where, {
      populate: ['media'],
      orderBy: { sortOrder: 'DESC', id: 'DESC' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return {
      items: items.map((item) => this.serialize(item, admin)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async detail(id: number, admin = false) {
    galleryId(id)
    const item = await this.em.findOne(GalleryPhoto, admin ? { id, deletedAt: null } : { id, ...publicPhotos }, {
      populate: ['media'],
    })
    if (!item) throw new NotFoundException('作品不存在或尚未公开')
    return {
      ...this.serialize(item, admin),
      relatedContent: admin ? item.relatedContent : await resolveContentRelations(this.em, item.relatedContent),
    }
  }
  async submission(requestId: string) {
    const item = await this.em.findOne(GalleryPhoto, { requestId }, { populate: ['media'] })
    if (!item) throw new NotFoundException('尚未找到此提交，请使用原提交标识重试')
    return item.deletedAt ? { state: 'deleted', id: item.id } : { state: 'saved', item: this.serialize(item, true) }
  }
  async navigation(id: number, query: GalleryQuery) {
    galleryId(id)
    if (!(await this.em.count(GalleryPhoto, { id, ...publicPhotos })))
      throw new NotFoundException('作品不存在或尚未公开')
    const clauses = ["status='published'", 'deleted_at is null']
    const parameters: (string | number)[] = []
    if (query.category !== undefined) {
      clauses.push('category=?')
      parameters.push(query.category)
    }
    if (query.q) {
      clauses.push('(title ilike ? or description ilike ? or location ilike ?)')
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      parameters.push(pattern, pattern, pattern)
    }
    // 窗口先应用与列表相同的过滤和稳定排序，再定位作品；深链不依赖当前页缓存。
    const [position] = await this.em.execute<{ previousId: number | null; nextId: number | null; position: number }[]>(
      `select "previousId","nextId",position::int from (
        select id,lag(id) over w as "previousId",lead(id) over w as "nextId",row_number() over w as position
        from gallery_photo where ${clauses.join(' and ')} window w as (order by sort_order desc,id desc)
      ) ordered where id=?`,
      [...parameters, id],
    )
    return {
      matched: !!position,
      page: position ? Math.ceil(position.position / query.pageSize) : null,
      previousId: position?.previousId ?? null,
      nextId: position?.nextId ?? null,
      previousPage: position?.previousId ? Math.ceil((position.position - 1) / query.pageSize) : null,
      nextPage: position?.nextId ? Math.ceil((position.position + 1) / query.pageSize) : null,
    }
  }
  async metadata() {
    const categories = await this.em.execute<{ value: string; count: number }[]>(
      "select category as value,count(*)::int as count from gallery_photo where deleted_at is null and status='published' group by category order by category",
    )
    const [stats] = await this.em.execute<{ photos: number; locations: number; categories: number }[]>(
      "select count(*)::int as photos,count(distinct nullif(location,''))::int as locations,count(distinct nullif(category,''))::int as categories from gallery_photo where deleted_at is null and status='published'",
    )
    const settings = await this.settings()
    return {
      categories: categories.map((item) => ({ ...item, label: item.value || '未分类' })),
      stats,
      gear: settings.gear,
    }
  }
  async settings() {
    const settings = await this.em.findOneOrFail(GallerySettings, { id: 'default' })
    return { gear: settings.gear, revision: settings.revision, updatedAt: settings.updatedAt.toISOString() }
  }
  async saveSettings(input: SaveGallerySettingsDto) {
    await this.em.transactional(async (em) => {
      await lockMedia(em)
      const settings = await em.findOneOrFail(
        GallerySettings,
        { id: 'default' },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (settings.revision !== input.revision) throw new ConflictException('器材配置已变化，请保留输入并重新读取')
      settings.gear = input.gear
      settings.revision++
      settings.updatedAt = new Date()
      await em.flush()
    })
    return this.settings()
  }
  async save(id: number | null, input: SaveGalleryDto) {
    if (id !== null) galleryId(id)
    if (id === null && input.revision !== undefined) throw new BadRequestException('创建作品不能携带编辑版本')
    if (!id && (!input.title || !input.requestId)) throw new BadRequestException('创建作品需要标题、图片来源和提交标识')
    if (id && (input.revision === undefined || input.requestId !== undefined))
      throw new BadRequestException('编辑需要当前版本，不能携带创建标识')
    const { requestId, mediaId } = input
    if (input.externalUrl !== undefined && input.externalUrl !== null) galleryExternalUrl(input.externalUrl)
    // 装饰器 DTO 含未提交的 undefined 属性；局部更新只能应用明确提供的字段。
    const values = Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => !['requestId', 'mediaId', 'revision'].includes(key) && value !== undefined,
      ),
    )
    if (input.relatedContent !== undefined) values.relatedContent = normalizeContentRelations(input.relatedContent)
    // 旧媒体提交没有 externalUrl 字段，显式清空与省略保持相同创建去重语义。
    const hash = submissionHash(
      Object.fromEntries(
        Object.entries({ mediaId, ...values }).filter(
          ([key, value]) =>
            !(key === 'externalUrl' && value === null) &&
            !(key === 'relatedContent' && Array.isArray(value) && !value.length),
        ),
      ),
    )
    const savedId = await this.em.transactional(async (em) => {
      await lockMedia(em)
      if (!id) {
        const prior = await em.findOne(GalleryPhoto, { requestId })
        if (prior) {
          if (prior.deletedAt || prior.requestHash !== hash) throw new ConflictException('此提交已处理，请核查原作品')
          return prior.id
        }
      }
      const media = mediaId ? await em.findOne(MediaAsset, { id: mediaId, deletedAt: null }) : undefined
      if (mediaId && (!media || !media.mimeType.startsWith('image/') || media.width < 1 || media.height < 1))
        throw new BadRequestException('请选择有效的媒体库图片')
      const photo = id
        ? await em.findOne(GalleryPhoto, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
        : em.create(GalleryPhoto, { title: input.title!, media: media!, requestId, requestHash: hash })
      if (!photo) throw new NotFoundException('作品不存在或已删除')
      if (id && photo.revision !== input.revision) throw new ConflictException('作品已被修改，请保留输入并重新读取')
      if (values.relatedContent !== undefined)
        values.relatedContent = await validateContentRelations(
          em,
          values.relatedContent,
          photo.relatedContent,
          id === null ? undefined : { type: 'gallery', id },
        )
      Object.assign(photo, values)
      if (mediaId !== undefined) photo.media = media ?? null
      if (Boolean(photo.media) === Boolean(photo.externalUrl))
        throw new BadRequestException('每件作品必须恰好选择一种图片来源；切换时请明确清空另一来源')
      if (photo.status === 'published' && !photo.publishedAt) photo.publishedAt = new Date()
      if (id) photo.revision++
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `gallery:${photo.id}`,
        'gallery',
        photo.media ? [mediaUrl(photo.media.id)] : [],
        {
          galleryPhoto: photo,
        },
      )
      await em.flush()
      return photo.id
    })
    return this.detail(savedId, true)
  }
  async remove(id: number, revision: number) {
    galleryId(id)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const photo = await em.findOne(GalleryPhoto, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!photo) throw new NotFoundException('作品不存在')
      if (photo.deletedAt) return { ok: true }
      if (photo.revision !== revision) throw new ConflictException('作品已变化，请重新读取后确认删除')
      photo.deletedAt = new Date()
      photo.revision++
      await em.nativeDelete(MediaReference, { galleryPhoto: photo })
      await em.flush()
      return { ok: true }
    })
  }
}
