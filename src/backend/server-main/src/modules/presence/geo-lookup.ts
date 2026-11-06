/**
 * @file geo-lookup.ts
 * @description 访客 IP 的离线地区查询（ip2region xdb，国家 ISO 代码、省份/州、城市）与 IP 打码。
 *   IP 只在请求内使用：汇总只记国家与省份，近期访问只存打码后的地址。数据文件不进仓库，镜像构建时按固定版本下载并校验，
 *   开发环境用 `corepack pnpm --filter server-main geo:fetch` 下载；目录缺少数据文件时查询一律返回“未知”，不影响计数。
 */
import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { join, resolve } from 'node:path'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface GeoLocation {
  /** ISO 3166-1 alpha-2 国家代码（大写）；查不到、内网或保留地址为空串 */
  country: string
  /** 省份或州，原文（国内为中文全称，海外多为英文）；查不到为空串 */
  region: string
  city: string
}

export const UNKNOWN_LOCATION: GeoLocation = Object.freeze({ country: '', region: '', city: '' })

interface Searcher {
  search(ip: string): Promise<string> | string
}

/** 默认数据目录：生产镜像内为 /app/geo（由 GEO_DATA_DIRECTORY 指定），开发为后端目录下的 .geo/ */
export const DEFAULT_GEO_DIRECTORY = '.geo'
export const GEO_FILES = { 4: 'ip2region_v4.xdb', 6: 'ip2region_v6.xdb' } as const

const clean = (value: string | undefined) => (value && value !== '0' ? value.trim().slice(0, 60) : '')

/**
 * 解析 ip2region 结果“国家|省份|城市|运营商|ISO 代码”。
 * 港澳台在数据中归入“中国|…|CN”，与国内展示口径一致；Reserved 等保留地址按未知处理。
 */
export function parseRegion(raw: string | undefined): GeoLocation {
  const parts = (raw ?? '').split('|')
  if (parts.length < 5) return UNKNOWN_LOCATION
  const code = (parts[4] ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return UNKNOWN_LOCATION
  return { country: code, region: clean(parts[1]), city: clean(parts[2]) }
}

/** 去掉 IPv4 映射前缀，返回规范的地址与版本；非法地址返回 null */
export function normalizeIp(value: string | undefined): { ip: string; version: 4 | 6 } | null {
  if (!value) return null
  const ip = value.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '')
  const version = isIP(ip)
  return version === 4 || version === 6 ? { ip, version } : null
}

/** 打码：IPv4 只留前三段（/24），IPv6 只留前三组（/48）；无法识别返回空串 */
export function maskIp(value: string | undefined): string {
  const parsed = normalizeIp(value)
  if (!parsed) return ''
  if (parsed.version === 4) return `${parsed.ip.split('.').slice(0, 3).join('.')}.*`
  const [head = '', tail = ''] = parsed.ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = parsed.ip.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left
  return `${groups
    .slice(0, 3)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::*`
}

@Injectable()
export class GeoLookup {
  private readonly logger = new Logger('GeoLookup')
  private readonly directory: string
  private searchers: Promise<Partial<Record<4 | 6, Searcher>>> | null = null

  constructor(@Optional() config?: ConfigService) {
    this.directory = resolve(config?.get<string>('GEO_DATA_DIRECTORY') || DEFAULT_GEO_DIRECTORY)
  }

  /** 测试用：直接给出查询器，跳过数据文件 */
  static withSearchers(searchers: Partial<Record<4 | 6, Searcher>>): GeoLookup {
    const lookup = new GeoLookup()
    lookup.searchers = Promise.resolve(searchers)
    return lookup
  }

  /** 查询失败或没有数据文件时返回未知，不抛错 */
  async locate(address: string | undefined): Promise<GeoLocation> {
    const parsed = normalizeIp(address)
    if (!parsed) return UNKNOWN_LOCATION
    const searcher = (await this.load())[parsed.version]
    if (!searcher) return UNKNOWN_LOCATION
    try {
      return parseRegion(await searcher.search(parsed.ip))
    } catch {
      return UNKNOWN_LOCATION
    }
  }

  private load(): Promise<Partial<Record<4 | 6, Searcher>>> {
    this.searchers ??= this.open()
    return this.searchers
  }

  /** 只加载向量索引（约 512KB），数据段按需读文件，不把整份库读进内存 */
  private async open(): Promise<Partial<Record<4 | 6, Searcher>>> {
    const result: Partial<Record<4 | 6, Searcher>> = {}
    try {
      const ip2region = await import('ip2region.js')
      for (const version of [4, 6] as const) {
        const file = join(this.directory, GEO_FILES[version])
        if (!existsSync(file)) continue
        const kind = version === 4 ? ip2region.IPv4 : ip2region.IPv6
        result[version] = ip2region.newWithVectorIndex(kind, file, ip2region.loadVectorIndexFromFile(file))
      }
    } catch (error) {
      this.logger.warn(`地区库加载失败，访问地区按未知记录：${(error as Error).message}`)
      return {}
    }
    if (!result[4] && !result[6]) this.logger.log(`未找到地区库（${this.directory}），访问地区按未知记录`)
    return result
  }
}
