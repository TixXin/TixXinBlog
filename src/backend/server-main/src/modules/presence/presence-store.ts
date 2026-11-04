/**
 * @file presence-store.ts
 * @description 实时在线的进程内状态：心跳会话、浏览去重窗口与博主最后心跳。时钟由调用方传入，便于测试过期边界。
 *   单博主站点只运行一个 API 实例；进程重启后在线人数与去重窗口清空（最多多计一次浏览），可以接受。
 */

/** 会话最后一次心跳后仍计为在线的时长；前端心跳间隔 30 秒，留出两次丢失的余量 */
export const ONLINE_WINDOW_MS = 90_000
/** 博主最后一次心跳后仍显示“在线”的时长 */
export const OWNER_ONLINE_WINDOW_MS = 120_000
/** 同一访客、同一页面在此窗口内重复进入不再计浏览 */
export const VIEW_DEDUPE_MS = 30 * 60_000
/** 两张表的条目上限：超过后不再登记新条目，但照常返回已有数字，防止伪造会话耗尽内存 */
export const PRESENCE_CAPACITY = 100_000

/**
 * 按“最后活动时间”有序的过期表：每次触达都删除后重新插入，Map 的迭代顺序即从旧到新，
 * 清理时从头删除过期项，遇到第一个未过期项即可停止。
 */
class ExpiringSet {
  private readonly entries = new Map<string, number>()

  constructor(
    private readonly windowMs: number,
    private readonly capacity: number,
  ) {}

  get size(): number {
    return this.entries.size
  }

  prune(now: number): void {
    for (const [key, at] of this.entries) {
      if (now - at < this.windowMs) break
      this.entries.delete(key)
    }
  }

  /** 已存在且未过期时返回 false；否则登记并返回 true（容量已满且是新键时不登记，返回 false） */
  touch(key: string, now: number, refresh: boolean): boolean {
    this.prune(now)
    const previous = this.entries.get(key)
    if (previous !== undefined) {
      if (refresh) {
        this.entries.delete(key)
        this.entries.set(key, now)
      }
      return false
    }
    if (this.entries.size >= this.capacity) return false
    this.entries.set(key, now)
    return true
  }
}

export class PresenceStore {
  private readonly sessions: ExpiringSet
  private readonly views: ExpiringSet
  private ownerSeenAt: number | null = null

  constructor(capacity = PRESENCE_CAPACITY) {
    this.sessions = new ExpiringSet(ONLINE_WINDOW_MS, capacity)
    this.views = new ExpiringSet(VIEW_DEDUPE_MS, capacity)
  }

  /** 登记一次会话心跳，刷新其最后活动时间 */
  heartbeat(session: string, now: number): void {
    this.sessions.touch(session, now, true)
  }

  /** 当前在线会话数 */
  online(now: number): number {
    this.sessions.prune(now)
    return this.sessions.size
  }

  /** 同一访客同一页面在去重窗口内首次进入时返回 true；窗口不随重复进入顺延 */
  claimView(visitorHash: string, path: string, now: number): boolean {
    return this.views.touch(`${visitorHash}\n${path}`, now, false)
  }

  ownerHeartbeat(now: number): void {
    this.ownerSeenAt = now
  }

  ownerLastSeen(): number | null {
    return this.ownerSeenAt
  }

  ownerOnline(now: number): boolean {
    return this.ownerSeenAt !== null && now - this.ownerSeenAt < OWNER_ONLINE_WINDOW_MS
  }
}
