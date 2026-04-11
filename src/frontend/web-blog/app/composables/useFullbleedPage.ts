/**
 * @file useFullbleedPage.ts
 * @description 全屏页（fullbleed）开关：让单个页面在 default layout 下隐藏左右两栏、撑满主区，
 *              StatusFooter 等持久 UI 完全不动，避免自定义 layout 带来的重挂载与宽度抖动
 * @author TixXin
 * @since 2026-04-11
 *
 * 用法：
 * - 页面端：在 setup 顶层调用 `defineFullbleedPage()`，自动跟随生命周期 enable/disable
 * - 主题层：调用 `useFullbleedPage()` 读取 `isFullbleed`，切换 class
 */

export function useFullbleedPage() {
  const isFullbleed = useState<boolean>('page-fullbleed', () => false)

  function enable() {
    isFullbleed.value = true
  }

  function disable() {
    isFullbleed.value = false
  }

  return { isFullbleed, enable, disable }
}

/**
 * 页面端便捷 helper：在当前页面 setup 顶层调用一次，
 * 即可自动在 mount 时进入全屏模式、unmount 时退出。
 * 同时兼容 keep-alive 的 activated/deactivated 钩子。
 */
export function defineFullbleedPage() {
  const { enable, disable } = useFullbleedPage()
  onMounted(enable)
  onBeforeUnmount(disable)
  onActivated(enable)
  onDeactivated(disable)
}
