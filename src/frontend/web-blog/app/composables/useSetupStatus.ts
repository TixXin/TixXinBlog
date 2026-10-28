/**
 * @file useSetupStatus.ts
 * @description 读取站点是否需要浏览器初始化；只在客户端请求，不进入 SSR 渲染与页面缓存
 * @author TixXin
 * @since 2026-10-19
 */
import type { SetupStatus } from '~/features/setup/types'

export function useSetupStatus() {
  const staticSite = useStaticSite()
  return async function fetchSetupStatus(): Promise<boolean> {
    // 静态发布只由已初始化的站点导出，没有初始化接口。
    if (staticSite) return false
    const result = await $fetch<{ data: SetupStatus }>('/api/v1/setup/status', { retry: 0, timeout: 10000 })
    return result.data?.needsSetup === true
  }
}
