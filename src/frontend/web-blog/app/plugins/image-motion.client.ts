/**
 * @file image-motion.client.ts
 * @description 图片实际加载后仅揭示一次；共享捕获监听与观察器，后台、减动效及卸载时取消
 * @author TixXin
 * @since 2026-09-07
 */
export default defineNuxtPlugin({
  name: 'image-motion',
  setup(app) {
    const { reducedMotion } = useMotionPreference()
    const selector =
      '.image-frame__image,.post-item__cover-bg img,.owner-profile-card__avatar,.hero-section__avatar-img,.nexus-bar__avatar-img,.moment-card img,.project-card img,.moment-photo-wall-card img'
    const seen = new WeakMap<HTMLImageElement, string>()
    const running = new Map<HTMLImageElement, () => void>()
    let active = true
    const finishAll = () => [...running.values()].forEach((finish) => finish())
    function reveal(image: HTMLImageElement) {
      if (!active || !image.matches(selector) || !image.complete || !image.naturalWidth) return
      const source = image.currentSrc || image.src
      if (seen.get(image) === source) return
      seen.set(image, source)
      running.get(image)?.()
      if (
        document.hidden ||
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        typeof image.animate !== 'function'
      )
        return
      const animation = image.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: 'ease-out',
        fill: 'both',
      })
      let ended = false
      const finish = () => {
        if (ended) return
        ended = true
        clearTimeout(timer)
        animation.cancel()
        running.delete(image)
      }
      const timer = setTimeout(finish, 300)
      running.set(image, finish)
      void animation.finished.then(finish, finish)
    }
    function images(node: Node) {
      if (!(node instanceof Element)) return []
      return node instanceof HTMLImageElement ? [node] : [...node.querySelectorAll('img')]
    }
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) reveal(event.target)
    }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) images(node).forEach(reveal)
        for (const node of record.removedNodes) images(node).forEach((image) => running.get(image)?.())
      }
    })
    const hidden = () => {
      if (document.hidden) finishAll()
    }
    document.addEventListener('load', onLoad, true)
    document.addEventListener('visibilitychange', hidden)
    const unwatch = watch(
      reducedMotion,
      (reduced) => {
        if (reduced) finishAll()
      },
      { flush: 'sync' },
    )
    onNuxtReady(() => {
      if (!active) return
      // 首屏已加载并显示的SSR图片不再补播，后续真实load或新增节点才需要揭示。
      document.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
        if (image.complete && image.naturalWidth) seen.set(image, image.currentSrc || image.src)
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    const dispose = () => {
      if (!active) return
      active = false
      unwatch()
      observer.disconnect()
      finishAll()
      document.removeEventListener('load', onLoad, true)
      document.removeEventListener('visibilitychange', hidden)
    }
    app.vueApp.onUnmount(dispose)
    if (import.meta.hot) import.meta.hot.dispose(dispose)
  },
})
