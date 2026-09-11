/** @file overview.ts @description 工作台域入口、状态筛选与编辑地址；闪念使用已有行内编辑器。 */
import type { OverviewContent } from './types'
export const overviewDomains = [
  { domain: 'post', label: '文章', path: '/admin/posts', total: 'posts', drafts: 'drafts', icon: 'lucide:file-text' },
  {
    domain: 'flash',
    label: '闪念',
    path: '/admin/flashes',
    total: 'flashes',
    drafts: 'flashDrafts',
    icon: 'lucide:lightbulb',
  },
  {
    domain: 'moment',
    label: '朋友圈',
    path: '/admin/moments',
    total: 'moments',
    drafts: 'momentDrafts',
    icon: 'lucide:messages-square',
  },
  {
    domain: 'gallery',
    label: '图库',
    path: '/admin/gallery',
    total: 'gallery',
    drafts: 'galleryDrafts',
    icon: 'lucide:images',
  },
  {
    domain: 'project',
    label: '项目',
    path: '/admin/projects',
    total: 'projects',
    drafts: 'projectDrafts',
    icon: 'lucide:folder-code',
  },
  { domain: 'link', label: '友链', path: '/admin/links', total: 'links', drafts: 'linkDrafts', icon: 'lucide:link' },
] as const
export const overviewTasks = [
  { key: 'pendingComments', label: '文章评论待审核', to: '/admin/comments?status=pending' },
  { key: 'pendingMomentComments', label: '朋友圈评论待审核', to: '/admin/moment-comments?status=pending' },
  { key: 'pendingGuestbook', label: '留言待审核', to: '/admin/guestbook?status=pending' },
  { key: 'unanswered', label: '文章评论待回复', to: '/admin/comments?unanswered=true' },
  { key: 'unansweredGuestbook', label: '留言待回复', to: '/admin/guestbook?unanswered=true' },
] as const
export function overviewEditorPath(item: Pick<OverviewContent, 'domain' | 'id'>) {
  const domain = overviewDomains.find((value) => value.domain === item.domain)!
  return item.domain === 'flash'
    ? `${domain.path}?edit=${encodeURIComponent(item.id)}`
    : `${domain.path}/${encodeURIComponent(item.id)}`
}
