/**
 * @file useTabSettings.ts
 * @description 标签页设置状态管理：持久化到 localStorage，跨组件共享，支持分组恢复默认
 * @author TixXin
 * @since 2026-04-12
 */

export type TabIconStyle = 'default' | 'rounded' | 'flat'
export type TabViewMode = 'grid' | 'compact' | 'list' | 'cards'
export type WallpaperKind = 'none' | 'solid' | 'gradient' | 'preset' | 'url' | 'upload'
export type FaviconProvider = 'google' | 'duckduckgo' | 'icon-horse'
export type SearchEngine = 'google' | 'bing' | 'duckduckgo' | 'baidu' | 'custom'

/** 壁纸配置（每种亮/暗模式独立维护一份） */
export interface WallpaperConfig {
  kind: WallpaperKind
  /** 纯色（kind=solid） */
  solidColor?: string
  /** 渐变（kind=gradient） */
  gradient?: { from: string; via?: string; to: string; angle: number }
  /** 内置预设 id（kind=preset） */
  presetId?: string
  /** 外链 URL（kind=url） */
  url?: string
  /** IndexedDB key（kind=upload） */
  uploadKey?: string
}

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
  /** 是否自动抓取书签 favicon */
  faviconAutoFetch: boolean
  /** favicon 服务提供商 */
  faviconProvider: FaviconProvider

  // ---- 布局 ----
  /** 视图模式：grid 大网格 / compact 紧凑 / list 列表 / cards 详情卡 */
  viewMode: TabViewMode
  /** 固定列数，'auto' 为自适应（仅 grid/compact 视图生效） */
  gridColumns: number | 'auto'
  /** 是否启用拖拽排序 */
  dragEnabled: boolean

  // ---- 壁纸 ----
  /** 亮暗是否使用独立壁纸；false 时两边共用 wallpaperLight */
  wallpaperIndependent: boolean
  wallpaperLight: WallpaperConfig
  wallpaperDark: WallpaperConfig
  /** 壁纸遮罩层不透明度 0-0.8 */
  wallpaperMaskOpacity: number
  /** 壁纸模糊半径 px（0 不模糊） */
  wallpaperBlur: number
  /** 是否叠加噪点纹理 */
  wallpaperNoise: boolean
  /** 是否叠加暗角 */
  wallpaperVignette: boolean

  // ---- 搜索/命令面板 ----
  /** 外部搜索引擎 */
  searchEngine: SearchEngine
  /** 自定义搜索 URL，%s 占位会被替换为 query */
  searchEngineCustomUrl: string
  /** Cmd/Ctrl+K 唤起命令面板 */
  commandPaletteEnabled: boolean

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

const DEFAULT_WALLPAPER: WallpaperConfig = { kind: 'none' }

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
  faviconAutoFetch: true,
  faviconProvider: 'google',
  viewMode: 'grid',
  gridColumns: 'auto',
  dragEnabled: true,
  wallpaperIndependent: false,
  wallpaperLight: { ...DEFAULT_WALLPAPER },
  wallpaperDark: { ...DEFAULT_WALLPAPER },
  wallpaperMaskOpacity: 0,
  wallpaperBlur: 0,
  wallpaperNoise: false,
  wallpaperVignette: false,
  searchEngine: 'google',
  searchEngineCustomUrl: '',
  commandPaletteEnabled: true,
  showGreeting: true,
  showDate: true,
  showSeconds: false,
  defaultCollapsed: false,
  showCounts: true,
  sidebarRadius: 12,
  sidebarOpacity: 1,
  sidebarBlur: true,
}

/** 各 section 对应的设置键，用于「恢复默认」分组 */
const SECTION_KEYS: Record<string, (keyof TabSettings)[]> = {
  icon: [
    'iconStyle', 'iconSize', 'iconRadius', 'iconOpacity', 'iconGap',
    'showIconName', 'nameSize', 'nameColor', 'gridMaxWidth', 'gridMaxWidthUnit',
    'faviconAutoFetch', 'faviconProvider',
  ],
  view: ['viewMode', 'gridColumns', 'dragEnabled'],
  wallpaper: [
    'wallpaperIndependent', 'wallpaperLight', 'wallpaperDark',
    'wallpaperMaskOpacity', 'wallpaperBlur', 'wallpaperNoise', 'wallpaperVignette',
  ],
  search: ['searchEngine', 'searchEngineCustomUrl', 'commandPaletteEnabled'],
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
