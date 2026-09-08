/**
 * @file useSidebarExitAnimation.ts
 * @description 侧栏离场事务：导航取消、动画中断、超时与卸载时统一恢复源节点
 * @author TixXin
 * @since 2026-03-24
 */
export function useSidebarExitAnimation(containerSelector: string, targetId = 'right-sidebar-target') {
  const router = useRouter()
  const app = useNuxtApp()
  const { sidebarAnimationPreset } = useAppearanceSettings()
  const { reducedMotion } = useMotionPreference()
  let finish: (() => void) | undefined
  const disposers: (() => void)[] = []
  const cleanup = () => finish?.()

  onMounted(() => {
    disposers.push(
      router.beforeEach((to, from) => {
        cleanup()
        if (to.path === from.path || sidebarAnimationPreset.value === 'none' || reducedMotion.value) return
        const aside = document.querySelector<HTMLElement>(containerSelector)
        const target = document.getElementById(targetId)
        const source = target?.firstElementChild as HTMLElement | null
        if (!aside || !source) return
        const rect = source.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const parentRect = aside.getBoundingClientRect()
        const visibility = source.style.visibility
        const clone = source.cloneNode(true) as HTMLElement
        clone.removeAttribute('id')
        clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
        clone.inert = true
        clone.setAttribute('aria-hidden', 'true')
        clone.classList.add('sidebar-leaving-clone')
        if (sidebarAnimationPreset.value === 'fade-in-up') clone.classList.add('sidebar-leave-slide-right')
        Object.assign(clone.style, {
          left: `${rect.left - parentRect.left}px`,
          top: `${rect.top - parentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          right: 'auto',
        })
        source.style.visibility = 'hidden'
        aside.appendChild(clone)
        let completed = false
        const complete = () => {
          if (completed) return
          completed = true
          clearTimeout(timer)
          clone.removeEventListener('animationend', onEnd)
          clone.removeEventListener('animationcancel', onEnd)
          clone.remove()
          if (visibility) source.style.visibility = visibility
          else source.style.removeProperty('visibility')
          if (finish === complete) finish = undefined
        }
        const onEnd = (event: AnimationEvent) => {
          if (event.target === clone) complete()
        }
        // 不能依赖结束事件作为唯一出口：样式热替换和偏好变化都可能取消动画。
        const timer = setTimeout(complete, 400)
        finish = complete
        clone.addEventListener('animationend', onEnd)
        clone.addEventListener('animationcancel', onEnd)
      }),
    )
    disposers.push(
      router.afterEach((_to, _from, failure) => {
        if (failure) cleanup()
      }),
    )
    disposers.push(app.hook('page:finish', cleanup), app.hook('app:error', cleanup))
  })
  watch([reducedMotion, sidebarAnimationPreset], cleanup, { flush: 'sync' })
  onBeforeUnmount(() => {
    cleanup()
    disposers.forEach((dispose) => dispose())
  })
}
