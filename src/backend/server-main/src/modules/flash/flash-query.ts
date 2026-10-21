/**
 * @file flash-query.ts
 * @description 闪念公开查询条件构造、排序与 DTO 结果定义
 */
import { BadRequestException } from '@nestjs/common'
import { FilterQuery, raw } from '@mikro-orm/core'
import { SITE_OWNER_ID } from '../../common/constants/site'
import { msg } from '../../common/i18n'
import type { FlashComment, FlashCommentStatus } from '../../entities/flash-comment.entity'
import type { FlashNote, FlashType } from '../../entities/flash-note.entity'
import type { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'

/** 域错误码(api.md 附录 A):3001 闪念不存在 */
export const FLASH_NOT_FOUND = 3001

export const DEFAULT_AVATAR = '/avatar.svg'
export const DAY_MS = 86_400_000
/** 时间胶囊摘录长度与随机候选数:前端卡片只展示 60 字,留出余量 */
export const RECOLLECTION_EXCERPT = 300
export const RECOLLECTION_LIMIT = 12
/** 公开闪念的原生 SQL 条件,参数为站点所有者编号 */
export const PUBLIC_SQL = 'user_id = ? and is_draft = false and is_archived = false'

/** 列表与搜索共用的排序:置顶前置,再按创建时间与编号倒序保证分页稳定 */
export const PUBLIC_ORDER = [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] as const

/** UTC 日起点 */
export function utcDay(value: string): Date {
  return new Date(value + 'T00:00:00.000Z')
}

export interface RecollectionRow {
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

/** 公开条件:仅站点所有者的已发布、未归档闪念,叠加标签(精确)、类型与 UTC 日期范围 */
export function buildFlashPublicWhere(query: QueryFlashDto): FilterQuery<FlashNote> {
  if (query.archived) throw new BadRequestException(msg('flash.archivedAdminOnly'))
  if (query.userId && query.userId !== SITE_OWNER_ID) throw new BadRequestException(msg('flash.ownerOnly'))
  const where: FilterQuery<FlashNote> = { userId: SITE_OWNER_ID, isDraft: false, isArchived: false }
  if (query.tag) where.tags = { $contains: [query.tag] }
  if (query.type) where.type = query.type
  // date 与 from/to 可同时出现,取交集;均按 UTC 日边界,与前端日历一致
  const starts = [query.date, query.from].filter((day): day is string => !!day).map((day) => utcDay(day).getTime())
  const ends = [query.date, query.to].filter((day): day is string => !!day).map((day) => utcDay(day).getTime() + DAY_MS)
  if (starts.length || ends.length) {
    where.createdAt = {
      ...(starts.length ? { $gte: new Date(Math.max(...starts)) } : {}),
      ...(ends.length ? { $lt: new Date(Math.min(...ends)) } : {}),
    }
  }
  return where
}

/** 关键词搜索条件构造:正文或任一标签包含关键词(不区分大小写),与 tag/type/日期筛选组合 */
export function buildFlashSearchWhere(query: SearchFlashDto): FilterQuery<FlashNote> {
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
  return { $and: [buildFlashPublicWhere(query), matched] }
}

export function formatFlashRecollection(row: RecollectionRow): FlashRecollection {
  return {
    id: row.id,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
  }
}
