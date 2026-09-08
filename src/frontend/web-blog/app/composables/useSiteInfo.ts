/**
 * @file useSiteInfo.ts
 * @description 站点信息数据源 composable，组合真实站点资料与静态导航，不生成虚构运行或在线状态
 * @author TixXin
 * @since 2026-03-26
 */

import type {
  FooterLink,
  OwnerCardInfo,
  OwnerPresenceInfo,
  PoweredByItem,
  SiteAnnouncement,
  SiteStatus,
} from '~/features/site/types'
import { mockFooterLinks, mockOwnerCard, mockPoweredBy } from '~/features/site/mock'

/** 将 ISO 时间字符串转为相对时间描述 */
function formatDuration(since: string): string {
  if (!since) return ''
  const diff = Date.now() - new Date(since).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

/** 获取站点页脚信息 */
export function useSiteInfo() {
  const { settings, available } = useSiteSettings()
  const footerLinks = computed<FooterLink[]>(() => mockFooterLinks)
  const poweredBy = computed<PoweredByItem[]>(() => mockPoweredBy)
  const siteStatus = computed<SiteStatus>(() => ({
    pingMs: null,
    statusText: available.value ? '站点资料已同步' : '站点资料暂不可用',
  }))
  const ownerPresence = computed<OwnerPresenceInfo>(() => ({
    status: 'offline',
    label: '未提供在线状态',
    signature: '',
    since: '',
  }))
  const ownerCard = computed<OwnerCardInfo>(() => ({
    name: settings.value.ownerName,
    title: settings.value.ownerTitle,
    socials: settings.value.socials,
    avatar: settings.value.avatar,
    avatarAlt: settings.value.avatarAlt,
    quotes: mockOwnerCard.quotes,
  }))

  /** 状态持续时间的可读描述 */
  const presenceDuration = computed(() => formatDuration(ownerPresence.value.since))

  /** 每日一言（每次页面加载随机选一条，SSR 安全） */
  const dailyQuote = useState('daily-quote', () => {
    const quotes = mockOwnerCard.quotes
    return quotes[Math.floor(Math.random() * quotes.length)]
  })

  /** 站点公告（最多 3 条） */
  const announcements = computed<SiteAnnouncement[]>(() =>
    settings.value.announcement
      ? [
          {
            id: 'site',
            content: settings.value.announcement,
            date: settings.value.announcementUpdatedAt.slice(0, 10),
            pinned: true,
          },
        ]
      : [],
  )

  return {
    siteName: computed(() => settings.value.name),
    footerLinks,
    poweredBy,
    siteStatus,
    ownerPresence,
    presenceDuration,
    ownerCard,
    dailyQuote,
    announcements,
  }
}
