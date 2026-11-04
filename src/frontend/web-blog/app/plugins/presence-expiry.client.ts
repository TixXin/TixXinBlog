/**
 * @file presence-expiry.client.ts
 * @description 手动状态到期时自动隐藏：应用就绪后按站点资料的到期时间设一个定时器，到点推进共享时钟，
 *   状态行随之回到自动状态，无需刷新页面。静态发布同样生效（只用构建时导出的到期时间）。
 */
import { usePresenceClock } from '~/composables/useSiteInfo'

/** setTimeout 的最长延迟约 24.8 天；更远的到期时间分段等待 */
const MAX_DELAY = 2 ** 31 - 1

export default defineNuxtPlugin(() => {
  const { settings } = useSiteSettings()
  const clock = usePresenceClock()
  let timer: ReturnType<typeof setTimeout> | null = null
  function schedule(expiresAt: string | undefined) {
    if (timer) clearTimeout(timer)
    timer = null
    const due = expiresAt ? Date.parse(expiresAt) : Number.NaN
    if (!Number.isFinite(due)) return
    const wait = due - Date.now()
    // 已过期（例如页面缓存期间到期）时立即推进；否则到点再推进。
    if (wait <= 0) {
      clock.value = Date.now()
      return
    }
    timer = setTimeout(
      () => (wait > MAX_DELAY ? schedule(expiresAt) : (clock.value = Date.now())),
      Math.min(wait, MAX_DELAY),
    )
  }
  // 水合完成后再推进时钟，避免与服务端渲染结果不一致。
  onNuxtReady(() => {
    watch(() => settings.value.presenceExpiresAt, schedule, { immediate: true })
  })
})
