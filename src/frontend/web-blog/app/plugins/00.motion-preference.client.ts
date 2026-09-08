/**
 * @file 00.motion-preference.client.ts
 * @description 每个应用只订阅一次系统动效偏好，水合后同步并在卸载或热替换时释放
 * @author TixXin
 * @since 2026-09-07
 */
import { settleColorMotion } from '~/utils/colorMotion'
import { finishRootScrolls } from '~/utils/scrollRoot'

export default defineNuxtPlugin({
  name: 'motion-preference',
  enforce: 'pre',
  setup(app) {
    const reduced = useState('motion-reduced', () => false)
    const ready = useState('motion-preference-ready', () => false)
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    let active = true
    const sync = () => {
      if (!active) return
      if (query.matches) {
        settleColorMotion(document)
        finishRootScrolls()
      }
      if (app.isHydrating) return
      reduced.value = query.matches
      ready.value = true
    }
    query.addEventListener('change', sync)
    onNuxtReady(sync)
    const dispose = () => {
      if (!active) return
      active = false
      query.removeEventListener('change', sync)
    }
    app.vueApp.onUnmount(dispose)
    if (import.meta.hot) import.meta.hot.dispose(dispose)
  },
})
