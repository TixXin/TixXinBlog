/**
 * @file routes.ts
 * @description 内置导航模块清单与站点导航配置到前台导航项的转换；隐藏只影响展示，不做访问控制；
 *              内置名称在取值时按当前界面语言翻译
 */
import { currentTranslate } from '~/utils/format'
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

/** 内置模块名称的字典 key；名称跟随界面语言，由代码维护 */
export const navLabelKeys: Record<SiteNavKey, string> = {
  home: 'layout.nav.home',
  archive: 'layout.nav.archive',
  projects: 'layout.nav.projects',
  gallery: 'layout.nav.gallery',
  flash: 'layout.nav.flash',
  links: 'layout.nav.links',
  guestbook: 'layout.nav.guestbook',
  subscriptions: 'layout.nav.subscriptions',
  about: 'layout.nav.about',
  prompts: 'layout.nav.prompts',
  tabs: 'layout.nav.tabs',
}

/** 内置模块的图标与路由；label 为取值时按当前界面语言翻译的 getter，展开复制时得到当时的名称 */
function routeItem(key: SiteNavKey, item: Omit<NavItem, 'label'>): NavItem {
  return {
    ...item,
    get label() {
      return currentTranslate()(navLabelKeys[key])
    },
  }
}

/** 内置模块的图标、名称与路由；名称与图标由代码维护，博主只调整显隐与顺序 */
export const navRouteCatalog: Record<SiteNavKey, NavItem> = {
  home: routeItem('home', { icon: 'lucide:home', to: '/' }),
  archive: routeItem('archive', { icon: 'lucide:archive', to: '/archive' }),
  projects: routeItem('projects', { icon: 'lucide:layers', to: '/projects' }),
  gallery: routeItem('gallery', { icon: 'lucide:image', to: '/gallery' }),
  flash: routeItem('flash', { icon: 'lucide:zap', to: '/flash' }),
  links: routeItem('links', { icon: 'lucide:link', to: '/links', desktopOnly: true }),
  guestbook: routeItem('guestbook', { icon: 'lucide:message-circle', to: '/guestbook' }),
  subscriptions: routeItem('subscriptions', { icon: 'lucide:credit-card', to: '/subscriptions' }),
  about: routeItem('about', { icon: 'lucide:user', to: '/about' }),
  prompts: routeItem('prompts', { icon: 'lucide:aperture', to: '/prompts' }),
  tabs: routeItem('tabs', { icon: 'lucide:layout-grid', to: '/tabs' }),
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
