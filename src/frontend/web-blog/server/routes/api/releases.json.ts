/**
 * @file releases.json.ts
 * @description 后台版本信息：当前运行版本与 GitHub 上的版本列表。由前端服务查询并缓存，浏览器只访问本站，
 *   不必在安全头里放行 GitHub；成功缓存 6 小时、失败 30 分钟内不重试，任意访客都无法借此频繁请求 GitHub。
 *   内容都是公开信息（当前版本本就随 X-TixXin-Release 响应头下发）。仓库可用 NUXT_RELEASE_REPOSITORY 覆盖（fork 使用）
 * @author TixXin
 * @since 2026-11-06
 */
import { summarizeReleases, type GithubRelease, type ReleaseSummary } from '../../utils/releaseVersions'

const SUCCESS_TTL = 6 * 60 * 60 * 1000
const FAILURE_TTL = 30 * 60 * 1000
/** 手动「重新检查」的最短间隔，防止借刷新接口频繁请求 GitHub */
const MANUAL_MIN_INTERVAL = 5 * 60 * 1000
const DEFAULT_REPOSITORY = 'TixXin/TixXinBlog'

let cached: {
  releases: GithubRelease[]
  checkedAt: string | null
  error: boolean
  expiresAt: number
  attemptedAt: number
} | null = null
let pending: Promise<void> | null = null

function repository(): string {
  const value = (process.env.NUXT_RELEASE_REPOSITORY || '').trim()
  return /^[\w.-]+\/[\w.-]+$/.test(value) ? value : DEFAULT_REPOSITORY
}

async function refresh(): Promise<void> {
  try {
    const releases = await $fetch<GithubRelease[]>(`https://api.github.com/repos/${repository()}/releases`, {
      query: { per_page: 40 },
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'TixXinBlog-release-check' },
      timeout: 10_000,
      retry: 0,
    })
    const now = Date.now()
    cached = {
      releases,
      checkedAt: new Date(now).toISOString(),
      error: false,
      expiresAt: now + SUCCESS_TTL,
      attemptedAt: now,
    }
  } catch {
    // 失败时保留上次成功的列表，只标记本次检查失败
    cached = {
      releases: cached?.releases ?? [],
      checkedAt: cached?.checkedAt ?? null,
      error: true,
      expiresAt: Date.now() + FAILURE_TTL,
      attemptedAt: Date.now(),
    }
  }
}

export default defineEventHandler(async (event): Promise<ReleaseSummary> => {
  assertMethod(event, ['GET', 'HEAD'])
  const current = String(useRuntimeConfig(event).releaseVersion || '').trim() || null
  setResponseHeader(event, 'cache-control', 'private, max-age=300')
  // 本机开发与浏览器回归没有注入发布版本，不查询 GitHub：无从比较新旧，也让测试不依赖外网与线上 Release 数量
  if (!current) return summarizeReleases([], null)
  const manual = getQuery(event).refresh === '1' && !!cached && Date.now() - cached.attemptedAt >= MANUAL_MIN_INTERVAL
  if (!cached || cached.expiresAt <= Date.now() || manual) {
    pending ??= refresh().finally(() => (pending = null))
    await pending
  }
  return summarizeReleases(cached!.releases, current, {
    checkedAt: cached!.checkedAt,
    error: cached!.error,
    repository: repository(),
  })
})
