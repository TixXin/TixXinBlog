/**
 * @file useSiteInfo.ts
 * @description 站点信息数据源 composable：页脚链接、每日一言、备案号与版权文案、在线状态均来自博主维护的站点资料
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
import {
  DEFAULT_ICP_URL,
  buildFooterLinks,
  defaultQuotes,
  formatCopyright,
  pickQuote,
  poweredByItems,
} from '~/features/site/footer'
import { currentTranslate, type Translate } from '~/utils/format'

/** 将 ISO 时间字符串转为相对时间描述 */
function formatDuration(since: string, t: Translate): string {
  if (!since) return ''
  const diff = Date.now() - new Date(since).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('layout.presence.justNow')
  if (minutes < 60) return t('layout.presence.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('layout.presence.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('layout.presence.daysAgo', { count: days })
}

/** 状态类型未配文案时的默认展示；取值时按当前界面语言翻译 */
export const presenceStatusLabels = {
  get online() {
    return currentTranslate()('layout.presence.online')
  },
  get idle() {
    return currentTranslate()('layout.presence.idle')
  },
  get busy() {
    return currentTranslate()('layout.presence.busy')
  },
} as const
/** 获取站点页脚信息 */
export function useSiteInfo() {
  const { settings, available } = useSiteSettings()
  // 可能在 setup 之外调用（快捷键、主题布局），用 Nuxt 应用上的 i18n 而非 useI18n
  const t = currentTranslate()
  const footerLinks = computed<FooterLink[]>(() => buildFooterLinks(settings.value.footerLinks))
  const poweredBy = computed<PoweredByItem[]>(() => poweredByItems)
  // 旧接口未返回一言时沿用缺省列表；博主清空列表时不展示一言
  const quotes = computed<string[]>(() => settings.value.quotes ?? defaultQuotes())
  /** 备案号与链接；未填写备案号时不展示 */
  const icp = computed(() => {
    const number = settings.value.icpNumber?.trim() ?? ''
    return number ? { number, href: settings.value.icpUrl?.trim() || DEFAULT_ICP_URL } : null
  })
  /** 版权文案，年份按当前年份渲染 */
  const copyrightText = computed(() =>
    formatCopyright(settings.value.copyright, new Date().getFullYear(), settings.value.name),
  )
  const siteStatus = computed<SiteStatus>(() => ({
    pingMs: null,
    statusText: available.value ? t('layout.footer.statusSynced') : t('layout.footer.statusUnavailable'),
  }))
  // 在线状态、签名与状态类型由博主在站点资料里维护；文案都为空时保持“离线”且不展示签名
  const ownerPresence = computed<OwnerPresenceInfo>(() => {
    const label = settings.value.presenceLabel?.trim() ?? ''
    const signature = settings.value.presenceSignature?.trim() ?? ''
    if (!label && !signature) return { status: 'offline', label: t('layout.presence.unset'), signature: '', since: '' }
    const status = settings.value.presenceStatus || 'online'
    return { status, label: label || presenceStatusLabels[status], signature, since: '' }
  })
  const ownerCard = computed<OwnerCardInfo>(() => ({
    name: settings.value.ownerName,
    title: settings.value.ownerTitle,
    socials: settings.value.socials,
    avatar: settings.value.avatar,
    avatarAlt: settings.value.avatarAlt,
    quotes: quotes.value,
  }))

  /** 状态持续时间的可读描述 */
  const presenceDuration = computed(() => formatDuration(ownerPresence.value.since, t))

  /** 每日一言（每次页面加载随机选一条，SSR 安全） */
  const dailyQuote = useState('daily-quote', () => pickQuote(quotes.value))

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
    copyrightText,
    icp,
    siteStatus,
    ownerPresence,
    presenceDuration,
    ownerCard,
    dailyQuote,
    announcements,
  }
}
