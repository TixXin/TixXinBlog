/** @file moment-write.service.ts @description 朋友圈管理写入、版本检查、重复发布去重和媒体引用事务 */
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { Post } from '../../entities/post.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import type { SaveMomentDto } from './moment.dto'
import { MomentReadService } from './moment-read.service'
import { momentValues, submissionHash } from './moment-values'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'

@Injectable()
export class MomentWriteService {
  constructor(
    private readonly em: EntityManager,
    private readonly read: MomentReadService,
  ) {}

  async save(id: string | null, input: SaveMomentDto) {
    if (!id && (!input.content?.trim() || !input.requestId)) throw new BadRequestException('发布需要正文和唯一提交标识')
    if (id && input.revision === undefined) throw new BadRequestException('请先读取动态后再编辑')
    if (id && input.requestId !== undefined) throw new BadRequestException('编辑不接受发布提交标识')
    const values = momentValues(input)
    const hash = submissionHash(values)
    const savedId = await this.em.transactional(async (em) => {
      await lockMedia(em)
      if (!id) {
        const existing = await em.findOne(Moment, { requestId: input.requestId })
        if (existing) {
          if (existing.deletedAt || existing.requestHash !== hash)
            throw new ConflictException('提交标识已处理，请重新读取动态')
          return existing.id
        }
      }
      const note = id
        ? await em.findOne(Moment, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
        : em.create(Moment, { content: input.content!, requestId: input.requestId, requestHash: hash })
      if (!note) throw new NotFoundException('动态不存在或已删除')
      if (id && note.revision !== input.revision)
        throw new ConflictException('动态已被更新，请保留输入并重新读取后再保存')
      const { linkedArticleId, ...fields } = values
      if (linkedArticleId !== undefined) {
        // 已建立的引用允许随文章撤回保留，公开序列化仍隐藏其信息；新增引用必须指向公开文章。
        const unchanged = !!linkedArticleId && linkedArticleId === note.linkedArticle?.id
        const post = unchanged
          ? note.linkedArticle
          : linkedArticleId
            ? await em.findOne(Post, { id: linkedArticleId, deletedAt: null, status: 'published' })
            : null
        if (linkedArticleId && !post) throw new BadRequestException('只能引用已公开的站内文章')
        note.linkedArticle = post
        if (post) note.linkedLink = null
      }
      Object.assign(note, fields)
      if (fields.linkedLink) note.linkedArticle = null
      if (note.status === 'published' && !note.publishedAt) note.publishedAt = new Date()
      if (id) note.revision += 1
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `moment:${note.id}`,
        'moment',
        [note.content, note.images, note.linkedLink],
        { moment: note },
      )
      await em.flush()
      return note.id
    })
    return this.read.detail(savedId, '', true)
  }
  async remove(id: string, revision: number) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(Moment, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!note) throw new NotFoundException('动态不存在')
      if (note.deletedAt) return { ok: true }
      if (note.revision !== revision) throw new ConflictException('动态已被更新，请刷新后确认删除')
      note.deletedAt = new Date()
      note.revision += 1
      note.likes = 0
      await em.nativeUpdate(MomentComment, { moment: note, deletedAt: null }, { deletedAt: new Date() })
      await em.nativeDelete(MomentLike, { moment: note })
      await em.nativeDelete(MediaReference, { moment: note })
      await em.flush()
      return { ok: true }
    })
  }
}
