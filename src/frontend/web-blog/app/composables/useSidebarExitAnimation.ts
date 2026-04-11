/**
 * @file useSidebarExitAnimation.ts
 * @description 右侧栏页面切换退出动画：导航前克隆内容播放离场动画，供各布局主题复用
 * @author TixXin
 * @since 2026-03-24
 */

/**
 * 在当前布局激活期间注册 router.beforeEach 守卫，
 * 导航时克隆右侧栏内容并播放退出动画。
 * 守卫在 onMounted 时注册、onBeforeUnmount 时自动移除，
 * 避免非激活主题的守卫查询不存在的 DOM。
 *
 * @param containerSelector - 包含右侧栏的容器选择器，如 '.aside-right' 或 '.docs-aside'
 * @param targetId - Teleport 目标元素 ID，默认 'right-sidebar-target'
 */
export function useSidebarExitAnimation(
  containerSelector: string,
  targetId = 'right-sidebar-target',
) {
  const router = useRouter()
  const { sidebarAnimationPreset } = useAppearanceSettings()

  onMounted(() => {
    const removeGuard = router.beforeEach((to, from) => {
      // 同路径导航（仅 hash/query 变化，例如点击文章目录锚点）不触发退出动画：
      // 页面组件不会重新挂载，若仍执行守卫会把源元素隐藏后无法恢复，导致右侧栏整体消失。
      if (to.path === from.path) return

      const aside = document.querySelector(containerSelector) as HTMLElement | null
      const target = document.getElementById(targetId)
      const source = target?.firstElementChild as HTMLElement | null

      if (!aside || !target || !source) return

      const sourceRect = source.getBoundingClientRect()
      const asideRect = aside.getBoundingClientRect()
      const clone = source.cloneNode(true) as HTMLElement
      clone.classList.add('sidebar-leaving-clone')
      if (sidebarAnimationPreset.value === 'fade-in-up') {
        clone.classList.add('sidebar-leave-slide-right')
      }
      clone.style.left = `${sourceRect.left - asideRect.left}px`
      clone.style.top = `${sourceRect.top - asideRect.top}px`
      clone.style.width = `${sourceRect.width}px`
      clone.style.height = `${sourceRect.height}px`
      clone.style.right = 'auto'
      source.style.visibility = 'hidden'
      aside.appendChild(clone)

      clone.addEventListener('animationend', () => {
        clone.remove()
      }, { once: true })
    })

    onBeforeUnmount(() => removeGuard())
  })
}
