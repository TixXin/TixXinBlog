/**
 * @file flash.service.ts
 * @description 闪念业务:列表(置顶前置)、详情、全文搜索、点赞切换、访客评论
 * @author TixXin
 * @since 2026-07-20
 */

import { FilterQuery, LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { FlashComment } from '../../entities/flash-comment.entity'
import { FlashLike } from '../../entities/flash-like.entity'
import { FlashNote, FlashType } from '../../entities/flash-note.entity'
import { CreateFlashCommentDto } from './dto/create-flash-comment.dto'
import { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'
import { MediaAsset } from '../../entities/media-asset.entity'
import { lockMedia, managedMediaIds, synchronizeMediaReferences } from '../media/media-references'

/** 域错误码(api.md 附录 A):3001 闪念不存在 */
const FLASH_NOT_FOUND = 3001

/** 单博主场景默认归属(requirements.md:无多租户) */
import { SITE_OWNER_ID } from '../../common/constants/site'

const DEFAULT_AVATAR = '/avatar.svg'

/** 响应形状对齐前端 features/flash/types.ts 的 FlashNote */
export interface FlashNoteDto {
  id: string
  userId: string
  content: string
  tags: string[]
  images: string[]
  imageAlts: string[]
  type: FlashType
  createdAt: string
  updatedAt: string
  likes: number
  liked: boolean
  comments: Array<{
    id: string
    authorId: string
    authorName: string
    authorAvatar: string
    content: string
    createdAt: string
  }>
  isPinned: boolean
  isArchived: boolean
  isDraft: boolean
}

export interface FlashListResult {
  items: FlashNoteDto[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class FlashService {
  constructor(private readonly em: EntityManager) {}

  /** 列表:草稿不对外;置顶前置 + createdAt 倒序(对齐前端 LocalFlashRepository.list) */
  async findMany(query: QueryFlashDto, visitor = ''): Promise<FlashListResult> {
    if (query.archived) throw new BadRequestException('归档内容请使用管理员接口读取')
    if (query.userId && query.userId !== SITE_OWNER_ID) throw new BadRequestException('此接口只提供本站公开闪念')
    const where: FilterQuery<FlashNote> = {
      userId: SITE_OWNER_ID,
      isDraft: false,
      isArchived: false,
    }
    if (query.tag) where.tags = { $contains: [query.tag] }

    const [notes, total] = await this.em.findAndCount(FlashNote, where, {
      populate: ['comments'],
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })

    return {
      items: await this.serialize(notes, visitor),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async findOne(id: string, visitor = ''): Promise<FlashNoteDto> {
    const note = await this.em.findOne(
      FlashNote,
      { id, userId: SITE_OWNER_ID, isDraft: false, isArchived: false },
      { populate: ['comments'] },
    )
    if (!note) throw new BusinessException(FLASH_NOT_FOUND, '闪念不存在', HttpStatus.NOT_FOUND)
    return (await this.serialize([note], visitor))[0]!
  }

  /** 正文和标签字面搜索；相同创建时间按编号稳定分页。 */
  async search(query: SearchFlashDto, visitor = ''): Promise<FlashListResult> {
    const kw = '%' + query.q.replace(/[\\%_]/g, (char) => '\\' + char) + '%'
    if (query.userId && query.userId !== SITE_OWNER_ID) throw new BadRequestException('此接口只提供本站公开闪念')
    const where: FilterQuery<FlashNote> = {
      userId: SITE_OWNER_ID,
      isDraft: false,
      isArchived: false,
      $or: [{ content: { $ilike: kw } }, { tags: { $contains: [query.q] } }],
    }
    const [notes, total] = await this.em.findAndCount(FlashNote, where, {
      populate: ['comments'],
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: await this.serialize(notes, visitor), total, page: query.page, pageSize: query.pageSize }
  }

  async toggleLike(id: string, visitorIdHash: string): Promise<{ liked: boolean; likes: number }> {
    return this.em.transactional(async (em) => {
      const note = await em.findOne(
        FlashNote,
        { id, userId: SITE_OWNER_ID, isDraft: false, isArchived: false },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!note) throw new BusinessException(FLASH_NOT_FOUND, '闪念不存在', HttpStatus.NOT_FOUND)
      const existing = await em.findOne(FlashLike, { flashNote: note, visitorIdHash })
      if (existing) {
        em.remove(existing)
        note.likes = Math.max(0, note.likes - 1)
      } else {
        em.create(FlashLike, { flashNote: note, visitorIdHash, createdAt: new Date() })
        note.likes += 1
      }
      await em.flush()
      return { liked: !existing, likes: note.likes }
    })
  }

  async addComment(
    id: string,
    dto: CreateFlashCommentDto,
    visitorIdHash: string,
  ): Promise<FlashNoteDto['comments'][number]> {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(
        FlashNote,
        { id, userId: SITE_OWNER_ID, isDraft: false, isArchived: false },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!note) throw new BusinessException(FLASH_NOT_FOUND, '闪念不存在', HttpStatus.NOT_FOUND)
      const comment = em.create(FlashComment, {
        flashNote: note,
        authorId: visitorIdHash,
        authorName: dto.authorName,
        authorAvatar: dto.authorAvatar ?? DEFAULT_AVATAR,
        content: dto.content,
        createdAt: new Date(),
      })
      await em.flush()
      await synchronizeMediaReferences(em, `flash-comment:${comment.id}`, 'flash-comment', [comment.authorAvatar], {
        flashNote: note,
        flashComment: comment,
      })
      await em.flush()
      return {
        id: comment.id,
        authorId: comment.authorId,
        authorName: comment.authorName,
        authorAvatar: comment.authorAvatar,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
      }
    })
  }

  async serialize(notes: FlashNote[], visitor: string): Promise<FlashNoteDto[]> {
    const ids = managedMediaIds(notes.map((note) => note.images))
    const assets = ids.length ? await this.em.find(MediaAsset, { id: { $in: ids } }) : []
    const descriptions = new Map(assets.map((asset) => [asset.id, asset.alt]))
    const likes =
      visitor && notes.length
        ? await this.em.find(FlashLike, { visitorIdHash: visitor, flashNote: { $in: notes.map((note) => note.id) } })
        : []
    const liked = new Set(likes.map((like) => like.flashNote.id))
    return notes.map((note) => this.toDto(note, liked.has(note.id), descriptions))
  }

  private toDto(note: FlashNote, liked: boolean, descriptions: Map<string, string>): FlashNoteDto {
    return {
      id: note.id,
      userId: note.userId,
      content: note.content,
      tags: note.tags,
      images: note.images,
      imageAlts: note.images.map((url) => descriptions.get(managedMediaIds([url])[0] ?? '') ?? ''),
      type: note.type,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      likes: note.likes,
      liked,
      comments: note.comments
        .getItems()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((c) => ({
          id: c.id,
          authorId: c.authorId,
          authorName: c.authorName,
          authorAvatar: c.authorAvatar,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
        })),
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      isDraft: note.isDraft,
    }
  }
}
