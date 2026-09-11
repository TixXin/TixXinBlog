/** @file moment-read.service.ts @description 朋友圈公开/管理分页、评论预览与真实聚合，避免将私有状态混入公开响应 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { raw } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import { Moment } from '../../entities/moment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { QueryAdminMomentsDto, QueryMomentsDto, MomentPageQuery, QueryAdminMomentCommentsDto } from './moment.dto'
import { momentWhere, publicMoments } from './moment-values'
import { managedMediaIds } from '../media/media-references'

interface CommentRow {
  id: string
  moment_id: string
  author: string
  avatar: string
  content: string
  created_at: Date
  is_owner: boolean
  status: string
}
export function momentCommentDto(comment: MomentComment) {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    time: comment.createdAt.toISOString(),
    isOwner: comment.isOwner,
    moderationStatus: comment.status,
  }
}

@Injectable()
export class MomentReadService {
  constructor(private readonly em: EntityManager) {}

  async list(query: QueryMomentsDto | QueryAdminMomentsDto, visitor = '', admin = false) {
    const where: FilterQuery<Moment> = {
      $and: [
        momentWhere(query, admin),
        ...(admin && 'status' in query && query.status && query.status !== 'all' ? [{ status: query.status }] : []),
      ],
    }
    const [items, total] = await this.em.findAndCount(Moment, where, {
      populate: ['linkedArticle'],
      orderBy: { isPinned: 'desc', publishedAt: 'desc', createdAt: 'desc', id: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: await this.serialize(items, visitor, admin), total, page: query.page, pageSize: query.pageSize }
  }
  async require(id: string, admin = false) {
    const note = await this.em.findOne(
      Moment,
      { id, ...(admin ? { deletedAt: null } : publicMoments) },
      { populate: ['linkedArticle'], refresh: true },
    )
    if (!note) throw new NotFoundException('动态不存在或尚未公开')
    return note
  }
  async detail(id: string, visitor = '', admin = false) {
    return (await this.serialize([await this.require(id, admin)], visitor, admin))[0]!
  }
  async submission(requestId: string) {
    const note = await this.em.findOne(Moment, { requestId, deletedAt: null })
    if (!note) throw new NotFoundException('尚未找到这次提交保存的动态')
    return this.detail(note.id, '', true)
  }
  async navigation(id: string) {
    const current = await this.require(id)
    const date = current.publishedAt ?? current.createdAt
    const nearest = async (direction: 'asc' | 'desc') => {
      const comparison = direction === 'asc' ? '$gt' : '$lt'
      const note = await this.em.findOne(
        Moment,
        {
          ...publicMoments,
          $or: [
            { publishedAt: { [comparison]: date } },
            { publishedAt: date, createdAt: { [comparison]: current.createdAt } },
            { publishedAt: date, createdAt: current.createdAt, id: { [comparison]: id } },
          ],
        },
        { orderBy: { publishedAt: direction, createdAt: direction, id: direction } },
      )
      return note ? { id: note.id, content: note.content.slice(0, 160) } : null
    }
    const [prev, next] = await Promise.all([nearest('asc'), nearest('desc')])
    return { prev, next }
  }
  async adminComments(query: QueryAdminMomentCommentsDto) {
    const [items, total] = await this.em.findAndCount(
      MomentComment,
      {
        deletedAt: null,
        moment: { deletedAt: null },
        ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      },
      {
        populate: ['moment'],
        orderBy: { createdAt: 'desc', id: 'desc' },
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    )
    return {
      items: items.map((comment) => ({
        ...momentCommentDto(comment),
        momentId: comment.moment.id,
        momentContent: comment.moment.content.slice(0, 160),
        momentStatus: comment.moment.status,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async comments(id: string, query: MomentPageQuery, visitor = '', admin = false) {
    await this.require(id, admin)
    const where: FilterQuery<MomentComment> = { moment: id, deletedAt: null }
    if (!admin) where.$or = [{ status: 'published' }, { status: 'pending', visitorIdHash: visitor || '__anonymous__' }]
    const [items, total] = await this.em.findAndCount(MomentComment, where, {
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: items.map(momentCommentDto), total, page: query.page, pageSize: query.pageSize }
  }
  async commentLocation(id: string, commentId: string) {
    await this.require(id, true)
    const target = await this.em.findOne(MomentComment, { id: commentId, moment: id, deletedAt: null })
    if (!target) throw new NotFoundException('评论不存在、已删除或不属于这条动态')
    const preceding = await this.em.count(MomentComment, {
      moment: id,
      deletedAt: null,
      $or: [{ createdAt: { $lt: target.createdAt } }, { createdAt: target.createdAt, id: { $lt: target.id } }],
    })
    // 与管理评论面板每页 15 条、时间和编号升序的顺序保持一致。
    return { commentId, page: Math.floor(preceding / 15) + 1, pageSize: 15 }
  }
  async overview() {
    const connection = this.em.getConnection()
    const [stats] = await connection.execute<{ totalMoments: number; totalLikes: number; totalComments: number }[]>(`
      select count(*)::int as "totalMoments", coalesce(sum(likes),0)::int as "totalLikes",
      (select count(*)::int from moment_comment c join moment m on m.id=c.moment_id
       where m.status='published' and m.deleted_at is null and c.status='published' and c.deleted_at is null) as "totalComments"
      from moment where status='published' and deleted_at is null`)
    const topics = await connection.execute<{ name: string; count: number }[]>(`
      select topic as name,count(*)::int as count from moment cross join lateral jsonb_array_elements_text(topics) topic
      where status='published' and deleted_at is null group by topic order by count desc,topic asc`)
    const dates = await connection.execute<{ date: string; count: number }[]>(`
      select to_char(published_at at time zone 'UTC','YYYY-MM-DD') as date,count(*)::int as count
      from moment where status='published' and deleted_at is null group by date order by date desc`)
    const photos = await this.em.find(
      Moment,
      { ...publicMoments, [raw((alias) => `jsonb_array_length(${alias}.images)`)]: { $gt: 0 } },
      {
        orderBy: { likes: 'desc', publishedAt: 'desc', id: 'desc' },
        limit: 9,
      },
    )
    const recent = await this.em.find(Moment, publicMoments, {
      populate: ['linkedArticle'],
      orderBy: { [raw('random()')]: 'asc' },
      limit: 12,
    })
    const today = new Date()
    const from = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()))
    const anniversary =
      from.getUTCMonth() === today.getUTCMonth()
        ? await this.em.findOne(
            Moment,
            { ...publicMoments, publishedAt: { $gte: from, $lt: new Date(from.getTime() + 86400000) } },
            { orderBy: { publishedAt: 'desc', id: 'desc' } },
          )
        : null
    if (anniversary && !recent.some((item) => item.id === anniversary.id)) recent.push(anniversary)
    return {
      stats,
      topics,
      dates,
      photos: photos.map((note) => ({ src: note.images[0], momentId: note.id })),
      recollections: recent.map((note) => ({
        id: note.id,
        content: note.content.slice(0, 300),
        date: (note.publishedAt ?? note.createdAt).toISOString(),
      })),
    }
  }
  async serialize(items: Moment[], visitor: string, admin: boolean) {
    if (!items.length) return []
    const ids = items.map((item) => item.id)
    const marks = ids.map(() => '?').join(',')
    const connection = this.em.getConnection()
    const visibility = admin ? 'true' : "(status='published' or (status='pending' and visitor_id_hash=?))"
    const comments = await connection.execute<CommentRow[]>(
      `
      select * from (select c.*,row_number() over(partition by moment_id order by created_at desc,id desc) as sequence
      from moment_comment c where moment_id in (${marks}) and deleted_at is null and ${visibility}) ranked where sequence <= 3`,
      [...ids, ...(admin ? [] : [visitor || '__anonymous__'])],
    )
    const counts = await connection.execute<{ moment_id: string; count: number }[]>(
      `
      select moment_id,count(*)::int as count from moment_comment where moment_id in (${marks})
      and status='published' and deleted_at is null group by moment_id`,
      ids,
    )
    const likes = visitor ? await this.em.find(MomentLike, { moment: { $in: ids }, visitorIdHash: visitor }) : []
    const liked = new Set(likes.map((like) => like.moment.id))
    const mediaIds = managedMediaIds(items.map((item) => item.images))
    const media = mediaIds.length ? await this.em.find(MediaAsset, { id: { $in: mediaIds } }) : []
    const alts = new Map(media.map((asset) => [asset.id, asset.alt]))
    return items.map((note) => {
      const linked = note.linkedArticle
      return {
        id: note.id,
        content: note.content,
        images: note.images,
        imageAlts: note.images.map((url) => alts.get(managedMediaIds([url])[0] ?? '') ?? ''),
        date: (note.publishedAt ?? note.createdAt).toISOString(),
        location: note.location,
        device: note.device,
        mood: note.mood,
        topics: note.topics,
        likes: note.likes,
        isLiked: liked.has(note.id),
        isPinned: note.isPinned,
        commentCount: counts.find((count) => count.moment_id === note.id)?.count ?? 0,
        comments: comments
          .filter((comment) => comment.moment_id === note.id)
          .sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id),
          )
          .map((comment) => ({
            id: comment.id,
            author: comment.author,
            avatar: comment.avatar,
            content: comment.content,
            time: new Date(comment.created_at).toISOString(),
            isOwner: comment.is_owner,
            moderationStatus: comment.status,
          })),
        linkedArticle:
          linked && linked.status === 'published' && !linked.deletedAt
            ? {
                id: String(linked.id),
                title: linked.title,
                summary: linked.summary,
                cover: linked.cover,
                url: `/articles/${linked.slug || linked.id}`,
              }
            : null,
        linkedLink: note.linkedLink,
        ...(admin
          ? {
              status: note.status,
              revision: note.revision,
              linkedArticleId: linked?.id ?? null,
              createdAt: note.createdAt.toISOString(),
              updatedAt: note.updatedAt.toISOString(),
            }
          : {}),
      }
    })
  }
}
