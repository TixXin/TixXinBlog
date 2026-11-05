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
import { msg } from '../../common/i18n'
import { readSiteTimeZone, zonedDayStart, zonedParts } from '../site/site-time-zone'
import {
  CommentRow,
  ReactionRow,
  LINKED_ARTICLE_FIELDS,
  MOMENT_LOCATIONS_SQL,
  recollectionDto,
  MomentProjection,
  RECOLLECTION_FIELDS,
  formatMomentItem,
  momentCommentDto,
} from './moment-query'

export { momentCommentDto }

/** 站点时区下“去年今日”的半开区间（日历同样按站点时区分日）；去年没有这一天（2 月 29 日）时返回 null */
function anniversaryWindow(now: Date, zone: string): { from: Date; until: Date } | null {
  const today = zonedParts(now, zone)
  if (new Date(Date.UTC(today.year - 1, today.month - 1, today.day)).getUTCDate() !== today.day) return null
  return {
    from: zonedDayStart(today.year - 1, today.month, today.day, zone),
    until: zonedDayStart(today.year - 1, today.month, today.day + 1, zone),
  }
}

@Injectable()
export class MomentReadService {
  constructor(private readonly em: EntityManager) {}

  async list(query: QueryMomentsDto | QueryAdminMomentsDto, visitor = '', admin = false) {
    const where: FilterQuery<Moment> = {
      $and: [
        momentWhere(query, admin, query.date ? await readSiteTimeZone(this.em) : undefined),
        ...(admin && 'status' in query && query.status && query.status !== 'all' ? [{ status: query.status }] : []),
      ],
    }
    const pinnedFirst = query.pinnedFirst !== false
    const keyset = await this.keyset(query.after, pinnedFirst)
    const options = {
      populate: ['linkedArticle'] as const,
      fields: [...LINKED_ARTICLE_FIELDS],
      orderBy: {
        ...(pinnedFirst ? { isPinned: 'desc' as const } : {}),
        publishedAt: 'desc' as const,
        createdAt: 'desc' as const,
        id: 'desc' as const,
      },
      limit: query.pageSize,
    }
    // 游标读取时总数仍按整个筛选范围统计，页码只回显
    const [items, total] = keyset
      ? await Promise.all([this.em.find(Moment, { $and: [where, keyset] }, options), this.em.count(Moment, where)])
      : await this.em.findAndCount(Moment, where, { ...options, offset: (query.page - 1) * query.pageSize })
    const last = items.at(-1)
    return {
      items: await this.serialize(items, visitor, admin),
      total,
      page: query.page,
      pageSize: query.pageSize,
      nextCursor: last ? `${last.isPinned ? 1 : 0}.${last.id}` : null,
    }
  }

  /**
   * 键集条件：排在锚点之后的动态。置顶状态取游标里的快照（锚点之后被取消置顶也不错位），
   * 时间与编号从数据库按原精度比较（JS Date 只有毫秒，会漏掉同一毫秒内的动态）。
   * 锚点不存在时返回 null，调用方退回按页码读取。
   */
  private async keyset(after: string | undefined, pinnedFirst: boolean): Promise<FilterQuery<Moment> | null> {
    if (!after) return null
    const [flag, id] = after.split('.') as [string, string]
    const anchor = await this.em.count(Moment, { id, publishedAt: { $ne: null } })
    if (!anchor) return null
    const left = (alias: string) =>
      pinnedFirst
        ? `(${alias}.is_pinned, ${alias}.published_at, ${alias}.created_at, ${alias}.id)`
        : `(${alias}.published_at, ${alias}.created_at, ${alias}.id)`
    const right = pinnedFirst
      ? '(select ?::boolean, m.published_at, m.created_at, m.id from moment m where m.id = ?)'
      : '(select m.published_at, m.created_at, m.id from moment m where m.id = ?)'
    const params = pinnedFirst ? [flag === '1', id] : [id]
    return { [raw((alias) => `(${left(alias)} < ${right})`, params)]: true } as FilterQuery<Moment>
  }

  async require(id: string, admin = false) {
    const note = await this.em.findOne(
      Moment,
      { id, ...(admin ? { deletedAt: null } : publicMoments) },
      { populate: ['linkedArticle'], fields: [...LINKED_ARTICLE_FIELDS], refresh: true },
    )
    if (!note) throw new NotFoundException(msg('moment.notFoundOrPrivate'))
    return note
  }

  async detail(id: string, visitor = '', admin = false) {
    return (await this.serialize([await this.require(id, admin)], visitor, admin))[0]!
  }

  async submission(requestId: string) {
    const note = await this.em.findOne(Moment, { requestId, deletedAt: null })
    if (!note) throw new NotFoundException(msg('moment.submissionNotFound'))
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
        populate: ['moment', 'replyTo'],
        orderBy: { createdAt: 'desc', id: 'desc' },
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    )
    return {
      items: items.map((comment) => ({
        ...momentCommentDto(comment, true),
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
      populate: ['replyTo'],
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return {
      items: items.map((comment) => momentCommentDto(comment, admin)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async commentLocation(id: string, commentId: string) {
    await this.require(id, true)
    const target = await this.em.findOne(MomentComment, { id: commentId, moment: id, deletedAt: null })
    if (!target) throw new NotFoundException(msg('moment.commentTargetInvalid'))
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
    const zone = await readSiteTimeZone(this.em)
    const window = anniversaryWindow(new Date(), zone)
    // 各聚合互不依赖，并发执行；均为事务外只读查询，各自从连接池取连接。
    // 照片与回顾按不同字段部分加载，可能命中同一条动态；各用独立 fork 的身份映射，
    // 避免并发合并部分实体，也不污染请求级 EntityManager。
    const [[stats], topics, dates, photos, recent, anniversary, locations] = await Promise.all([
      connection.execute<{ totalMoments: number; totalLikes: number; totalComments: number }[]>(`
      select count(*)::int as "totalMoments", coalesce(sum(likes),0)::int as "totalLikes",
      (select count(*)::int from moment_comment c join moment m on m.id=c.moment_id
       where m.status='published' and m.deleted_at is null and c.status='published' and c.deleted_at is null) as "totalComments"
      from moment where status='published' and deleted_at is null`),
      connection.execute<{ name: string; count: number }[]>(`
      select topic as name,count(*)::int as count from moment cross join lateral jsonb_array_elements_text(topics) topic
      where status='published' and deleted_at is null group by topic order by count desc,topic asc`),
      // 日历可翻到任意历史月份并统计连续天数，因此保留全部有动态的日期（每天一行，体量随天数线性增长）。
      connection.execute<{ date: string; count: number }[]>(
        `select to_char(published_at at time zone ?,'YYYY-MM-DD') as date,count(*)::int as count
      from moment where status='published' and deleted_at is null group by date order by date desc`,
        [zone],
      ),
      this.em.fork().find(
        Moment,
        { ...publicMoments, [raw((alias) => `jsonb_array_length(${alias}.images)`)]: { $gt: 0 } },
        {
          fields: ['id', 'images'],
          orderBy: { likes: 'desc', publishedAt: 'desc', id: 'desc' },
          limit: 9,
        },
      ),
      // 回顾只展示正文摘录与日期，不需要引用文章。
      this.em.fork().find(Moment, publicMoments, {
        fields: [...RECOLLECTION_FIELDS],
        orderBy: { [raw('random()')]: 'asc' },
        limit: 12,
      }),
      window
        ? this.em
            .fork()
            .findOne(
              Moment,
              { ...publicMoments, publishedAt: { $gte: window.from, $lt: window.until } },
              { fields: [...RECOLLECTION_FIELDS], orderBy: { publishedAt: 'desc', id: 'desc' } },
            )
        : Promise.resolve(null),
      connection.execute<{ name: string; count: number }[]>(MOMENT_LOCATIONS_SQL),
    ])
    if (anniversary && !recent.some((item) => item.id === anniversary.id)) recent.push(anniversary)
    return {
      stats,
      topics,
      dates,
      locations,
      photos: photos.map((note) => ({ src: note.images[0], momentId: note.id })),
      recollections: recent.map(recollectionDto),
    }
  }

  async serialize(items: MomentProjection[], visitor: string, admin: boolean) {
    if (!items.length) return []
    const ids = items.map((item) => item.id)
    const marks = ids.map(() => '?').join(',')
    const connection = this.em.getConnection()
    const visibility = admin ? 'true' : "(c.status='published' or (c.status='pending' and c.visitor_id_hash=?))"
    const comments = await connection.execute<CommentRow[]>(
      `
      select * from (select c.*,r.author as reply_author,r.status as reply_status,r.deleted_at as reply_deleted_at,
      row_number() over(partition by c.moment_id order by c.created_at desc,c.id desc) as sequence
      from moment_comment c left join moment_comment r on r.id=c.reply_to_id
      where c.moment_id in (${marks}) and c.deleted_at is null and ${visibility}) ranked where sequence <= 3`,
      [...ids, ...(admin ? [] : [visitor || '__anonymous__'])],
    )
    const counts = await connection.execute<{ moment_id: string; count: number }[]>(
      `
      select moment_id,count(*)::int as count from moment_comment where moment_id in (${marks})
      and status='published' and deleted_at is null group by moment_id`,
      ids,
    )
    const reactions = await connection.execute<ReactionRow[]>(
      `select moment_id,emoji,count(*)::int as count,bool_or(visitor_id_hash=?) as reacted from moment_reaction
      where moment_id in (${marks}) group by moment_id,emoji`,
      [visitor || '__anonymous__', ...ids],
    )
    const likes = visitor ? await this.em.find(MomentLike, { moment: { $in: ids }, visitorIdHash: visitor }) : []
    const liked = new Set(likes.map((like) => like.moment.id))
    const mediaIds = managedMediaIds(items.map((item) => item.images))
    const media = mediaIds.length ? await this.em.find(MediaAsset, { id: { $in: mediaIds } }) : []
    const alts = new Map(media.map((asset) => [asset.id, asset.alt]))
    return items.map((note) => formatMomentItem(note, comments, counts, liked, alts, admin, reactions))
  }
}
