/**
 * @file mock.ts
 * @description 站点模块 mock 数据，提供页脚链接、技术栈信息和系统状态
 * @author TixXin
 * @since 2025-03-17
 */

import type { FooterLink, OwnerCardInfo, OwnerPresenceInfo, PoweredByItem, SiteAnnouncement, SiteStatus } from './types'

export const mockFooterLinks: FooterLink[] = [
  { label: '关于本站', href: '/about' },
  { label: 'RSS 订阅', href: '/rss.xml' },
  { label: '站点地图', href: '/sitemap.xml' },
]

export const mockPoweredBy: PoweredByItem[] = [
  { label: 'Nuxt', href: 'https://nuxt.com' },
  { label: 'Vue', href: 'https://vuejs.org' },
]

export const mockSiteStatus: SiteStatus = {
  pingMs: 18,
  statusText: 'All Systems Operational',
}

export const mockOwnerCard: OwnerCardInfo = {
  name: 'TixXin',
  title: '前端开发工程师，热爱开源与技术分享',
  socials: [
    { icon: 'lucide:github', label: 'GitHub', href: 'https://github.com/TixXin' },
    { icon: 'lucide:twitter', label: 'Twitter', href: 'https://twitter.com/TixXin' },
    { icon: 'lucide:mail', label: 'Email', href: 'mailto:hi@tix.xin' },
  ],
  quotes: [
    '路漫漫其修远兮，吾将上下而求索。',
    '保持热爱，奔赴山海。',
    '种一棵树最好的时间是十年前，其次是现在。',
    '心之所向，素履以往。',
    '不积跬步，无以至千里。',
  ],
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
