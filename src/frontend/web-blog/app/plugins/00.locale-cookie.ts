/**
 * @file 00.locale-cookie.ts
 * @description 首次确定界面语言时只认访客的 blog-locale cookie，否则用站点默认语言，忽略浏览器语言
 * @author TixXin
 * @since 2026-10-19
 */
import { LOCALE_COOKIE_KEY, isSupportedLocale } from '~~/i18n/localeOptions'

export default defineNuxtPlugin({
  name: 'locale-cookie',
  // 必须先于 i18n 模块的语言检测插件注册钩子，服务端与客户端首次定语言才会一致。
  enforce: 'pre',
  setup(nuxtApp) {
    // no_prefix 策略没有路由中间件，模块的 initialSetup 标记会一直为 true；
    // 这里只接管每个应用实例（服务端每个请求、客户端一次）的第一次定语言，之后的主动切换原样放行。
    let settled = false
    // 在插件同步阶段取 cookie：钩子经异步链调用，服务端届时已不在 Nuxt 上下文内。
    const cookie = useCookie<string | null>(LOCALE_COOKIE_KEY, { readonly: true })
    // 静态发布在构建时固定界面语言，访客残留的语言 cookie 不再生效，避免水合后切换语言。
    const staticSite = useRuntimeConfig().public.staticSite === true
    nuxtApp.hook('i18n:beforeLocaleSwitch', (data) => {
      if (settled || !data.initialSetup) return
      settled = true
      // 模块的初始检测会依次参考 Accept-Language 与 navigator.languages；这里统一改为
      // 「cookie 中的有效语言，否则站点默认语言」，保证 SSR 缓存与水合不随浏览器语言变化。
      data.newLocale = !staticSite && isSupportedLocale(cookie.value) ? cookie.value : nuxtApp.$i18n.defaultLocale
    })
  },
})
