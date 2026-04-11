/**
 * @file useMomentFilters.ts
 * @description 朋友圈筛选状态共享，用于页面与主题布局组件间通信（日期筛选）
 * @author TixXin
 * @since 2026-04-11
 */

export function useMomentFilters() {
  const selectedDate = useState<string | null>('momentSelectedDate', () => null)
  return { selectedDate }
}
