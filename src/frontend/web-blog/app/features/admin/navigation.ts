/** @file navigation.ts @description 后台导航唯一配置，详情页保持所属模块识别；名称为 admin-system 字典 key，由调用方翻译 */
export const adminNavigation = [
  { path: '/admin', labelKey: 'admin-system.nav.overview', icon: 'lucide:layout-dashboard' },
  { path: '/admin/notifications', labelKey: 'admin-system.nav.notifications', icon: 'lucide:bell' },
  { path: '/admin/operations', labelKey: 'admin-system.nav.operations', icon: 'lucide:activity' },
  { path: '/admin/posts', labelKey: 'admin-system.nav.posts', icon: 'lucide:files' },
  { path: '/admin/comments', labelKey: 'admin-system.nav.comments', icon: 'lucide:messages-square' },
  { path: '/admin/flashes', labelKey: 'admin-system.nav.flashes', icon: 'lucide:lightbulb' },
  { path: '/admin/flash-comments', labelKey: 'admin-system.nav.flashComments', icon: 'lucide:message-square-dot' },
  { path: '/admin/moments', labelKey: 'admin-system.nav.moments', icon: 'lucide:messages-square' },
  { path: '/admin/moment-comments', labelKey: 'admin-system.nav.momentComments', icon: 'lucide:message-square' },
  { path: '/admin/guestbook', labelKey: 'admin-system.nav.guestbook', icon: 'lucide:message-circle' },
  { path: '/admin/gallery', labelKey: 'admin-system.nav.gallery', icon: 'lucide:camera' },
  { path: '/prompts', labelKey: 'admin-system.nav.prompts', icon: 'lucide:aperture' },
  { path: '/admin/projects', labelKey: 'admin-system.nav.projects', icon: 'lucide:layers' },
  { path: '/admin/links', labelKey: 'admin-system.nav.links', icon: 'lucide:link' },
  { path: '/admin/subscriptions', labelKey: 'admin-system.nav.subscriptions', icon: 'lucide:credit-card' },
  { path: '/admin/media', labelKey: 'admin-system.nav.media', icon: 'lucide:images' },
  { path: '/admin/taxonomy', labelKey: 'admin-system.nav.taxonomy', icon: 'lucide:tags' },
  { path: '/admin/site', labelKey: 'admin-system.nav.site', icon: 'lucide:settings' },
  { path: '/admin/account', labelKey: 'admin-system.nav.account', icon: 'lucide:shield-check' },
  { path: '/admin/audit', labelKey: 'admin-system.nav.audit', icon: 'lucide:clipboard-list' },
  { path: '/admin/maintenance', labelKey: 'admin-system.nav.maintenance', icon: 'lucide:database-backup' },
]
export function adminModule(path: string) {
  return adminNavigation
    .slice()
    .reverse()
    .find((item) => path === item.path || path.startsWith(`${item.path}/`))
}
