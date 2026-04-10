/**
 * @file useSiteInfo.ts
 * @description 站点信息数据源 composable，封装页脚链接、技术栈和状态获取逻辑（当前返回 mock，后续替换为 API）
 * @author TixXin
 * @since 2026-03-26
 */

import type { FooterLink, OwnerCardInfo, OwnerPresenceInfo, PoweredByItem, SiteAnnouncement, SiteStatus } from '~/features/site/types'
import { mockAnnouncements, mockFooterLinks, mockOwnerCard, mockOwnerPresence, mockPoweredBy, mockSiteStatus } from '~/features/site/mock'

/** 将 ISO 时间字符串转为相对时间描述 */
function formatDuration(since: string): string {
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
  const footerLinks = computed<FooterLink[]>(() => mockFooterLinks)
  const poweredBy = computed<PoweredByItem[]>(() => mockPoweredBy)
  const siteStatus = computed<SiteStatus>(() => mockSiteStatus)
  const ownerPresence = computed<OwnerPresenceInfo>(() => mockOwnerPresence)
  const ownerCard = computed<OwnerCardInfo>(() => mockOwnerCard)

  /** 状态持续时间的可读描述 */
  const presenceDuration = computed(() => formatDuration(ownerPresence.value.since))

  /** 每日一言（每次页面加载随机选一条，SSR 安全） */
  const dailyQuote = useState('daily-quote', () => {
    const quotes = mockOwnerCard.quotes
    return quotes[Math.floor(Math.random() * quotes.length)]
  })

  /** 站点公告（最多 3 条） */
  const announcements = computed<SiteAnnouncement[]>(() => mockAnnouncements.slice(0, 3))

  return {
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
