/**
 * @file flash.service.ts
 * @description 闪念业务:列表与搜索(置顶前置,可按标签/类型/UTC 日期组合筛选)、公开概览聚合、详情、点赞切换、访客评论;
 *   评论按评论策略决定先审后发,公开读取只返回已发布评论与当前访客本人的待审评论
 * @author TixXin
 * @since 2026-07-20
 */

import { FilterQuery, LockMode, raw } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BusinessException } from '../../common/exceptions/business.exception'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { FlashLike } from '../../entities/flash-like.entity'
import { FlashNote, FlashType } from '../../entities/flash-note.entity'
import { CreateFlashCommentDto } from './dto/create-flash-comment.dto'
import { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'
import { MediaAsset } from '../../entities/media-asset.entity'
import { lockMedia, managedMediaIds, synchronizeMediaReferences } from '../media/media-references'
import { publicAuthorId } from '../../common/utils/public-author-id'
import { momentUrl } from '../moment/moment-values'
import { recordOwnerEvent } from '../operations/owner-events'

/** 域错误码(api.md 附录 A):3001 闪念不存在 */
const FLASH_NOT_FOUND = 3001

/** 单博主场景默认归属(requirements.md:无多租户) */
import { SITE_OWNER_ID } from '../../common/constants/site'

const DEFAULT_AVATAR = '/avatar.svg'
const DAY_MS = 86_400_000
/** 时间胶囊摘录长度与随机候选数:前端卡片只展示 60 字,留出余量 */
const RECOLLECTION_EXCERPT = 300
const RECOLLECTION_LIMIT = 12
/** 公开闪念的原生 SQL 条件,参数为站点所有者编号 */
const PUBLIC_SQL = 'user_id = ? and is_draft = false and is_archived = false'

/** 列表与搜索共用的排序:置顶前置,再按创建时间与编号倒序保证分页稳定 */
const PUBLIC_ORDER = [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] as const

/** UTC 日起点 */
function utcDay(value: string): Date {
  return new Date(value + 'T00:00:00.000Z')
}

interface RecollectionRow {
  id: string
  content: string
  created_at: Date | string
}

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
  /** 已发布评论数;不含待审与隐藏评论,也不含访客本人可见的待审评论 */
  commentCount: number
  comments: FlashCommentDto[]
  isPinned: boolean
  isArchived: boolean
  isDraft: boolean
}

/** 闪念评论响应;moderationStatus 与朋友圈评论同名同取值 */
export interface FlashCommentDto {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  content: string
  createdAt: string
  moderationStatus: FlashCommentStatus
}

/** 公开读取的评论可见性:已发布评论,以及当前访客本人提交的待审评论(仅其本机可见) */
export function visibleToVisitor(comment: Pick<FlashComment, 'status' | 'authorId'>, visitor: string): boolean {
  return comment.status === 'published' || (comment.status === 'pending' && !!visitor && comment.authorId === visitor)
}

/** 时间胶囊条目:只带摘录与时间,不返回完整正文与互动 */
export interface FlashRecollection {
  id: string
  content: string
  createdAt: string
}

/** 公开概览:侧栏日历、统计、标签云与时间胶囊共用一次聚合读取 */
export interface FlashOverview {
  /** 公开闪念总数 */
  total: number
  /** 当前 UTC 自然月新增数 */
  monthCount: number
  /** 有闪念的 UTC 日期与条数,日期倒序;日历可翻任意历史月份并计算连续天数 */
  dates: Array<{ date: string; count: number }>
  /** 标签出现次数,次数倒序、同次数按名称 */
  tags: Array<{ name: string; count: number }>
  /** 往年今日(UTC 月日相同、年份更早)最近的一条 */
  onThisDay: FlashRecollection | null
  /** 随机回顾候选,最多 RECOLLECTION_LIMIT 条 */
  recollections: FlashRecollection[]
  /** 当前访客已点赞的公开闪念编号;未携带访客头时为空 */
  likedIds: string[]
}

export interface FlashListResult {
  items: FlashNoteDto[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class FlashService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  /** 公开响应不返回原始访客哈希，避免与留言成员等其他模块的访客标识关联。 */
  private authorId(visitorIdHash: string): string {
    return publicAuthorId(this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), 'flash-comment', visitorIdHash)
  }

  /** 公开条件:仅站点所有者的已发布、未归档闪念,叠加标签(精确)、类型与 UTC 日期范围 */
  private publicWhere(query: QueryFlashDto): FilterQuery<FlashNote> {
    if (query.archived) throw new BadRequestException('归档内容请使用管理员接口读取')
    if (query.userId && query.userId !== SITE_OWNER_ID) throw new BadRequestException('此接口只提供本站公开闪念')
    const where: FilterQuery<FlashNote> = { userId: SITE_OWNER_ID, isDraft: false, isArchived: false }
    if (query.tag) where.tags = { $contains: [query.tag] }
    if (query.type) where.type = query.type
    // date 与 from/to 可同时出现,取交集;均按 UTC 日边界,与前端日历一致
    const starts = [query.date, query.from].filter((day): day is string => !!day).map((day) => utcDay(day).getTime())
    const ends = [query.date, query.to]
      .filter((day): day is string => !!day)
      .map((day) => utcDay(day).getTime() + DAY_MS)
    if (starts.length || ends.length) {
      where.createdAt = {
        ...(starts.length ? { $gte: new Date(Math.max(...starts)) } : {}),
        ...(ends.length ? { $lt: new Date(Math.min(...ends)) } : {}),
      }
    }
    return where
  }

  private async page(where: FilterQuery<FlashNote>, query: QueryFlashDto, visitor: string): Promise<FlashListResult> {
    const [notes, total] = await this.em.findAndCount(FlashNote, where, {
      populate: ['comments'],
      orderBy: [...PUBLIC_ORDER],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return { items: await this.serialize(notes, visitor), total, page: query.page, pageSize: query.pageSize }
  }

  /** 列表:草稿不对外;置顶前置 + createdAt 倒序(对齐前端 LocalFlashRepository.list) */
  async findMany(query: QueryFlashDto, visitor = ''): Promise<FlashListResult> {
    return this.page(this.publicWhere(query), query, visitor)
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

  /**
   * 关键词搜索:正文或任一标签包含关键词(不区分大小写),与 tag/type/日期筛选组合;
   * 排序与列表一致(置顶前置),相同创建时间按编号稳定分页。
   */
  async search(query: SearchFlashDto, visitor = ''): Promise<FlashListResult> {
    const kw = '%' + query.q.replace(/[\\%_]/g, (char) => '\\' + char) + '%'
    const matched: FilterQuery<FlashNote> = {
      $or: [
        { content: { $ilike: kw } },
        {
          [raw(
            (alias) => `exists(select 1 from jsonb_array_elements_text(${alias}.tags) as tag where tag ilike ?)`,
            [kw],
          )]: true,
        },
      ],
    }
    return this.page({ $and: [this.publicWhere(query), matched] }, query, visitor)
  }

  /**
   * 公开概览:总数、本月数、日期计数、标签计数、时间胶囊与访客已赞编号。
   * 全部为数据库聚合或限量查询,不加载闪念实体;只读,不写库。
   */
  async overview(visitor = '', now = new Date()): Promise<FlashOverview> {
    const connection = this.em.getConnection()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    const monthDay = now.toISOString().slice(5, 10)
    const owner = SITE_OWNER_ID
    const excerpt = `id, left(content, ${RECOLLECTION_EXCERPT}) as content, created_at`
    // 各聚合互不依赖,并发执行;均为事务外只读查询
    const [[stats], dates, tags, [onThisDay], recollections, likes] = await Promise.all([
      connection.execute<{ total: number; monthCount: number }[]>(
        `select count(*)::int as total,
        (count(*) filter (where created_at >= ? and created_at < ?))::int as "monthCount"
        from flash_note where ${PUBLIC_SQL}`,
        [monthStart, nextMonth, owner],
      ),
      connection.execute<{ date: string; count: number }[]>(
        `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*)::int as count
        from flash_note where ${PUBLIC_SQL} group by date order by date desc`,
        [owner],
      ),
      connection.execute<{ name: string; count: number }[]>(
        `select tag as name, count(*)::int as count
        from flash_note cross join lateral jsonb_array_elements_text(tags) as tag
        where ${PUBLIC_SQL} group by tag order by count desc, tag asc`,
        [owner],
      ),
      connection.execute<RecollectionRow[]>(
        `select ${excerpt} from flash_note where ${PUBLIC_SQL}
        and to_char(created_at at time zone 'UTC', 'MM-DD') = ? and created_at < ?
        order by created_at desc, id desc limit 1`,
        [owner, monthDay, yearStart],
      ),
      connection.execute<RecollectionRow[]>(
        `select ${excerpt} from flash_note where ${PUBLIC_SQL} order by random() limit ${RECOLLECTION_LIMIT}`,
        [owner],
      ),
      visitor
        ? connection.execute<{ id: string }[]>(
            `select l.flash_note_id as id from flash_like l join flash_note n on n.id = l.flash_note_id
            where l.visitor_id_hash = ? and n.user_id = ? and n.is_draft = false and n.is_archived = false
            order by l.flash_note_id`,
            [visitor, owner],
          )
        : Promise.resolve([]),
    ])
    const recollection = (row: RecollectionRow): FlashRecollection => ({
      id: row.id,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
    })
    return {
      total: stats?.total ?? 0,
      monthCount: stats?.monthCount ?? 0,
      dates,
      tags,
      onThisDay: onThisDay ? recollection(onThisDay) : null,
      recollections: recollections.map(recollection),
      likedIds: likes.map((like) => like.id),
    }
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

  async addComment(id: string, dto: CreateFlashCommentDto, visitorIdHash: string): Promise<FlashCommentDto> {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const note = await em.findOne(
        FlashNote,
        { id, userId: SITE_OWNER_ID, isDraft: false, isArchived: false },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!note) throw new BusinessException(FLASH_NOT_FOUND, '闪念不存在', HttpStatus.NOT_FOUND)
      // 与文章、朋友圈评论共用站点评论策略;每次读取最新值,避免博主刚开启先审后发时仍直接公开。
      const policy = await em.findOne(CommentPolicy, { id: 'default' }, { refresh: true })
      const comment = em.create(FlashComment, {
        flashNote: note,
        authorId: visitorIdHash,
        authorName: dto.authorName,
        // 与朋友圈、留言共用头像白名单：默认头像、本站媒体或完整 HTTP(S) 地址。
        authorAvatar: dto.authorAvatar === undefined ? DEFAULT_AVATAR : momentUrl(dto.authorAvatar, true, true),
        content: dto.content,
        status: policy?.requireApproval ? 'pending' : 'published',
        createdAt: new Date(),
      })
      await em.flush()
      await synchronizeMediaReferences(em, `flash-comment:${comment.id}`, 'flash-comment', [comment.authorAvatar], {
        flashNote: note,
        flashComment: comment,
      })
      await em.flush()
      await recordOwnerEvent(
        em,
        'flash-comment',
        comment.id,
        comment.status === 'pending' ? 'pending_review' : 'new_comment',
      )
      return this.commentDto(comment)
    })
  }

  commentDto(comment: FlashComment): FlashCommentDto {
    return {
      id: comment.id,
      authorId: this.authorId(comment.authorId),
      authorName: comment.authorName,
      authorAvatar: comment.authorAvatar,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      moderationStatus: comment.status,
    }
  }

  /** admin 为 true 时返回全部状态的评论供后台审核;公开读取按 visibleToVisitor 过滤 */
  async serialize(notes: FlashNote[], visitor: string, admin = false): Promise<FlashNoteDto[]> {
    const ids = managedMediaIds(notes.map((note) => note.images))
    const assets = ids.length ? await this.em.find(MediaAsset, { id: { $in: ids } }) : []
    const descriptions = new Map(assets.map((asset) => [asset.id, asset.alt]))
    const likes =
      visitor && notes.length
        ? await this.em.find(FlashLike, { visitorIdHash: visitor, flashNote: { $in: notes.map((note) => note.id) } })
        : []
    const liked = new Set(likes.map((like) => like.flashNote.id))
    return notes.map((note) => this.toDto(note, liked.has(note.id), descriptions, visitor, admin))
  }

  private toDto(
    note: FlashNote,
    liked: boolean,
    descriptions: Map<string, string>,
    visitor: string,
    admin: boolean,
  ): FlashNoteDto {
    const comments = note.comments.getItems()
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
      commentCount: comments.filter((c) => c.status === 'published').length,
      comments: comments
        .filter((c) => admin || visibleToVisitor(c, visitor))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((c) => this.commentDto(c)),
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      isDraft: note.isDraft,
    }
  }
}
