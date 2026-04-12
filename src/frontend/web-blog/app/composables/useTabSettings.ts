/**
 * @file useTabSettings.ts
 * @description 标签页设置状态管理：持久化到 localStorage，跨组件共享
 * @author TixXin
 * @since 2026-04-12
 */

export type TabIconStyle = 'default' | 'rounded' | 'flat'

export interface TabSettings {
  /** 书签图标风格 */
  iconStyle: TabIconStyle
  /** 是否显示问候语 */
  showGreeting: boolean
  /** 是否显示日期 */
  showDate: boolean
  /** 侧边栏是否默认折叠 */
  defaultCollapsed: boolean
  /** 侧边栏是否显示书签计数 */
  showCounts: boolean
}

const STORAGE_KEY = 'tab-settings'

const DEFAULTS: TabSettings = {
  iconStyle: 'default',
  showGreeting: true,
  showDate: true,
  defaultCollapsed: false,
  showCounts: true,
}

function readSettings(): TabSettings {
  if (!import.meta.client) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeSettings(settings: TabSettings) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 忽略：隐私模式 */
  }
}

export function useTabSettings() {
  const settings = useState<TabSettings>('tab-settings', () => readSettings())

  /** 更新单个设置项，自动持久化 */
  function update<K extends keyof TabSettings>(key: K, value: TabSettings[K]) {
    settings.value = { ...settings.value, [key]: value }
    writeSettings(settings.value)
  }

  return {
    settings,
    update,
  }
}
