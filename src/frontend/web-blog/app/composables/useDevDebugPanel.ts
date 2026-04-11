/**
 * @file useDevDebugPanel.ts
 * @description Dev 调试面板共享状态：抽屉开关、激活 tab、停靠位置、FAB 拖拽位置、居中态窗口矩形（仅 dev 使用，调用方应被 DevOnly 包裹）
 * @author TixXin
 * @since 2026-04-11
 */

export type DevDebugTab = 'viewport' | 'route' | 'auth' | 'env'

/** 抽屉停靠位置：四边贴边停靠或居中浮窗（居中态可拖拽缩放） */
export type DevDebugDockPosition = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface FabPosition {
  x: number
  y: number
}

/** 居中浮窗矩形（位置 + 尺寸），仅 position === 'center' 时生效 */
export interface CenterRect {
  x: number
  y: number
  w: number
  h: number
}

const FAB_POS_KEY = 'dev-debug:fab-pos'
const TAB_KEY = 'dev-debug:active-tab'
const POSITION_KEY = 'dev-debug:position'
const CENTER_RECT_KEY = 'dev-debug:center-rect'
const FONT_SCALE_KEY = 'dev-debug:font-scale'
const VALID_TABS: DevDebugTab[] = ['viewport', 'route', 'auth', 'env']
const VALID_POSITIONS: DevDebugDockPosition[] = ['left', 'right', 'top', 'bottom', 'center']

/** 居中浮窗最小尺寸，避免被拖到不可用 */
export const CENTER_MIN = { w: 360, h: 320 }
export const CENTER_DEFAULT = { w: 520, h: 560 }

/** 面板独立缩放（CSS zoom）的范围与步长，仅作用于 dev 调试面板自身 */
export const FONT_SCALE_MIN = 0.7
export const FONT_SCALE_MAX = 1.5
export const FONT_SCALE_STEP = 0.1
export const FONT_SCALE_DEFAULT = 1

/** FAB 视觉尺寸（用于把位置 clamp 在视口内，避免拖出屏幕） */
const FAB_SIZE = { w: 64, h: 28 }

/** 安全读取 localStorage：SSR 期或 try/catch 均回落到 fallback */
function readStorage<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

/** 安全写入 localStorage */
function writeStorage(key: string, value: string) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 忽略：隐私模式下可能写入失败 */
  }
}

/** 把坐标 clamp 在当前视口内 */
function clampToViewport(pos: FabPosition): FabPosition {
  if (!import.meta.client) return pos
  const maxX = Math.max(0, window.innerWidth - FAB_SIZE.w)
  const maxY = Math.max(0, window.innerHeight - FAB_SIZE.h)
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  }
}

export function useDevDebugPanel() {
  // 抽屉开关：默认收起，不持久化（频繁刷新时不被打扰）
  const isOpen = useState<boolean>('dev-debug:open', () => false)

  // 当前 tab：初始读 localStorage，setActiveTab 同步写回
  const activeTab = useState<DevDebugTab>('dev-debug:tab', () =>
    readStorage<DevDebugTab>(
      TAB_KEY,
      (raw) => (VALID_TABS.includes(raw as DevDebugTab) ? (raw as DevDebugTab) : null),
      'viewport',
    ),
  )

  // FAB 位置：初始读 localStorage，setFabPosition 同步 + clamp
  const fabPosition = useState<FabPosition>('dev-debug:fab-pos', () =>
    readStorage<FabPosition>(
      FAB_POS_KEY,
      (raw) => {
        try {
          const parsed = JSON.parse(raw) as FabPosition
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
        } catch {
          /* fallthrough */
        }
        return null
      },
      { x: 12, y: 12 },
    ),
  )

  // 抽屉停靠位置：默认 left；持久化
  const position = useState<DevDebugDockPosition>('dev-debug:position', () =>
    readStorage<DevDebugDockPosition>(
      POSITION_KEY,
      (raw) =>
        VALID_POSITIONS.includes(raw as DevDebugDockPosition)
          ? (raw as DevDebugDockPosition)
          : null,
      'left',
    ),
  )

  // 居中浮窗矩形：默认 520×560 居中（首次使用时由组件按视口计算）；持久化
  const centerRect = useState<CenterRect>('dev-debug:center-rect', () =>
    readStorage<CenterRect>(
      CENTER_RECT_KEY,
      (raw) => {
        try {
          const parsed = JSON.parse(raw) as CenterRect
          if (
            typeof parsed?.x === 'number' &&
            typeof parsed?.y === 'number' &&
            typeof parsed?.w === 'number' &&
            typeof parsed?.h === 'number'
          ) {
            return parsed
          }
        } catch {
          /* fallthrough */
        }
        return null
      },
      { x: -1, y: -1, w: CENTER_DEFAULT.w, h: CENTER_DEFAULT.h },
    ),
  )

  // 面板独立缩放：CSS zoom 系数，0.7~1.5，0.1 步长；持久化
  const fontScale = useState<number>('dev-debug:font-scale', () =>
    readStorage<number>(
      FONT_SCALE_KEY,
      (raw) => {
        const n = Number.parseFloat(raw)
        return Number.isFinite(n) ? n : null
      },
      FONT_SCALE_DEFAULT,
    ),
  )

  function setActiveTab(tab: DevDebugTab) {
    activeTab.value = tab
    writeStorage(TAB_KEY, tab)
  }

  function setPosition(next: DevDebugDockPosition) {
    position.value = next
    writeStorage(POSITION_KEY, next)
  }

  function setCenterRect(rect: CenterRect) {
    const clamped = clampCenterRect(rect)
    centerRect.value = clamped
    writeStorage(CENTER_RECT_KEY, JSON.stringify(clamped))
  }

  /** 把居中浮窗矩形 clamp 在当前视口内 + 强制最小尺寸 */
  function clampCenterRect(rect: CenterRect): CenterRect {
    if (!import.meta.client) return rect
    const w = Math.max(CENTER_MIN.w, Math.min(rect.w, window.innerWidth - 16))
    const h = Math.max(CENTER_MIN.h, Math.min(rect.h, window.innerHeight - 16))
    const maxX = Math.max(8, window.innerWidth - w - 8)
    const maxY = Math.max(8, window.innerHeight - h - 8)
    const x =
      rect.x < 0
        ? Math.round((window.innerWidth - w) / 2)
        : Math.min(Math.max(8, rect.x), maxX)
    const y =
      rect.y < 0
        ? Math.round((window.innerHeight - h) / 2)
        : Math.min(Math.max(8, rect.y), maxY)
    return { x, y, w, h }
  }

  function setFabPosition(pos: FabPosition) {
    const clamped = clampToViewport(pos)
    fabPosition.value = clamped
    writeStorage(FAB_POS_KEY, JSON.stringify(clamped))
  }

  /** clamp 缩放系数到 [MIN, MAX] 并对齐到 0.05 步长，避免浮点累积出现 1.0000000004 */
  function clampFontScale(v: number): number {
    const stepped = Math.round(v / 0.05) * 0.05
    return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(stepped.toFixed(2))))
  }

  function setFontScale(next: number) {
    const prev = fontScale.value
    const v = clampFontScale(next)
    // 居中模式下保持视觉中心不变：CSS zoom 同时缩放 top/left 与 width/height，
    // 直接换 zoom 会让面板视觉位置向右下漂移。按 ratio = prev/next 反向补偿 logical x/y，
    // 使「视觉中心 = (x + w/2) * zoom」在新旧 zoom 下相等
    if (
      v !== prev &&
      position.value === 'center' &&
      centerRect.value.x >= 0 &&
      centerRect.value.y >= 0
    ) {
      const r = centerRect.value
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const ratio = prev / v
      setCenterRect({
        x: cx * ratio - r.w / 2,
        y: cy * ratio - r.h / 2,
        w: r.w,
        h: r.h,
      })
    }
    fontScale.value = v
    writeStorage(FONT_SCALE_KEY, String(v))
  }

  function increaseFontScale() {
    setFontScale(fontScale.value + FONT_SCALE_STEP)
  }

  function decreaseFontScale() {
    setFontScale(fontScale.value - FONT_SCALE_STEP)
  }

  function resetFontScale() {
    setFontScale(FONT_SCALE_DEFAULT)
  }

  /** resize 时重新 clamp，避免视口缩小后 FAB 跑出屏幕 */
  function reclampFabPosition() {
    const clamped = clampToViewport(fabPosition.value)
    if (clamped.x !== fabPosition.value.x || clamped.y !== fabPosition.value.y) {
      fabPosition.value = clamped
      writeStorage(FAB_POS_KEY, JSON.stringify(clamped))
    }
  }

  /** resize 时重新 clamp 居中浮窗，避免视口缩小后窗口跑出屏幕 */
  function reclampCenterRect() {
    if (position.value !== 'center') return
    const clamped = clampCenterRect(centerRect.value)
    if (
      clamped.x !== centerRect.value.x ||
      clamped.y !== centerRect.value.y ||
      clamped.w !== centerRect.value.w ||
      clamped.h !== centerRect.value.h
    ) {
      centerRect.value = clamped
      writeStorage(CENTER_RECT_KEY, JSON.stringify(clamped))
    }
  }

  function open() {
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }
  function toggle() {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    activeTab,
    fabPosition,
    position,
    centerRect,
    fontScale,
    setActiveTab,
    setFabPosition,
    setPosition,
    setCenterRect,
    setFontScale,
    increaseFontScale,
    decreaseFontScale,
    resetFontScale,
    reclampFabPosition,
    reclampCenterRect,
    open,
    close,
    toggle,
  }
}
