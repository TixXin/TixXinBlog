/**
 * @file useAppLoading.ts
 * @description 首次访问全屏 loading 动画状态管理，通过 sessionStorage 判断是否首次访问
 * @author TixXin
 * @since 2026-04-11
 */

const STORAGE_KEY = 'tixxin-blog-visited'

/**
 * 首次访问 loading 动画状态管理
 *
 * 设计要点：
 * - SSR 与客户端初始 hydration 时 isLoading 始终为 true，避免水合不匹配
 * - 生产环境：通过 sessionStorage + nuxt.config 内联脚本在 hydration 前为 <html>
 *   添加 .visited class，CSS 用 `display: none !important` 隐藏 loading，消除闪烁
 * - 开发环境：每次刷新都视为首次访问，便于调试 loading 动画效果
 * - 状态层的关闭在 onNuxtReady 后由 app.vue 触发，避免同步改状态引发水合警告
 */
export function useAppLoading() {
  const isLoading = useState('app-loading', () => true)

  // 开发环境：清除旧的 visited 标记，确保每次刷新都能看到 loading
  if (import.meta.client && import.meta.dev) {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      document.documentElement.classList.remove('visited')
    } catch {
      // ignore
    }
  }

  /** 判断当前是否首次访问（仅在客户端调用） */
  function checkFirstVisit(): boolean {
    if (!import.meta.client) return true
    // 开发环境总是显示 loading，便于调试
    if (import.meta.dev) return true
    try {
      return !sessionStorage.getItem(STORAGE_KEY)
    } catch {
      return true
    }
  }

  /** 关闭 loading 并标记已访问（开发环境不写 storage） */
  function dismiss() {
    isLoading.value = false
    if (import.meta.client && !import.meta.dev) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
        document.documentElement.classList.add('visited')
      } catch {
        // 忽略存储失败
      }
    }
  }

  return {
    isLoading,
    checkFirstVisit,
    dismiss,
  }
}
