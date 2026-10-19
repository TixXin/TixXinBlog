/** @file overview.ts @description 工作台域入口、状态筛选与编辑地址；闪念使用已有行内编辑器；名称为字典 key。 */
import type { OverviewContent } from './types'
export const overviewDomains = [
  {
    domain: 'post',
    labelKey: 'admin-system.overview.domains.post',
    path: '/admin/posts',
    total: 'posts',
    drafts: 'drafts',
    icon: 'lucide:file-text',
  },
  {
    domain: 'flash',
    labelKey: 'admin-system.overview.domains.flash',
    path: '/admin/flashes',
    total: 'flashes',
    drafts: 'flashDrafts',
    icon: 'lucide:lightbulb',
  },
  {
    domain: 'moment',
    labelKey: 'admin-system.overview.domains.moment',
    path: '/admin/moments',
    total: 'moments',
    drafts: 'momentDrafts',
    icon: 'lucide:messages-square',
  },
  {
    domain: 'gallery',
    labelKey: 'admin-system.overview.domains.gallery',
    path: '/admin/gallery',
    total: 'gallery',
    drafts: 'galleryDrafts',
    icon: 'lucide:images',
  },
  {
    domain: 'project',
    labelKey: 'admin-system.overview.domains.project',
    path: '/admin/projects',
    total: 'projects',
    drafts: 'projectDrafts',
    icon: 'lucide:folder-code',
  },
  {
    domain: 'link',
    labelKey: 'admin-system.overview.domains.link',
    path: '/admin/links',
    total: 'links',
    drafts: 'linkDrafts',
    icon: 'lucide:link',
  },
] as const
export const overviewTasks = [
  {
    key: 'pendingComments',
    labelKey: 'admin-system.overview.tasks.pendingComments',
    to: '/admin/comments?status=pending',
  },
  {
    key: 'pendingMomentComments',
    labelKey: 'admin-system.overview.tasks.pendingMomentComments',
    to: '/admin/moment-comments?status=pending',
  },
  {
    key: 'pendingFlashComments',
    labelKey: 'admin-system.overview.tasks.pendingFlashComments',
    to: '/admin/flash-comments?status=pending',
  },
  {
    key: 'pendingGuestbook',
    labelKey: 'admin-system.overview.tasks.pendingGuestbook',
    to: '/admin/guestbook?status=pending',
  },
  { key: 'unanswered', labelKey: 'admin-system.overview.tasks.unanswered', to: '/admin/comments?unanswered=true' },
  {
    key: 'unansweredGuestbook',
    labelKey: 'admin-system.overview.tasks.unansweredGuestbook',
    to: '/admin/guestbook?unanswered=true',
  },
] as const
export function overviewEditorPath(item: Pick<OverviewContent, 'domain' | 'id'>) {
  const domain = overviewDomains.find((value) => value.domain === item.domain)!
  return item.domain === 'flash'
    ? `${domain.path}?edit=${encodeURIComponent(item.id)}`
    : `${domain.path}/${encodeURIComponent(item.id)}`
}
