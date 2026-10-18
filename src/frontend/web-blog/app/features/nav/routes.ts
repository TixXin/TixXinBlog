/**
 * @file routes.ts
 * @description 内置导航模块清单与站点导航配置到前台导航项的转换；隐藏只影响展示，不做访问控制
 */
import type { NavItem, SiteNavEntry, SiteNavKey } from './types'

/** 内置模块的默认顺序，与服务端 SITE_NAV_KEYS 保持一致 */
export const SITE_NAV_KEYS: readonly SiteNavKey[] = [
  'home',
  'archive',
  'projects',
  'gallery',
  'flash',
  'links',
  'guestbook',
  'subscriptions',
  'about',
  'prompts',
  'tabs',
]

/** 内置模块的图标、名称与路由；名称与图标由代码维护，博主只调整显隐与顺序 */
export const navRouteCatalog: Record<SiteNavKey, NavItem> = {
  home: { icon: 'lucide:home', label: '主页', to: '/' },
  archive: { icon: 'lucide:archive', label: '归档', to: '/archive' },
  projects: { icon: 'lucide:layers', label: '项目', to: '/projects' },
  gallery: { icon: 'lucide:image', label: '画廊', to: '/gallery' },
  flash: { icon: 'lucide:zap', label: '闪念', to: '/flash' },
  links: { icon: 'lucide:link', label: '友链', to: '/links', desktopOnly: true },
  guestbook: { icon: 'lucide:message-circle', label: '留言', to: '/guestbook' },
  subscriptions: { icon: 'lucide:credit-card', label: '平台订阅费', to: '/subscriptions' },
  about: { icon: 'lucide:user', label: '关于', to: '/about' },
  prompts: { icon: 'lucide:aperture', label: '提示词', to: '/prompts' },
  tabs: { icon: 'lucide:layout-grid', label: '标签页', to: '/tabs' },
}

/** 外链导航项上限，与服务端一致 */
export const MAX_EXTERNAL_NAV = 4

/** 缺省导航：全部内置模块按默认顺序显示，等于此前写死的导航 */
export function defaultNavigation(): SiteNavEntry[] {
  return SITE_NAV_KEYS.map((key) => ({ type: 'route', key, visible: true }))
}

/**
 * 站点导航配置转前台导航项。旧接口未返回配置时使用缺省导航；
 * 未知模块忽略，缺失的内置模块按显示追加，首页始终显示。
 */
export function buildNavItems(entries: readonly SiteNavEntry[] | undefined | null): NavItem[] {
  const list: SiteNavEntry[] = Array.isArray(entries) ? [...(entries as SiteNavEntry[])] : defaultNavigation()
  for (const key of SITE_NAV_KEYS)
    if (!list.some((entry) => entry.type === 'route' && entry.key === key))
      list.push({ type: 'route', key, visible: true })
  return list.flatMap((entry): NavItem[] => {
    if (entry.type === 'route') {
      const route = navRouteCatalog[entry.key]
      if (!route || (!entry.visible && entry.key !== 'home')) return []
      return [{ ...route }]
    }
    if (!entry.visible || !/^https?:\/\//i.test(entry.url)) return []
    return [{ icon: 'lucide:external-link', label: entry.label, to: entry.url, external: true, newTab: entry.newTab }]
  })
}
