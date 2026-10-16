/**
 * @file useLoadingProgress.ts
 * @description 首屏加载进度：真实里程碑写入 <html> 的 CSS 变量，顶部进度条在水合前即可反馈
 * @author TixXin
 * @since 2026-04-15
 */

/** 进度写入的 CSS 自定义属性，AppLoadingTopBar 以 scaleX(var(--app-loading-progress)) 读取 */
const PROGRESS_PROPERTY = '--app-loading-progress'
/**
 * 首屏加载进度管理
 *
 * 设计要点：
 * - 进度不进 Vue 状态：根 Suspense 解析前组件的 mounted 与 ClientOnly 都被推迟，
 *   只有写在 <html> 上的 CSS 变量能在插件阶段、水合阶段持续驱动视觉反馈
 * - 里程碑由真实事件提供（主题组件逐个加载、app:beforeMount、app:suspense:resolve），不再使用假 trickle
 * - set() 单调递增，不倒退；服务端全部为空操作，SSR 与首帧一致（变量缺省由 CSS 给出启动值）
 */
export function useLoadingProgress() {
  function current(): number {
    if (!import.meta.client) return 0
    const value = Number.parseFloat(document.documentElement.style.getPropertyValue(PROGRESS_PROPERTY))
    return Number.isFinite(value) ? value * 100 : 0
  }

  /** 锚点推进：单调递增，不倒退，最高不超 100 */
  function set(value: number) {
    if (!import.meta.client) return
    const next = Math.min(100, Math.max(current(), value))
    document.documentElement.style.setProperty(PROGRESS_PROPERTY, (next / 100).toFixed(3))
  }

  /** 完成：拉满到 100%，淡出由 html.app-client-ready 的样式负责 */
  function finish() {
    set(100)
  }

  /** 归零并移除（非首次访问路径） */
  function reset() {
    if (!import.meta.client) return
    document.documentElement.style.removeProperty(PROGRESS_PROPERTY)
  }

  return { set, finish, reset }
}
