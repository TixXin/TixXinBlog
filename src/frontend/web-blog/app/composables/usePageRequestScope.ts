/**
 * @file usePageRequestScope.ts
 * @description 页面异步初始化的所有权：销毁时取消读取，await之后检查是否仍可继续初始化
 * @author TixXin
 * @since 2026-09-08
 */
import { PageRequestCancellation } from '~/utils/pageRequestCancellation'

export function usePageRequestScope() {
  const controller = new AbortController()
  onScopeDispose(() => controller.abort())
  return {
    signal: controller.signal,
    assertActive() {
      if (controller.signal.aborted) throw new PageRequestCancellation()
    },
  }
}
