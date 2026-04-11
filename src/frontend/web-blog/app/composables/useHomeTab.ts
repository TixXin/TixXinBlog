/**
 * @file useHomeTab.ts
 * @description 首页 Tab 状态共享，用于页面与主题布局组件间通信
 * @author TixXin
 * @since 2026-04-11
 */

export function useHomeTab() {
  const homeActiveTab = useState<string>('homeActiveTab', () => 'all')
  return { homeActiveTab }
}
