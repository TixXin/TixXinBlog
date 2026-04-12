/**
 * @file useTabSettings.ts
 * @description 标签页设置状态管理：持久化到 localStorage，跨组件共享，支持分组恢复默认
 * @author TixXin
 * @since 2026-04-12
 */

export type TabIconStyle = 'default' | 'rounded' | 'flat'

export interface TabSettings {
  // ---- 图标 ----
  /** 书签图标风格：default 方形 / rounded 圆形 / flat 扁平 */
  iconStyle: TabIconStyle
  /** 图标尺寸 px */
  iconSize: number
  /** 图标圆角 px（圆形模式自动 = size/2） */
  iconRadius: number
  /** 图标不透明度 0-1 */
  iconOpacity: number
  /** 图标间距 px */
  iconGap: number
  /** 是否显示图标名称 */
  showIconName: boolean
  /** 名称字号 px */
  nameSize: number
  /** 名称颜色 hex（空串 = 默认 CSS 变量色） */
  nameColor: string
  /** 图标区域最大宽度 */
  gridMaxWidth: number
  /** 最大宽度单位 */
  gridMaxWidthUnit: 'px' | '%'

  // ---- 时间 ----
  /** 显示问候语 */
  showGreeting: boolean
  /** 显示日期 */
  showDate: boolean
  /** 日期中显示秒数 */
  showSeconds: boolean

  // ---- 侧边栏 ----
  /** 默认折叠 */
  defaultCollapsed: boolean
  /** 显示书签计数 */
  showCounts: boolean
  /** 侧边栏圆角 px */
  sidebarRadius: number
  /** 侧边栏背景不透明度 0-1 */
  sidebarOpacity: number
  /** 侧边栏毛玻璃效果 */
  sidebarBlur: boolean
}

const STORAGE_KEY = 'tab-settings'

export const TAB_SETTINGS_DEFAULTS: Readonly<TabSettings> = {
  iconStyle: 'default',
  iconSize: 48,
  iconRadius: 12,
  iconOpacity: 1,
  iconGap: 8,
  showIconName: true,
  nameSize: 12,
  nameColor: '',
  gridMaxWidth: 720,
  gridMaxWidthUnit: 'px',
  showGreeting: true,
  showDate: true,
  showSeconds: false,
  defaultCollapsed: false,
  showCounts: true,
  sidebarRadius: 12,
  sidebarOpacity: 1,
  sidebarBlur: true,
}

/** 各 section 对应的设置键 */
const SECTION_KEYS: Record<string, (keyof TabSettings)[]> = {
  icon: [
    'iconStyle', 'iconSize', 'iconRadius', 'iconOpacity', 'iconGap',
    'showIconName', 'nameSize', 'nameColor', 'gridMaxWidth', 'gridMaxWidthUnit',
  ],
  time: ['showGreeting', 'showDate', 'showSeconds'],
  sidebar: ['defaultCollapsed', 'showCounts', 'sidebarRadius', 'sidebarOpacity', 'sidebarBlur'],
}

function readSettings(): TabSettings {
  if (!import.meta.client) return { ...TAB_SETTINGS_DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...TAB_SETTINGS_DEFAULTS }
    return { ...TAB_SETTINGS_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...TAB_SETTINGS_DEFAULTS }
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

  /** 恢复指定 section 的所有设置项到默认值 */
  function resetSection(section: string) {
    const keys = SECTION_KEYS[section]
    if (!keys) return
    const next = { ...settings.value }
    for (const key of keys) {
      ;(next as Record<string, unknown>)[key] = TAB_SETTINGS_DEFAULTS[key]
    }
    settings.value = next
    writeSettings(next)
  }

  return {
    settings,
    update,
    resetSection,
  }
}
