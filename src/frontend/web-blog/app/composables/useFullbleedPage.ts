/**
 * @file useFullbleedPage.ts
 * @description 全屏页（fullbleed）开关：让单个页面在 default layout 下隐藏左右两栏、撑满主区，
 *              StatusFooter 等持久 UI 完全不动，避免自定义 layout 带来的重挂载与宽度抖动
 * @author TixXin
 * @since 2026-04-11
 *
 * 状态切换由 default layout 的 page transition `onBeforeEnter` 钩子驱动 ——
 * 在新页面进入前根据 route.meta.fullbleed 翻转 class，离场页面在整个 leave
 * transition 期间保持自己的 fullbleed 模式，避免被中途挤压。
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
