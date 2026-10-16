/**
 * @file ssrRenderStatus.ts
 * @description 判断一次 SSR 渲染是否因上游读取失败而降级，降级页面以 503 返回，不进入页面缓存也不被收录
 * @author TixXin
 * @since 2026-10-16
 */

interface PayloadError {
  statusCode?: number
}

/**
 * payload._errors 记录了本次渲染里出错的 AsyncData：
 * - 5xx 或没有状态码（网络层失败）说明上游不可用，页面只是带着错误态勉强渲染，返回 503
 * - 4xx 是请求本身的问题（如不存在的编号），由页面各自处理，不改状态码
 */
export function ssrDegradedStatus(errors: Record<string, unknown> | undefined): number | null {
  if (!errors) return null
  for (const error of Object.values(errors)) {
    if (!error) continue
    const statusCode = (error as PayloadError).statusCode
    if (typeof statusCode !== 'number' || statusCode >= 500) return 503
  }
  return null
}
