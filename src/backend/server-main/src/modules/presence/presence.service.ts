/**
 * @file presence.service.ts
 * @description 实时在线与访问统计：心跳登记在线会话与博主活动，首次进入页面计浏览，返回在线人数、博主状态与统计。
 *   统计结果与开关短时缓存，博主最后在线时间节流写库；浏览与访客只存哈希和站点时区下的日期。
 */
import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { SitePresence } from '../../entities/site-presence.entity'
import { PresenceStore } from './presence-store'
import { SiteDayClock } from './presence-time'
import { countablePath, type PresenceHeartbeatDto, type SavePresenceSettingsDto } from './presence.dto'
import { deviceKey, normalizeReferrer } from './traffic-keys'
import { TrafficService } from './traffic.service'

/** 统计与开关缓存时长：心跳频繁，数字允许短暂滞后 */
const CACHE_MS = 10_000
/** 博主最后在线时间最多每 5 分钟写一次数据库 */
const OWNER_PERSIST_MS = 5 * 60_000

export interface PresenceStats {
  visitors: number
  todayViews: number
  totalViews: number
}

export interface PresenceResult {
  /** 当前在线人数；关闭公开统计时为 null */
  online: number | null
  /** 博主状态；关闭自动在线状态时为 null */
  owner: { status: 'online' | 'away'; lastSeenAt: string | null } | null
  /** 访问统计；关闭公开统计时为 null */
  stats: PresenceStats | null
  /** 与本次心跳同一页面的在线会话数（含自己）；关闭公开统计或路径不计数时为 null */
  readers: number | null
}

export interface PresenceSettings {
  autoPresence: boolean
  publicStats: boolean
  invisible: boolean
  ownerLastSeenAt: string | null
}

export interface HeartbeatContext {
  visitorHash: string
  isOwner: boolean
  automated: boolean
  /** 只用于归类设备与浏览器大类，不保存 */
  userAgent?: string
  now?: Date
}

@Injectable()
export class PresenceService {
  private readonly store = new PresenceStore()
  private settingsCache: { value: SitePresence; expires: number } | null = null
  private statsCache: { value: PresenceStats; expires: number } | null = null
  private ownerPersistedAt = 0

  private readonly clock: SiteDayClock

  constructor(
    private readonly em: EntityManager,
    private readonly traffic: TrafficService,
  ) {
    this.clock = new SiteDayClock(em)
  }

  async heartbeat(input: PresenceHeartbeatDto, context: HeartbeatContext): Promise<PresenceResult> {
    const now = context.now ?? new Date()
    const ms = now.getTime()
    const settings = await this.loadSettings(ms)
    const page = countablePath(input.path)
    if (!context.automated) this.store.heartbeat(input.session, page, ms)
    if (context.isOwner) await this.touchOwner(now)
    const path = input.view ? page : null
    if (path && !context.automated && context.visitorHash && this.store.claimView(context.visitorHash, path, ms)) {
      await this.recordView(context.visitorHash, now, {
        path,
        referrer: normalizeReferrer(input.referrer),
        userAgent: context.userAgent,
      })
      this.statsCache = null
      await this.traffic.prune(await this.clock.day(now))
    }
    return {
      online: settings.publicStats ? this.store.online(ms) : null,
      owner: settings.autoPresence ? this.ownerState(settings, ms) : null,
      stats: settings.publicStats ? await this.loadStats(now) : null,
      readers: settings.publicStats && page ? this.store.readers(page, ms) : null,
    }
  }

  /** 页面关闭时主动下线 */
  leave(session: string): void {
    this.store.leave(session)
  }

  /** 指定页面正在阅读的人数；关闭公开统计或路径不计数时为 null */
  async readers(path: string, now = new Date()): Promise<{ readers: number | null }> {
    const settings = await this.loadSettings(now.getTime())
    const page = countablePath(path)
    return { readers: settings.publicStats && page ? this.store.readers(page, now.getTime()) : null }
  }

  async settings(): Promise<PresenceSettings> {
    const row = await this.loadSettings(Date.now(), true)
    return {
      autoPresence: row.autoPresence,
      publicStats: row.publicStats,
      invisible: row.invisible,
      ownerLastSeenAt: this.lastSeen(row)?.toISOString() ?? null,
    }
  }

  async saveSettings(input: SavePresenceSettingsDto): Promise<PresenceSettings> {
    await this.em.fork().transactional(async (em) => {
      const row = await this.ensureRow(em)
      // 缺省的开关保持现值，便于以后只改其中一项。
      if (input.autoPresence !== undefined) row.autoPresence = input.autoPresence
      if (input.publicStats !== undefined) row.publicStats = input.publicStats
      if (input.invisible !== undefined) row.invisible = input.invisible
      row.updatedAt = new Date()
    })
    this.settingsCache = null
    return this.settings()
  }

  private ownerState(settings: SitePresence, now: number): PresenceResult['owner'] {
    // 隐身时对访客始终按离线处理，也不给出最后在线时间；后台读取的最后在线时间不受影响。
    if (settings.invisible) return { status: 'away', lastSeenAt: null }
    if (this.store.ownerOnline(now)) {
      return { status: 'online', lastSeenAt: new Date(this.store.ownerLastSeen()!).toISOString() }
    }
    return { status: 'away', lastSeenAt: this.lastSeen(settings)?.toISOString() ?? null }
  }

  /** 内存中的最后心跳与数据库记录取较新者：重启后内存为空，回退到数据库 */
  private lastSeen(row: SitePresence): Date | null {
    const memory = this.store.ownerLastSeen()
    const stored = row.ownerLastSeenAt?.getTime() ?? null
    const latest = Math.max(memory ?? -Infinity, stored ?? -Infinity)
    return Number.isFinite(latest) ? new Date(latest) : null
  }

  private async touchOwner(now: Date): Promise<void> {
    this.store.ownerHeartbeat(now.getTime())
    if (now.getTime() - this.ownerPersistedAt < OWNER_PERSIST_MS) return
    this.ownerPersistedAt = now.getTime()
    await this.em
      .fork()
      .getConnection()
      .execute(
        `insert into site_presence (id, auto_presence, public_stats, owner_last_seen_at, updated_at)
         values ('default', true, true, ?, ?)
         on conflict (id) do update set owner_last_seen_at = greatest(coalesce(site_presence.owner_last_seen_at, excluded.owner_last_seen_at), excluded.owner_last_seen_at)`,
        [now, now],
      )
    if (this.settingsCache) this.settingsCache.value.ownerLastSeenAt = now
  }

  /** 计一次浏览；访客当天首次出现时同时计入当日访客数与设备分布；页面与来源计入访问构成 */
  private async recordView(
    visitorHash: string,
    now: Date,
    page: { path: string; referrer: string | null; userAgent?: string },
  ): Promise<void> {
    const day = await this.clock.day(now)
    await this.em.fork().transactional(async (em) => {
      const connection = em.getConnection()
      const firstToday = await connection.execute<{ visitor_hash: string }[]>(
        `insert into site_visitor (visitor_hash, first_seen_at, last_seen_day) values (?, ?, ?)
         on conflict (visitor_hash) do update set last_seen_day = excluded.last_seen_day
         where site_visitor.last_seen_day < excluded.last_seen_day
         returning visitor_hash`,
        [visitorHash, now, day],
        'all',
        em.getTransactionContext(),
      )
      await connection.execute(
        `insert into site_daily_stats (id, day, views, visitors) values (?, ?, 1, ?)
         on conflict (day) do update set views = site_daily_stats.views + 1,
           visitors = site_daily_stats.visitors + excluded.visitors`,
        [randomUUID(), day, firstToday.length > 0 ? 1 : 0],
        'run',
        em.getTransactionContext(),
      )
      await this.traffic.record(em, day, {
        path: page.path,
        referrer: page.referrer,
        device: firstToday.length > 0 ? deviceKey(page.userAgent) : null,
      })
    })
  }

  private async loadStats(now: Date): Promise<PresenceStats> {
    if (this.statsCache && this.statsCache.expires > now.getTime()) return this.statsCache.value
    const [row] = await this.em
      .fork()
      .getConnection()
      .execute<{ visitors: number; today: number; total: number }[]>(
        `select (select count(*)::int from site_visitor) as visitors,
                coalesce((select views from site_daily_stats where day = ?), 0)::int as today,
                coalesce((select sum(views) from site_daily_stats), 0)::int as total`,
        [await this.clock.day(now)],
      )
    const value = { visitors: row?.visitors ?? 0, todayViews: row?.today ?? 0, totalViews: row?.total ?? 0 }
    this.statsCache = { value, expires: now.getTime() + CACHE_MS }
    return value
  }

  private async loadSettings(now: number, fresh = false): Promise<SitePresence> {
    if (!fresh && this.settingsCache && this.settingsCache.expires > now) return this.settingsCache.value
    const em = this.em.fork()
    const row = await this.ensureRow(em)
    await em.flush()
    this.settingsCache = { value: row, expires: now + CACHE_MS }
    return row
  }

  /** 迁移已写入默认行；被手工删除时按默认值重建，避免心跳失败 */
  private async ensureRow(em: EntityManager): Promise<SitePresence> {
    const existing = await em.findOne(SitePresence, { id: 'default' })
    if (existing) return existing
    return em.create(SitePresence, {
      id: 'default',
      autoPresence: true,
      publicStats: true,
      invisible: false,
      ownerLastSeenAt: null,
      updatedAt: new Date(),
    })
  }
}
