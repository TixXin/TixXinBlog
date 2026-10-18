/**
 * @file types.ts
 * @description 导航模块类型定义：前台导航项与站点设置中的导航配置
 * @author TixXin
 * @since 2025-03-17
 */

export interface NavItem {
  icon: string
  label: string
  to: string
  /** 是否仅在桌面端侧边栏显示（不出现在移动端底部导航） */
  desktopOnly?: boolean
  /** 站外链接（博主在站点设置中添加的外链导航项） */
  external?: boolean
  /** 是否在新窗口打开 */
  newTab?: boolean
}

/** 内置路由模块；导航只控制展示与顺序，路由本身始终可访问 */
export type SiteNavKey =
  | 'home'
  | 'archive'
  | 'projects'
  | 'gallery'
  | 'flash'
  | 'links'
  | 'guestbook'
  | 'subscriptions'
  | 'about'
  | 'prompts'
  | 'tabs'

/** 站点设置中的内置模块导航项 */
export interface SiteNavRouteEntry {
  type: 'route'
  key: SiteNavKey
  visible: boolean
}

/** 站点设置中的外链导航项，地址仅限 http(s) */
export interface SiteNavExternalEntry {
  type: 'external'
  label: string
  url: string
  newTab: boolean
  visible: boolean
}

export type SiteNavEntry = SiteNavRouteEntry | SiteNavExternalEntry
