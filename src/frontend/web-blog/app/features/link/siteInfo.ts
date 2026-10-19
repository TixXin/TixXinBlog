/** @file siteInfo.ts @description 本站友链资料仅来自可用站点设置和部署地址，不复制默认回退数据；字段名按 t 的语言生成 */
import type { SiteSettingsData } from '~/features/site/settings'
import type { SiteInfo } from './types'
import { currentTranslate, type Translate } from '~/utils/format'
export function linkSiteInfo(
  settings: SiteSettingsData,
  available: boolean,
  siteUrl: string,
  t: Translate = currentTranslate(),
): SiteInfo[] | null {
  if (!available) return null
  try {
    const site = new URL(siteUrl)
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) return null
    const info = [
      { label: t('interaction.siteInfo.fieldName'), value: settings.name },
      { label: t('interaction.siteInfo.fieldUrl'), value: site.href },
      { label: t('interaction.siteInfo.fieldDescription'), value: settings.description },
    ]
    if (settings.avatar) {
      const avatar = new URL(settings.avatar, site)
      if (!['http:', 'https:'].includes(avatar.protocol) || avatar.username || avatar.password) return null
      info.push({ label: t('interaction.siteInfo.fieldAvatar'), value: avatar.href })
    }
    return info
  } catch {
    return null
  }
}
export function siteInfoText(info: SiteInfo[], t: Translate = currentTranslate()) {
  return info.map(({ label, value }) => t('interaction.siteInfo.line', { label, value })).join('\n')
}
