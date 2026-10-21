/**
 * @file useMomentCalendar.ts
 * @description 朋友圈日历状态计算与交互组合函数，支持 UTC 月份切换、按日动态聚合与连续打卡统计
 * @author TixXin
 * @since 2026-04-20
 */

export interface MomentCalendarProps {
  momentDates?: string[]
  dateCounts?: Record<string, number>
  available?: boolean
  selectedDate?: string | null
}

export interface CalendarDay {
  num: number
  dateStr: string
  isToday: boolean
  hasMoment: boolean
  isFuture: boolean
  momentCount: number
}

export function useMomentCalendar(
  props: MomentCalendarProps,
  emit: (event: 'select-date', date: string | null) => void,
) {
  const { t } = useI18n()
  // 星期表头从周一开始
  const weekdays = computed(() =>
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => t(`layout.sidebar.calendar.weekdays.${day}`)),
  )

  /** 日期按钮的读屏名称；日数不补零，保证可见的日数是可访问名的一部分 */
  function dayLabel(dateStr: string) {
    const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number)
    return formatDate(Date.UTC(year, month - 1, day), {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const viewYear = ref(new Date().getUTCFullYear())
  const viewMonth = ref(new Date().getUTCMonth())

  // 侧栏与抽屉切换会重新挂载日历；从共享筛选恢复月份，避免选中日期离开可见月份。
  watch(
    () => props.selectedDate,
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

  /** 回到今天 */
  function goToday() {
    const now = new Date()
    viewYear.value = now.getUTCFullYear()
    viewMonth.value = now.getUTCMonth()
  }

  /** 按日期聚合动态数量 */
  const momentDateMap = computed(() => {
    if (props.dateCounts) return new Map(Object.entries(props.dateCounts))
    const map = new Map<string, number>()
    ;(props.momentDates ?? []).forEach((d) => {
      const key = d.slice(0, 10)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return map
  })

  const calendarDays = computed<(CalendarDay | null)[]>(() => {
    const y = viewYear.value
    const m = viewMonth.value
    const firstDay = new Date(Date.UTC(y, m, 1))
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

    // Monday=0 offset
    const startOffset = (firstDay.getUTCDay() + 6) % 7
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    const result: (CalendarDay | null)[] = []

    // pad leading empties
    for (let i = 0; i < startOffset; i++) {
      result.push(null)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isFuture = dateStr > todayStr
      const momentCount = momentDateMap.value.get(dateStr) || 0
      result.push({
        num: d,
        dateStr,
        isToday: dateStr === todayStr,
        hasMoment: momentCount > 0,
        isFuture,
        momentCount,
      })
    }

    return result
  })

  const monthMomentCount = computed(() => {
    const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
    return [...momentDateMap.value]
      .filter(([date]) => date.startsWith(prefix))
      .reduce((sum, [, count]) => sum + count, 0)
  })

  /** 计算最近连续发布天数 */
  const streak = computed(() => {
    const sortedDates = [...momentDateMap.value.keys()].sort().reverse()
    const latest = sortedDates[0]
    if (!latest) return 0

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // 从今天或最近一条动态开始往回数
    let count = 0
    const startDate = new Date(latest)
    startDate.setUTCHours(0, 0, 0, 0)

    // 如果最近的动态不是今天或昨天，不算连续
    const diffDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
    if (diffDays > 1) return 0

    const dateSet = new Set(sortedDates)
    const checkDate = new Date(startDate)
    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      count++
      checkDate.setUTCDate(checkDate.getUTCDate() - 1)
    }

    return count
  })

  /** 当前视图月份中某天的月日文字，如「10月19日」 */
  function monthDay(num: number) {
    return formatDate(Date.UTC(viewYear.value, viewMonth.value, num), {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    })
  }

  function dayTooltip(day: CalendarDay): string {
    return t('layout.sidebar.calendar.momentTooltip', { date: monthDay(day.num), count: day.momentCount })
  }

  /** 点击日期，切换筛选 */
  function onDayClick(day: CalendarDay) {
    if (props.selectedDate === day.dateStr) {
      emit('select-date', null)
    } else {
      emit('select-date', day.dateStr)
    }
  }

  return {
    weekdays,
    monthLabel,
    isCurrentMonth,
    calendarDays,
    monthMomentCount,
    streak,
    prevMonth,
    nextMonth,
    goToday,
    dayLabel,
    dayTooltip,
    onDayClick,
  }
}
