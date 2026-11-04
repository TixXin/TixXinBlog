/**
 * @file presence.service.ts
 * @description 实时在线与访问统计：心跳登记在线会话与博主活动，首次进入页面计浏览，返回在线人数、博主状态与统计。
 *   统计结果与开关短时缓存，博主最后在线时间节流写库；浏览与访客只存哈希和北京时间日期。
 */
import { Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { SitePresence } from '../../entities/site-presence.entity'
import { PresenceStore } from './presence-store'
import { beijingDay } from './presence-time'
import { countablePath, type PresenceHeartbeatDto, type SavePresenceSettingsDto } from './presence.dto'

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
}

export interface PresenceSettings {
  autoPresence: boolean
  publicStats: boolean
  ownerLastSeenAt: string | null
}

export interface HeartbeatContext {
  visitorHash: string
  isOwner: boolean
  automated: boolean
  now?: Date
}

@Injectable()
export class PresenceService {
  private readonly store = new PresenceStore()
  private settingsCache: { value: SitePresence; expires: number } | null = null
  private statsCache: { value: PresenceStats; expires: number } | null = null
  private ownerPersistedAt = 0

  constructor(private readonly em: EntityManager) {}

  async heartbeat(input: PresenceHeartbeatDto, context: HeartbeatContext): Promise<PresenceResult> {
    const now = context.now ?? new Date()
    const ms = now.getTime()
    const settings = await this.loadSettings(ms)
    if (!context.automated) this.store.heartbeat(input.session, ms)
    if (context.isOwner) await this.touchOwner(now)
    const path = input.view ? countablePath(input.path) : null
    if (path && !context.automated && context.visitorHash && this.store.claimView(context.visitorHash, path, ms)) {
      await this.recordView(context.visitorHash, now)
      this.statsCache = null
    }
    return {
      online: settings.publicStats ? this.store.online(ms) : null,
      owner: settings.autoPresence ? this.ownerState(settings, ms) : null,
      stats: settings.publicStats ? await this.loadStats(now) : null,
    }
  }

  async settings(): Promise<PresenceSettings> {
    const row = await this.loadSettings(Date.now(), true)
    return {
      autoPresence: row.autoPresence,
      publicStats: row.publicStats,
      ownerLastSeenAt: this.lastSeen(row)?.toISOString() ?? null,
    }
  }

  async saveSettings(input: SavePresenceSettingsDto): Promise<PresenceSettings> {
    await this.em.fork().transactional(async (em) => {
      const row = await this.ensureRow(em)
      // 缺省的开关保持现值，便于以后只改其中一项。
      if (input.autoPresence !== undefined) row.autoPresence = input.autoPresence
      if (input.publicStats !== undefined) row.publicStats = input.publicStats
      row.updatedAt = new Date()
    })
    this.settingsCache = null
    return this.settings()
  }

  private ownerState(settings: SitePresence, now: number): PresenceResult['owner'] {
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

  /** 计一次浏览；访客当天首次出现时同时计入当日访客数 */
  private async recordView(visitorHash: string, now: Date): Promise<void> {
    const day = beijingDay(now)
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
        `insert into site_daily_stats (day, views, visitors) values (?, 1, ?)
         on conflict (day) do update set views = site_daily_stats.views + 1,
           visitors = site_daily_stats.visitors + excluded.visitors`,
        [day, firstToday.length > 0 ? 1 : 0],
        'run',
        em.getTransactionContext(),
      )
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
        [beijingDay(now)],
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
      ownerLastSeenAt: null,
      updatedAt: new Date(),
    })
  }
}
