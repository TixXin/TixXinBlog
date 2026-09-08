/**
 * @file useFullbleedPage.ts
 * @description 全屏页（fullbleed）开关：让单个页面在 default layout 下隐藏左右两栏、撑满主区，
 *              StatusFooter 等持久 UI 完全不动，避免自定义 layout 带来的重挂载与宽度抖动
 * @author TixXin
 * @since 2026-04-11
 *
 * 状态由default layout跟随Nuxt已解析的route.meta.fullbleed同步，
 * 与动画生命周期解耦，关闭动画和历史导航也能切换布局。
 *
 * 页面端只需声明 `definePageMeta({ fullbleed: true })`。
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
