/**
 * @file idlePrefetch.ts
 * @description 触屏设备空闲预取的判定：链接预取只在悬停/聚焦时触发，触屏没有悬停，点击底部导航时目标页代码要临时加载；
 *   因此只在触屏、非省流量、非 2G 网络下，于首屏空闲后预取底部导航的少数主入口（不含当前页与已隐藏栏目）
 * @author TixXin
 * @since 2026-11-05
 */

export interface IdlePrefetchEnvironment {
  /** 主输入设备不支持悬停（`(hover: none)`），即典型触屏设备 */
  hoverNone: boolean
  /** 浏览器开启了省流量模式（Network Information API 的 saveData） */
  saveData?: boolean
  /** 网络类型估计，如 '4g'、'3g'、'2g'、'slow-2g' */
  effectiveType?: string
}

const SLOW_NETWORKS = new Set(['slow-2g', '2g'])

/** 是否在空闲时预取主入口 */
export function shouldIdlePrefetch(env: IdlePrefetchEnvironment): boolean {
  return env.hoverNone && !env.saveData && !SLOW_NETWORKS.has(env.effectiveType ?? '')
}

/** 规范化路径：去掉末尾斜杠，根路径保留为 / */
function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

/**
 * 需要预取的路径：主入口中站点导航仍可见（未被博主隐藏）的站内路由，排除当前页，按主入口顺序去重。
 * navPaths 取自站点导航（外链、隐藏栏目已被过滤）。
 */
export function idlePrefetchTargets(
  primaryPaths: readonly string[],
  navPaths: readonly string[],
  currentPath: string,
): string[] {
  const visible = new Set(navPaths.map(normalizePath))
  const current = normalizePath(currentPath)
  return [...new Set(primaryPaths.map(normalizePath))].filter((path) => path !== current && visible.has(path))
}
