/** @file siteInfo.ts @description 本站友链资料仅来自可用站点设置和部署地址，不复制默认回退数据 */
import type { SiteSettingsData } from '~/features/site/settings'
import type { SiteInfo } from './types'
export function linkSiteInfo(settings: SiteSettingsData, available: boolean, siteUrl: string): SiteInfo[] | null {
  if (!available) return null
  try {
    const site = new URL(siteUrl)
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) return null
    const info = [
      { label: '名称', value: settings.name },
      { label: '地址', value: site.href },
      { label: '描述', value: settings.description },
    ]
    if (settings.avatar) {
      const avatar = new URL(settings.avatar, site)
      if (!['http:', 'https:'].includes(avatar.protocol) || avatar.username || avatar.password) return null
      info.push({ label: '头像', value: avatar.href })
    }
    return info
  } catch {
    return null
  }
}
export function siteInfoText(info: SiteInfo[]) {
  return info.map(({ label, value }) => `${label}：${value}`).join('\n')
}
