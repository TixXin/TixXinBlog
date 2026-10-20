/**
 * @file navigation.ts
 * @description 后台导航唯一配置：按分组顺序排列（键盘 Tab 顺序与数组一致），详情页保持所属模块识别；
 *              名称与分组为 admin-system 字典 key，由调用方翻译。tab 标记移动端底部标签栏的固定入口
 */
export type AdminNavigationGroup = 'workspace' | 'content' | 'interaction' | 'site' | 'system'

export interface AdminNavigationItem {
  path: string
  labelKey: string
  icon: string
  group: AdminNavigationGroup
  /** 移动端底部标签栏的短名称；有值即为固定入口 */
  tabKey?: string
}

export const adminNavigationGroups: AdminNavigationGroup[] = ['workspace', 'content', 'interaction', 'site', 'system']

export const adminNavigation: AdminNavigationItem[] = [
  {
    path: '/admin',
    labelKey: 'admin-system.nav.overview',
    icon: 'lucide:layout-dashboard',
    group: 'workspace',
    tabKey: 'admin-system.nav.tabs.overview',
  },
  {
    path: '/admin/notifications',
    labelKey: 'admin-system.nav.notifications',
    icon: 'lucide:bell',
    group: 'workspace',
    tabKey: 'admin-system.nav.tabs.notifications',
  },
  { path: '/admin/operations', labelKey: 'admin-system.nav.operations', icon: 'lucide:activity', group: 'workspace' },
  {
    path: '/admin/posts',
    labelKey: 'admin-system.nav.posts',
    icon: 'lucide:files',
    group: 'content',
    tabKey: 'admin-system.nav.tabs.posts',
  },
  { path: '/admin/flashes', labelKey: 'admin-system.nav.flashes', icon: 'lucide:lightbulb', group: 'content' },
  { path: '/admin/moments', labelKey: 'admin-system.nav.moments', icon: 'lucide:messages-square', group: 'content' },
  { path: '/admin/gallery', labelKey: 'admin-system.nav.gallery', icon: 'lucide:camera', group: 'content' },
  { path: '/prompts', labelKey: 'admin-system.nav.prompts', icon: 'lucide:aperture', group: 'content' },
  { path: '/admin/projects', labelKey: 'admin-system.nav.projects', icon: 'lucide:layers', group: 'content' },
  { path: '/admin/links', labelKey: 'admin-system.nav.links', icon: 'lucide:link', group: 'content' },
  {
    path: '/admin/subscriptions',
    labelKey: 'admin-system.nav.subscriptions',
    icon: 'lucide:credit-card',
    group: 'content',
  },
  {
    path: '/admin/comments',
    labelKey: 'admin-system.nav.comments',
    icon: 'lucide:message-square-text',
    group: 'interaction',
    tabKey: 'admin-system.nav.tabs.comments',
  },
  {
    path: '/admin/flash-comments',
    labelKey: 'admin-system.nav.flashComments',
    icon: 'lucide:message-square-dot',
    group: 'interaction',
  },
  {
    path: '/admin/moment-comments',
    labelKey: 'admin-system.nav.momentComments',
    icon: 'lucide:message-square',
    group: 'interaction',
  },
  {
    path: '/admin/guestbook',
    labelKey: 'admin-system.nav.guestbook',
    icon: 'lucide:message-circle',
    group: 'interaction',
  },
  { path: '/admin/media', labelKey: 'admin-system.nav.media', icon: 'lucide:images', group: 'site' },
  { path: '/admin/taxonomy', labelKey: 'admin-system.nav.taxonomy', icon: 'lucide:tags', group: 'site' },
  { path: '/admin/site', labelKey: 'admin-system.nav.site', icon: 'lucide:settings', group: 'site' },
  { path: '/admin/account', labelKey: 'admin-system.nav.account', icon: 'lucide:shield-check', group: 'system' },
  { path: '/admin/audit', labelKey: 'admin-system.nav.audit', icon: 'lucide:clipboard-list', group: 'system' },
  {
    path: '/admin/maintenance',
    labelKey: 'admin-system.nav.maintenance',
    icon: 'lucide:database-backup',
    group: 'system',
  },
]

/** 底部标签栏的固定入口，按数组顺序 */
export const adminTabNavigation = adminNavigation.filter((item) => item.tabKey)

export function adminModule(path: string) {
  return adminNavigation
    .slice()
    .reverse()
    .find((item) => path === item.path || path.startsWith(`${item.path}/`))
}
