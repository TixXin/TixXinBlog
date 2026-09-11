/** @file navigation.ts @description 后台导航唯一配置，详情页保持所属模块识别 */
export const adminNavigation = [
  { path: '/admin', label: '管理概览', icon: 'lucide:layout-dashboard' },
  { path: '/admin/posts', label: '文章管理', icon: 'lucide:files' },
  { path: '/admin/comments', label: '评论管理', icon: 'lucide:messages-square' },
  { path: '/admin/flashes', label: '闪念管理', icon: 'lucide:lightbulb' },
  { path: '/admin/moments', label: '朋友圈管理', icon: 'lucide:messages-square' },
  { path: '/admin/moment-comments', label: '朋友圈评论', icon: 'lucide:message-square' },
  { path: '/admin/guestbook', label: '留言管理', icon: 'lucide:message-circle' },
  { path: '/admin/gallery', label: '图库管理', icon: 'lucide:camera' },
  { path: '/admin/projects', label: '项目管理', icon: 'lucide:layers' },
  { path: '/admin/links', label: '友链管理', icon: 'lucide:link' },
  { path: '/admin/media', label: '媒体资源', icon: 'lucide:images' },
  { path: '/admin/taxonomy', label: '分类与标签', icon: 'lucide:tags' },
  { path: '/admin/site', label: '站点设置', icon: 'lucide:settings' },
  { path: '/admin/account', label: '账号安全', icon: 'lucide:shield-check' },
  { path: '/admin/audit', label: '操作审计', icon: 'lucide:clipboard-list' },
  { path: '/admin/maintenance', label: '备份与维护', icon: 'lucide:database-backup' },
]
export function adminModule(path: string) {
  return adminNavigation
    .slice()
    .reverse()
    .find((item) => path === item.path || path.startsWith(`${item.path}/`))
}
