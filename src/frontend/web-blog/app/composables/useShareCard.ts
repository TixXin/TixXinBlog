/**
 * @file useShareCard.ts
 * @description 当前站点的分享卡片地址：主题取构建时的默认布局主题（服务器镜像为 nexus，静态发布为 --theme），
 * 语言取当前页面语言；站点名、简介、博主名与头像参与版本号。演示数据模式下内容不在后端，内容卡返回 undefined。
 * @author TixXin
 * @since 2026-11-03
 */
import { shareCardUrl, type ShareCardKind } from '~/utils/shareCard'

export function useShareCard() {
  const config = useRuntimeConfig()
  const { settings } = useSiteSettings()
  const { locale } = useNuxtApp().$i18n
  const site = useSiteUrl()
  const theme = String(config.public.layoutDefaultTheme || 'nexus')
  const siteVersion = () => [
    settings.value.name,
    settings.value.description,
    settings.value.ownerName,
    settings.value.avatar,
  ]
  const mock = (kind: ShareCardKind) =>
    kind === 'post' ? config.public.postUseMockRepo !== false : config.public.useMockRepo !== false

  /** 站点卡：首页、列表页与全站兜底 */
  function siteCard() {
    return shareCardUrl({ site, theme, locale: locale.value, version: siteVersion() })!
  }

  /** 内容卡；version 传入卡片上显示的内容（标题或正文、日期） */
  function contentCard(kind: ShareCardKind, id: string | number | undefined, version: readonly unknown[]) {
    if (mock(kind) || id === undefined) return undefined
    return shareCardUrl({ site, theme, locale: locale.value, kind, id, version: [...version, ...siteVersion()] })
  }

  return { siteCard, contentCard }
}
