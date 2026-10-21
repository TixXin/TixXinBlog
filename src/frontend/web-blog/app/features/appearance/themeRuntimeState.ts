/**
 * @file themeRuntimeState.ts
 * @description 布局主题运行时的纯逻辑：名称校验、来源解析、持久化读写与水合后对账，可脱离 Nuxt/DOM 单测
 * @author TixXin
 * @since 2026-10-22
 */

/** 主题 cookie：唯一事实源，持久化一年，SSR 靠它决定首屏布局 */
export const LAYOUT_THEME_COOKIE_KEY = 'blog-layout-theme'
/** localStorage 备份键沿用引擎旧键，保证已有访客的偏好不丢失 */
export const LAYOUT_THEME_STORAGE_KEY = 'theme-engine:storage'
export const LAYOUT_THEME_STATE_KEY = 'layout-theme:current'
export const LAYOUT_THEME_SOURCE_KEY = 'layout-theme:source'
export const LAYOUT_THEME_BOOTSTRAP_KEY = 'layout-theme:bootstrapped'
export const LAYOUT_THEME_RECONCILE_KEY = 'layout-theme:reconciled'
export const LAYOUT_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** 主题来源：query 只做首屏预览，不写任何持久化 */
export type LayoutThemeSource = 'query' | 'cookie' | 'storage' | 'user' | 'default'

export interface LayoutThemeResolution {
  theme: string
  source: LayoutThemeSource
}

export interface ThemeStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** 与 Nuxt useCookie 兼容的持久化选项；不允许服务端写 cookie，避免进入 SSR 缓存响应 */
export function layoutThemeCookieOptions() {
  return { path: '/', maxAge: LAYOUT_THEME_COOKIE_MAX_AGE, sameSite: 'lax' as const }
}

export function isLayoutThemeId(value: unknown, knownIds: readonly string[]): value is string {
  return typeof value === 'string' && knownIds.includes(value)
}

export function isLayoutThemeSource(value: unknown): value is LayoutThemeSource {
  return value === 'query' || value === 'cookie' || value === 'storage' || value === 'user' || value === 'default'
}

/** 引擎初始化优先级：query → cookie → localStorage → 默认主题 */
export function resolveLayoutTheme(
  sources: { queryTheme?: unknown; cookieTheme?: unknown; storedTheme?: unknown },
  knownIds: readonly string[],
  defaultTheme: string,
): LayoutThemeResolution {
  if (isLayoutThemeId(sources.queryTheme, knownIds)) return { theme: sources.queryTheme, source: 'query' }
  if (isLayoutThemeId(sources.cookieTheme, knownIds)) return { theme: sources.cookieTheme, source: 'cookie' }
  if (isLayoutThemeId(sources.storedTheme, knownIds)) return { theme: sources.storedTheme, source: 'storage' }
  return { theme: defaultTheme, source: 'default' }
}

/** query 主题是预览，不参与持久化；用户手动切换后转为可持久化来源 */
export function isPreviewLayoutThemeSource(source: LayoutThemeSource): boolean {
  return source === 'query'
}

/**
 * 水合后的对账计划：
 * - query 预览：不动持久化，避免分享链接永久改写访客主题；
 * - cookie 权威：把 localStorage 备份同步为 cookie 值；
 * - 无 cookie（会话过期/被清）：恢复 localStorage 里仍有效的偏好（会发生一次水合后主题切换，但不再 mismatch）。
 */
export function planThemeReconcile(
  current: LayoutThemeResolution,
  persisted: { cookieTheme?: unknown; storedTheme?: unknown },
  knownIds: readonly string[],
): { switchTo?: string; syncStorageTo?: string } {
  if (current.source === 'query') return {}
  const stored = isLayoutThemeId(persisted.storedTheme, knownIds) ? persisted.storedTheme : null
  if (current.source === 'default') {
    if (stored && stored !== current.theme) return { switchTo: stored }
    return {}
  }
  if (current.source === 'cookie' || current.source === 'user' || current.source === 'storage') {
    return stored === current.theme ? {} : { syncStorageTo: current.theme }
  }
  return {}
}

export function readStoredLayoutTheme(
  storage: ThemeStorageLike | null | undefined,
  knownIds: readonly string[],
): string | null {
  if (!storage) return null
  try {
    const value = storage.getItem(LAYOUT_THEME_STORAGE_KEY)
    return isLayoutThemeId(value, knownIds) ? value : null
  } catch {
    return null
  }
}

/** 存储不可用（隐私模式/配额）时返回 false，主题仍在本会话生效 */
export function writeStoredLayoutTheme(storage: ThemeStorageLike | null | undefined, theme: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(LAYOUT_THEME_STORAGE_KEY, theme)
    return true
  } catch {
    return false
  }
}

/** 仅接受字符串形式的 query 主题，数组/对象/数字一律忽略 */
export function parseQueryLayoutTheme(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
