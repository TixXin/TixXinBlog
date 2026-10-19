/**
 * @file useApiLatency.ts
 * @description 页脚接口延迟读数：只读浏览器资源计时里最近一次同源 API 请求的首字节耗时，不额外发请求，未观测到时为 null
 * @author TixXin
 * @since 2026-10-17
 */

export function useApiLatency() {
  const pingMs = ref<number | null>(null)
  const apiBaseUrl = String(useRuntimeConfig().public.apiBaseUrl ?? '')
  let observer: PerformanceObserver | null = null

  onMounted(() => {
    if (typeof PerformanceObserver === 'undefined' || !apiBaseUrl) return
    const apiPrefix = new URL(apiBaseUrl, window.location.origin).href
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (!entry.name.startsWith(apiPrefix)) continue
        // 缺少细分计时时 responseStart 为 0，退回整体耗时
        const ttfb = entry.responseStart > 0 ? entry.responseStart - entry.startTime : entry.duration
        if (ttfb > 0) pingMs.value = Math.round(ttfb)
      }
    })
    try {
      observer.observe({ type: 'resource', buffered: true })
    } catch {
      observer = null
    }
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { pingMs }
}
