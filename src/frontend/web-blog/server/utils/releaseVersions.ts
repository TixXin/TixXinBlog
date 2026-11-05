/**
 * @file releaseVersions.ts
 * @description 后台版本信息的纯逻辑：语义化版本比较（含 -beta.N 预发布）、按当前通道筛选 GitHub Release、
 *   标出当前与更新的版本、识别更新说明里的数据库迁移；不发起网络请求，便于单测
 * @author TixXin
 * @since 2026-11-06
 */

/** GitHub Releases 接口中用到的字段 */
export interface GithubRelease {
  tag_name: string
  name?: string | null
  body?: string | null
  draft?: boolean
  prerelease?: boolean
  published_at?: string | null
  html_url?: string
}

export interface ReleaseItem {
  version: string
  prerelease: boolean
  publishedAt: string | null
  url: string
  notes: string
  /** 更新说明里写明含数据库迁移 */
  migration: boolean
  current: boolean
  newer: boolean
}

export interface ReleaseSummary {
  /** 当前运行版本；本机开发与未注入版本时为 null */
  current: string | null
  channel: 'stable' | 'beta'
  items: ReleaseItem[]
  /** 当前通道内最新且比当前新的版本 */
  latest: string | null
  checkedAt: string | null
  /** 最近一次检查失败（保留上次成功的列表） */
  error: boolean
}

/** 列表最多展示的版本数 */
export const RELEASE_LIMIT = 20
/** 单个版本说明保留的最大字符数，避免异常长的正文撑大响应 */
const NOTES_LIMIT = 20_000
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** 解析版本号；不合法时返回 null */
export function parseVersion(value: string) {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) return null
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4]?.split('.') ?? [] }
}

/** 比较单个预发布标识：数字按数值，数字低于字母，字母按字典序 */
function compareIdentifier(x: string, y: string): number {
  const nx = /^\d+$/.test(x) ? Number(x) : null
  const ny = /^\d+$/.test(y) ? Number(y) : null
  if (nx !== null && ny !== null) return nx - ny
  if (nx !== null || ny !== null) return nx !== null ? -1 : 1
  return x === y ? 0 : x < y ? -1 : 1
}

/** 比较预发布部分；没有预发布标记的正式版高于同号的预发布 */
function comparePrerelease(left: string[], right: string[]): number {
  if (!left.length || !right.length) return right.length - left.length
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i]
    const y = right[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    const result = compareIdentifier(x, y)
    if (result) return result
  }
  return 0
}

/** 比较两个版本：a > b 返回正数；不合法的版本视为最小 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return left ? 1 : right ? -1 : 0
  for (let i = 0; i < 3; i++) if (left.core[i] !== right.core[i]) return left.core[i]! - right.core[i]!
  return comparePrerelease(left.pre, right.pre)
}

/** 更新说明是否写明含数据库迁移：CHANGELOG 写作「含一项/三项数据库迁移」，「不含数据库迁移」没有量词不匹配 */
export function mentionsMigration(notes: string): boolean {
  return /含[^，。；\n]{0,8}项数据库迁移/.test(notes)
}

/** 更新说明里的仓库相对链接（如 docs/deployment.md）指向该版本在 GitHub 上的文件，避免在后台被当成站内路径 */
export function absolutizeLinks(notes: string, repository: string, tag: string): string {
  return notes.replace(
    /\]\((?![a-z][a-z0-9+.-]*:|#|\/)([^)\s]+)\)/gi,
    (_, path: string) => `](https://github.com/${repository}/blob/${tag}/${path.replace(/^\.\//, '')})`,
  )
}

/**
 * 按当前版本的通道整理 Release：正式版站点只看正式版，测试版站点同时看测试版与正式版；
 * 当前版本即使不在通道内也保留，便于在列表中定位
 */
export function summarizeReleases(
  releases: GithubRelease[],
  current: string | null,
  options: { checkedAt?: string | null; error?: boolean; repository?: string } = {},
): ReleaseSummary {
  const { checkedAt = null, error = false, repository = 'TixXin/TixXinBlog' } = options
  const channel = current && parseVersion(current)?.pre.length ? 'beta' : 'stable'
  const items = releases
    .filter((release) => !release.draft && parseVersion(release.tag_name))
    .map((release) => {
      const version = release.tag_name.replace(/^v/, '')
      const notes = absolutizeLinks((release.body ?? '').slice(0, NOTES_LIMIT), repository, release.tag_name)
      return {
        version,
        prerelease: Boolean(release.prerelease) || Boolean(parseVersion(version)?.pre.length),
        publishedAt: release.published_at ?? null,
        url: release.html_url ?? '',
        notes,
        migration: mentionsMigration(notes),
        current: current !== null && compareVersions(version, current) === 0,
        newer: current !== null && compareVersions(version, current) > 0,
      }
    })
    .filter((item) => item.current || channel === 'beta' || !item.prerelease)
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, RELEASE_LIMIT)
  return { current, channel, items, latest: items.find((item) => item.newer)?.version ?? null, checkedAt, error }
}
