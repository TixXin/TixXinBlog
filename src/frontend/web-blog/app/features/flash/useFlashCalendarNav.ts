/**
 * @file useFlashCalendarNav.ts
 * @description 闪念发布日历月份导航状态：按站点时区确定今天与当前月，视图年月切换、今天重置、外部已选日期同步
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import { siteDayKey, siteYearMonth } from '~/features/site/timeZone'

export function useFlashCalendarNav(selectedDate: Ref<string | null | undefined>) {
  const zone = useSiteTimeZone()
  const current = () => siteYearMonth(Date.now(), zone.value)
  const viewYear = ref(current().year)
  const viewMonth = ref(current().month)
  /** 站点时区的今天，决定“今天”高亮、未来日期与连续天数 */
  const today = computed(() => siteDayKey(Date.now(), zone.value))

  // 与动态日历一致：切换侧栏或抽屉后，从共享筛选恢复已选日期所在月份。
  watch(
    () => selectedDate.value,
    (value) => {
      if (!value) return
      const date = new Date(`${value}T12:00:00Z`)
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return
      viewYear.value = date.getUTCFullYear()
      viewMonth.value = date.getUTCMonth()
    },
    { immediate: true },
  )

  const monthLabel = computed(() =>
    formatDate(Date.UTC(viewYear.value, viewMonth.value, 1), { timeZone: 'UTC', year: 'numeric', month: 'short' }),
  )

  const isCurrentMonth = computed(() => {
    const now = siteYearMonth(Date.now(), zone.value)
    return viewYear.value === now.year && viewMonth.value === now.month
  })

  function prevMonth() {
    if (viewMonth.value === 0) {
      viewMonth.value = 11
      viewYear.value--
    } else {
      viewMonth.value--
    }
  }

  function nextMonth() {
    if (isCurrentMonth.value) return
    if (viewMonth.value === 11) {
      viewMonth.value = 0
      viewYear.value++
    } else {
      viewMonth.value++
    }
  }

  function goToday() {
    const now = current()
    viewYear.value = now.year
    viewMonth.value = now.month
  }

  return {
    viewYear,
    viewMonth,
    today,
    monthLabel,
    isCurrentMonth,
    prevMonth,
    nextMonth,
    goToday,
  }
}
