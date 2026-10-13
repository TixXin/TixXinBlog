/** @file useSubscriptionToday.ts @description 保留 SSR 日期首帧，客户端重进、午夜与恢复可见时同步 UTC 业务日 */
import { useNow } from '@vueuse/core'
import { todayDate } from '@tixxin/subscription-domain'
export function useSubscriptionToday() {
  const today = useState('subscriptions-today', todayDate)
  const { now, resume, pause } = useNow({ controls: true, interval: 1000, immediate: false })
  const update = () => {
    today.value = todayDate()
  }
  const visible = () => {
    if (document.visibilityState === 'visible') update()
  }
  watch(now, (value) => {
    today.value = value.toISOString().slice(0, 10)
  })
  onMounted(() => {
    update()
    resume()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pageshow', update)
  })
  onScopeDispose(() => {
    pause()
    if (import.meta.client) {
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('pageshow', update)
    }
  })
  return today
}
