/**
 * @file useSiteTimeZone.ts
 * @description 当前站点时区（来自站点资料，SSR 与浏览器共享）；资料缺失或旧接口未返回时按 Asia/Shanghai。
 */
import { DEFAULT_SITE_TIME_ZONE } from '~/features/site/timeZone'

export function useSiteTimeZone() {
  const { settings } = useSiteSettings()
  return computed(() => settings.value.timeZone || DEFAULT_SITE_TIME_ZONE)
}
