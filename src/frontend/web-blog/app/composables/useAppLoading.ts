/**
 * @file useAppLoading.ts
 * @description 首次访问全屏 loading 动画状态管理，通过 sessionStorage 判断是否首次访问
 * @author TixXin
 * @since 2026-04-11
 */

const STORAGE_KEY = 'blog-visited'

/**
 * 首次访问 loading 动画状态管理
 *
 * 设计要点：
 * - SSR 与客户端初始 hydration 时 isLoading 始终为 true，避免水合不匹配
 * - 通过 sessionStorage + nuxt.config 内联脚本在 hydration 前为 <html>
 *   添加 .visited class，CSS 用 `display: none !important` 隐藏 loading，消除闪烁
 * - 开发与生产行为一致；调试品牌层时在地址加 `?splash=1` 强制显示
 * - 状态层的关闭在 app:suspense:resolve 后由 app.vue 触发，避免水合期间改状态引发警告
 */
export function useAppLoading() {
  const isLoading = useState('app-loading', () => true)
  // 主题切换 loading：独立于首屏，布局加载期间提供非阻断状态提示。
  const isThemeSwitchLoading = useState('app-theme-switch-loading', () => false)

  /** 判断当前是否首次访问（仅在客户端调用）；与 <head> 内联脚本的判定保持一致 */
  function checkFirstVisit(): boolean {
    if (!import.meta.client) return true
    return !document.documentElement.classList.contains('visited')
  }

  /** 关闭 loading 并标记已访问 */
  function dismiss() {
    isLoading.value = false
    if (import.meta.client) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
        document.documentElement.classList.add('visited')
      } catch {
        // 忽略存储失败
      }
    }
  }

  /** 开始主题切换状态提示 */
  function startThemeSwitchLoading() {
    isThemeSwitchLoading.value = true
  }

  /** 结束主题切换状态提示 */
  function endThemeSwitchLoading() {
    isThemeSwitchLoading.value = false
  }

  return {
    isLoading,
    isThemeSwitchLoading,
    checkFirstVisit,
    dismiss,
    startThemeSwitchLoading,
    endThemeSwitchLoading,
  }
}
