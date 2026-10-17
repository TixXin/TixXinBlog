/**
 * @file usePageSeo.ts
 * @description 页面级分享元信息：标题、描述、canonical、绝对分享图与 JSON-LD 的统一出口。
 * 站点级兜底（og:title、og:url、默认分享图、twitter:card 等）由 app.vue 输出，页面只覆盖自己掌握的字段；
 * 页面未提供或无法转为绝对地址的值不输出，交回全局兜底，绝不输出空的 og:image。
 * @author TixXin
 * @since 2026-10-18
 */
import type { MaybeRefOrGetter } from 'vue'
import { absoluteUrl, isShareableImage, serializeJsonLd } from '~/utils/absoluteUrl'

type SeoValue = MaybeRefOrGetter<string | null | undefined>

export interface PageSeoOptions {
  /** 文档标题（不含站点名，站点名由 titleTemplate 追加） */
  title?: SeoValue
  description?: SeoValue
  /** 分享卡片标题，缺省与文档标题一致 */
  shareTitle?: SeoValue
  /** 分享图，可为站内相对地址 */
  image?: SeoValue
  imageAlt?: SeoValue
  type?: MaybeRefOrGetter<'website' | 'article' | 'profile' | undefined>
  /** canonical 路径或绝对地址；缺省沿用 app.vue 的「站点地址 + 当前路径」 */
  canonical?: SeoValue
  /** 只在需要偏离模块默认指令（noindex 等）时提供 */
  robots?: SeoValue
}

/** 公开站点地址（无结尾斜杠），由部署环境注入 */
export function useSiteUrl(): string {
  return String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
}

/** 站点默认分享图：仅博主头像为位图时可用；SVG 或缺失时返回 undefined，不输出 og:image */
export function useDefaultShareImage() {
  const { settings } = useSiteSettings()
  const site = useSiteUrl()
  return computed(() => {
    const url = absoluteUrl(settings.value.avatar, site)
    return isShareableImage(url) ? { url, alt: settings.value.avatarAlt || settings.value.name } : undefined
  })
}

/** 空串视为未提供，交回全局兜底 */
function filled(value: string | null | undefined) {
  return value ? value : undefined
}

export function usePageSeo(options: PageSeoOptions) {
  const site = useSiteUrl()
  const image = computed(() => {
    const url = absoluteUrl(toValue(options.image), site)
    return isShareableImage(url) ? url : undefined
  })
  const canonical = computed(() => absoluteUrl(toValue(options.canonical), site))
  const shareTitle = () => filled(toValue(options.shareTitle)) ?? filled(toValue(options.title))
  const meta: Parameters<typeof useSeoMeta>[0] = {}
  if (options.title !== undefined) meta.title = () => filled(toValue(options.title))
  if (options.title !== undefined || options.shareTitle !== undefined) meta.ogTitle = shareTitle
  if (options.description !== undefined) {
    meta.description = () => filled(toValue(options.description))
    meta.ogDescription = () => filled(toValue(options.description))
  }
  if (options.type !== undefined) meta.ogType = () => toValue(options.type)
  if (options.image !== undefined) {
    meta.ogImage = () => image.value
    // 分享图存在时才覆盖替代文本与大图卡片，否则沿用全局默认分享图的小卡片
    meta.ogImageAlt = () => (image.value ? filled(toValue(options.imageAlt)) : undefined)
    meta.twitterCard = () => (image.value ? 'summary_large_image' : undefined)
  }
  if (options.canonical !== undefined) meta.ogUrl = () => canonical.value
  if (options.robots !== undefined) meta.robots = () => filled(toValue(options.robots))
  useSeoMeta(meta)
  if (options.canonical !== undefined)
    useHead(() => ({
      link: canonical.value ? [{ key: 'canonical', rel: 'canonical', href: canonical.value }] : [],
    }))
  return { site, image, canonical }
}

/** 输出一段 JSON-LD；值为空时不输出脚本标签 */
export function useJsonLd(key: string, value: () => object | null | undefined) {
  useHead(() => {
    const data = value()
    return {
      script: data ? [{ key: `ld-${key}`, type: 'application/ld+json', innerHTML: serializeJsonLd(data) }] : [],
    }
  })
}
