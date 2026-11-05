/** @file useSubscriptionToday.ts @description 保留 SSR 日期首帧，客户端重进、站点时区午夜与恢复可见时同步业务日（与后端统计同为站点时区） */
import { useNow } from '@vueuse/core'
import { todayDate } from '@tixxin/subscription-domain'
export function useSubscriptionToday() {
  const timeZone = useSiteTimeZone()
  const today = useState('subscriptions-today', () => todayDate(timeZone.value))
  const { now, resume, pause } = useNow({ controls: true, interval: 1000, immediate: false })
  const update = () => {
    today.value = todayDate(timeZone.value)
  }
  const visible = () => {
    if (document.visibilityState === 'visible') update()
  }
  watch(now, (value) => {
    today.value = todayDate(timeZone.value, value)
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
