/**
 * @file types.ts
 * @description 留言板模块类型定义
 * @author TixXin
 * @since 2026-03-20
 */

/** 消息反应（emoji reaction） */
export interface MessageReaction {
  emoji: string
  count: number
  reacted: boolean
}

/** 回复引用信息 */
export interface ReplyRef {
  id: number
  author: string
  content: string
}

/** 消息发送状态 */
export type MessageStatus = 'sending' | 'sent' | 'read' | 'local'

export interface GuestMessage {
  id: number
  author: string
  avatar: string
  content: string
  time: string
  isOwner: boolean
  browser?: string
  region?: string
  /** 回复引用 */
  replyTo?: ReplyRef
  /** emoji 反应 */
  reactions?: MessageReaction[]
  /** 消息状态 */
  status?: MessageStatus
  createdAt?: string
  moderationStatus?: 'published' | 'pending' | 'hidden'
  isPinned?: boolean
  replyUnavailable?: boolean
}

/** 服务端留言记录，显示时间与分组由页面层生成。 */
export interface GuestbookRecord {
  id: number
  author: string
  avatar: string
  content: string
  createdAt: string
  isOwner: boolean
  isPinned: boolean
  moderationStatus: 'published' | 'pending' | 'hidden'
  replyTo: ReplyRef | null
  replyUnavailable: boolean
  reactions: MessageReaction[]
}
export interface ManagedGuestbookRecord extends GuestbookRecord {
  revision: number
  updatedAt: string
}
export interface GuestbookPage {
  items: GuestbookRecord[]
  total: number
  nextCursor: string | null
}
export interface GuestbookMetadata {
  stats: { messages: number; members: number; recent: number; today: number }
  pinned: GuestbookRecord | null
  members: (ActiveMember & { id: string; isOwner: boolean })[]
  rules: ChatRule[]
}
export interface GuestbookSubmission {
  requestId: string
  content: string
  replyToId?: number | null
  author?: string
  avatar?: string
}
export interface GuestbookQuery {
  q?: string
  date?: string
  before?: string
  pageSize?: number
}

/** 置顶公告消息 */
export interface PinnedMessage {
  id: number
  content: string
  author: string
  time: string
}

export interface DateGroup {
  date: string
  messages: GuestMessage[]
}

export interface ChatStat {
  label: string
  value: string
}

export interface ChatRule {
  id: number
  text: string
}

export interface ActiveMember {
  name: string
  avatar: string
  messageCount: number
  isOnline?: boolean
}

/** 访客身份信息 */
export interface VisitorIdentity {
  nickname: string
  avatarColor: string
}
