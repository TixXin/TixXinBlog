/**
 * @file 02.static-api.client.ts
 * @description 静态发布形态下，浏览器内经 $fetch 发往 /api/v1 的公开读取改读构建时导出的冻结接口文件；
 *              服务器部署不安装，行为不变。预渲染阶段的服务端请求仍经网关访问真实接口。
 */
import { createStaticFetch, type BaseFetch } from '~/features/static/staticFetch'
import { textQueryFallback } from '~/features/static/textQuery'

export default defineNuxtPlugin({
  name: 'static-api',
  dependsOn: ['api-locale'],
  setup() {
    const config = useRuntimeConfig()
    if (!config.public.staticSite) return
    globalThis.$fetch = createStaticFetch(globalThis.$fetch as unknown as BaseFetch, {
      apiBase: String(config.public.apiBaseUrl),
      origin: window.location.origin,
      fallback: textQueryFallback,
    }) as unknown as typeof globalThis.$fetch
  },
})
