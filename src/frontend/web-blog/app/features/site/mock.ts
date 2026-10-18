/**
 * @file mock.ts
 * @description 站点模块演示数据（系统状态、公告与在线状态样例），不进入生产路径；
 * 页脚链接、每日一言与导航已由站点设置提供，缺省值见 footer.ts 与 nav/routes.ts
 * @author TixXin
 * @since 2025-03-17
 */

import type { OwnerPresenceInfo, SiteAnnouncement, SiteStatus } from './types'

export const mockSiteStatus: SiteStatus = {
  pingMs: 18,
  statusText: 'All Systems Operational',
}

export const mockAnnouncements: SiteAnnouncement[] = [
  { id: '1', content: '博客已迁移至新服务器，访问速度大幅提升！', date: '2026-04-08', pinned: true },
  { id: '2', content: '新增朋友圈功能，欢迎体验。', date: '2026-04-01' },
  { id: '3', content: '暗色模式全面优化，阅读体验更佳。', date: '2026-03-25' },
]

export const mockOwnerPresence: OwnerPresenceInfo = {
  status: 'idle',
  label: '摆烂中',
  signature: '今天不想写代码',
  since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
}
