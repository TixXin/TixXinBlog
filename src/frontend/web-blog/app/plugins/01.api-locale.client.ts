/**
 * @file 01.api-locale.client.ts
 * @description 浏览器内所有经 $fetch 发往同源 /api/v1 的请求（含 useAdminApi 与各仓库）附带当前界面语言，
 *              未经 $fetch 的请求由网关回退到 blog-locale cookie 或站点默认语言
 * @author TixXin
 * @since 2026-10-19
 */
import { isSameOriginApiRequest, withApiLocale } from '~/utils/apiLocale'

export default defineNuxtPlugin({
  name: 'api-locale',
  setup(nuxtApp) {
    const base = globalThis.$fetch
    // 在请求发出时读取语言：切换界面语言后无需重新创建实例。
    globalThis.$fetch = base.create({
      onRequest({ request, options }) {
        if (!isSameOriginApiRequest(request, window.location.origin)) return
        options.headers = withApiLocale(options.headers, nuxtApp.$i18n?.locale?.value)
      },
    })
  },
})
