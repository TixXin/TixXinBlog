/**
 * @file useDevDebugPanel.ts
 * @description Dev 调试面板共享状态：抽屉开关、激活 tab、FAB 拖拽位置（仅 dev 使用，调用方应被 DevOnly 包裹）
 * @author TixXin
 * @since 2026-04-11
 */

export type DevDebugTab = 'viewport' | 'route' | 'auth' | 'env'

export interface FabPosition {
  x: number
  y: number
}

const FAB_POS_KEY = 'dev-debug:fab-pos'
const TAB_KEY = 'dev-debug:active-tab'
const VALID_TABS: DevDebugTab[] = ['viewport', 'route', 'auth', 'env']

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

  function setActiveTab(tab: DevDebugTab) {
    activeTab.value = tab
    writeStorage(TAB_KEY, tab)
  }

  function setFabPosition(pos: FabPosition) {
    const clamped = clampToViewport(pos)
    fabPosition.value = clamped
    writeStorage(FAB_POS_KEY, JSON.stringify(clamped))
  }

  /** resize 时重新 clamp，避免视口缩小后 FAB 跑出屏幕 */
  function reclampFabPosition() {
    const clamped = clampToViewport(fabPosition.value)
    if (clamped.x !== fabPosition.value.x || clamped.y !== fabPosition.value.y) {
      fabPosition.value = clamped
      writeStorage(FAB_POS_KEY, JSON.stringify(clamped))
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
    setActiveTab,
    setFabPosition,
    reclampFabPosition,
    open,
    close,
    toggle,
  }
}
