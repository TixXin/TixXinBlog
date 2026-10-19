/**
 * @file admin-flash.service.ts
 * @description 单站点闪念写入；不接受客户端所有者 ID，保留原有 tixxin 内容归属；后台读取返回全部审核状态的评论
 */
import { FilterQuery, LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { FlashNote } from '../../entities/flash-note.entity'
import { FlashComment } from '../../entities/flash-comment.entity'
import { SITE_OWNER_ID } from '../../common/constants/site'
import { FlashService } from './flash.service'
import type { SaveFlashDto } from './admin-flash.controller'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { msg } from '../../common/i18n'

@Injectable()
export class AdminFlashService {
  constructor(
    private readonly em: EntityManager,
    private readonly publicFlashes: FlashService,
  ) {}
  async list(
    query: { page: number; pageSize: number; archived: boolean; search?: string; status?: string },
    visitor: string,
  ) {
    const where: FilterQuery<FlashNote> = { userId: SITE_OWNER_ID, isArchived: query.archived }
    if (query.status === 'all') delete where.isArchived
    if (query.status === 'archived') where.isArchived = true
    if (query.status === 'draft' || query.status === 'published') {
      where.isArchived = false
      where.isDraft = query.status === 'draft'
    }
    if (query.search) where.content = { $ilike: `%${query.search}%` }
    const [notes, total] = await this.em.findAndCount(FlashNote, where, {
      populate: ['comments'],
      orderBy: { isPinned: 'desc', createdAt: 'desc', id: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return {
      items: await this.publicFlashes.serialize(notes, visitor, true),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async detail(id: string) {
    const note = await this.em.findOne(FlashNote, { id, userId: SITE_OWNER_ID }, { populate: ['comments'] })
    if (!note) throw new NotFoundException(msg('flash.notFound'))
    return (await this.publicFlashes.serialize([note], '', true))[0]!
  }
  async save(id: string | null, input: SaveFlashDto) {
    if (!id && !input.content) throw new BadRequestException(msg('flash.contentRequired'))
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = id
        ? await em.findOne(FlashNote, { id, userId: SITE_OWNER_ID }, { lockMode: LockMode.PESSIMISTIC_WRITE })
        : em.create(FlashNote, {
            userId: SITE_OWNER_ID,
            content: input.content!,
            tags: [],
            images: [],
            type: 'memo',
            likes: 0,
            isPinned: false,
            isArchived: false,
            isDraft: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
      if (!note) throw new NotFoundException(msg('flash.notFound'))
      Object.assign(note, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)))
      if (input.images) {
        note.images = input.images.map((value) => value.trim())
        for (const value of note.images) {
          if (/^\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/.test(value)) continue
          try {
            const url = new URL(value)
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('url')
          } catch {
            throw new BadRequestException(msg('flash.imageUrlInvalid'))
          }
        }
      }
      if (input.tags) note.tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))]
      await em.flush()
      await synchronizeMediaReferences(em, `flash:${note.id}`, 'flash', [note.content, note.images], {
        flashNote: note,
      })
      await em.flush()
      await em.populate(note, ['comments'])
      return (await this.publicFlashes.serialize([note], '', true))[0]!
    })
  }
  async remove(id: string) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const count = await em.nativeDelete(FlashNote, { id, userId: SITE_OWNER_ID })
      if (!count) throw new NotFoundException(msg('flash.notFound'))
      return { ok: true }
    })
  }
  async removeComment(id: string, commentId: string) {
    const count = await this.em.nativeDelete(FlashComment, { id: commentId, flashNote: { id, userId: SITE_OWNER_ID } })
    if (!count) throw new NotFoundException(msg('comment.notFound'))
    return { ok: true }
  }
}
