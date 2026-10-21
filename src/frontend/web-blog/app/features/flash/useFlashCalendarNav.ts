/**
 * @file useFlashCalendarNav.ts
 * @description 闪念发布日历月份导航状态：UTC 视图年月切换、今天重置、外部已选日期同步
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'

export function useFlashCalendarNav(selectedDate: Ref<string | null | undefined>) {
  const viewYear = ref(new Date().getUTCFullYear())
  const viewMonth = ref(new Date().getUTCMonth())

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
    const now = new Date()
    return viewYear.value === now.getUTCFullYear() && viewMonth.value === now.getUTCMonth()
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
    const now = new Date()
    viewYear.value = now.getUTCFullYear()
    viewMonth.value = now.getUTCMonth()
  }

  return {
    viewYear,
    viewMonth,
    monthLabel,
    isCurrentMonth,
    prevMonth,
    nextMonth,
    goToday,
  }
}
