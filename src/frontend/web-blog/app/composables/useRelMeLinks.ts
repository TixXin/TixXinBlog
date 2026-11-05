/**
 * @file useRelMeLinks.ts
 * @description 在首页与关于页的 <head> 声明博主的网页主页（rel="me"），供 Mastodon 等双向身份验证；
 *              只声明 http(s) 地址，单博主站点不在文章等其他页面重复声明
 */
import { isWebProfile } from '~/features/about/settings'

export function useRelMeLinks() {
  const { settings } = useSiteSettings()
  useHead({
    link: () =>
      (settings.value.socials ?? [])
        .filter((social) => isWebProfile(social.href))
        .map((social, index) => ({ key: `rel-me-${index}`, rel: 'me', href: social.href })),
  })
}
