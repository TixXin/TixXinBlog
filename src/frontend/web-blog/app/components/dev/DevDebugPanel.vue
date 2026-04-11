<!--
  @file DevDebugPanel.vue
  @description Dev 全局调试面板：左上角可拖拽 FAB + 侧抽屉，分 4 个 tab 展示视口/路由+主题/登录态/环境
  @author TixXin
  @since 2026-04-11

  仅 dev 阶段使用，调用方（app.vue）必须用 <DevOnly> 包裹保证 prod 构建被 tree-shake。
-->

<template>
  <Teleport to="body">
    <!-- 可拖拽 FAB：dev 调试入口 -->
    <button
      class="dev-debug-fab"
      type="button"
      :class="{ 'is-open': isOpen, 'is-dragging': isDragging }"
      :style="fabStyle"
      :aria-label="isOpen ? '关闭 dev 调试面板' : '打开 dev 调试面板'"
      :aria-expanded="isOpen"
      @pointerdown="onFabPointerDown"
      @click="onFabClick"
    >
      <Icon name="lucide:wrench" size="12" />
      <span>DEV</span>
    </button>

    <!-- 遮罩 -->
    <Transition name="dev-debug-overlay">
      <div v-if="isOpen" class="dev-debug-overlay" @click="close" />
    </Transition>

    <!-- 抽屉：根据 position 切换为 left/right/top/bottom 贴边或 center 浮窗；transitionName 同步切换 -->
    <!-- :key="position" 强制 unmount/remount，让切位置真正走「旧位置 leave + 新位置 enter」两段独立动画 -->
    <Transition :name="transitionName">
      <aside
        v-if="isOpen"
        :key="position"
        class="dev-debug-drawer"
        :class="`dev-debug-drawer--${position}`"
        :style="drawerStyle"
        role="dialog"
        aria-label="Dev 调试面板"
      >
        <header
          class="dev-debug-drawer__head"
          :class="{ 'is-draggable': position === 'center' }"
          @pointerdown="onHeaderPointerDown"
        >
          <Icon name="lucide:wrench" size="14" />
          <h2 class="dev-debug-drawer__title">DEV 调试面板</h2>
          <!-- 面板独立缩放：紧凑 +/- + 当前百分比（点击复位） -->
          <div class="dev-debug-zoom-picker" role="group" aria-label="调整面板缩放">
            <button
              type="button"
              class="dev-debug-zoom-btn"
              title="缩小"
              aria-label="缩小"
              :disabled="fontScale <= FONT_SCALE_MIN + 0.001"
              @click="decreaseFontScale"
            >
              <Icon name="lucide:minus" size="12" />
            </button>
            <button
              type="button"
              class="dev-debug-zoom-value"
              title="复位为 100%"
              aria-label="复位为 100%"
              @click="resetFontScale"
            >
              {{ Math.round(fontScale * 100) }}%
            </button>
            <button
              type="button"
              class="dev-debug-zoom-btn"
              title="放大"
              aria-label="放大"
              :disabled="fontScale >= FONT_SCALE_MAX - 0.001"
              @click="increaseFontScale"
            >
              <Icon name="lucide:plus" size="12" />
            </button>
          </div>
          <!-- 停靠位置切换：5 个图标按钮 -->
          <div class="dev-debug-dock-picker" role="group" aria-label="切换停靠位置">
            <button
              v-for="opt in dockOptions"
              :key="opt.value"
              type="button"
              class="dev-debug-dock-btn"
              :class="{ 'is-active': position === opt.value }"
              :title="opt.label"
              :aria-label="opt.label"
              :aria-pressed="position === opt.value"
              @click="setPosition(opt.value)"
            >
              <Icon :name="opt.icon" size="14" />
            </button>
          </div>
          <button
            type="button"
            class="dev-debug-drawer__close"
            aria-label="关闭 (Esc)"
            title="关闭 (Esc)"
            @click="close"
          >
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <nav class="dev-debug-drawer__tabs" role="tablist" aria-label="调试分组">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="dev-debug-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="setActiveTab(tab.id)"
          >
            <Icon :name="tab.icon" size="14" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="dev-debug-drawer__body">
          <!-- 视口 tab -->
          <section v-if="activeTab === 'viewport'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">分辨率</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">
                {{ viewport.w }} × {{ viewport.h }}
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">断点</span>
              <span class="dev-debug-row__value">
                <span class="dev-debug-chip dev-debug-chip--accent">{{ breakpoint }}</span>
                <span class="dev-debug-row__hint">{{ breakpointHint }}</span>
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">DPR</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ dpr }}×</span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">UA 类型</span>
              <span class="dev-debug-row__value">
                <span
                  class="dev-debug-chip"
                  :class="isMobileUA ? 'dev-debug-chip--warn' : 'dev-debug-chip--ok'"
                >
                  {{ isMobileUA ? 'mobile' : 'desktop' }}
                </span>
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">滚动位置</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">
                {{ scrollY }}px
              </span>
            </div>
          </section>

          <!-- 路由 + 主题 tab -->
          <section v-else-if="activeTab === 'route'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">fullPath</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--clickable" @click="copyText(route.fullPath)">
                {{ route.fullPath }}
                <Icon name="lucide:copy" size="11" />
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">name</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">
                {{ String(route.name ?? '—') }}
              </span>
            </div>
            <div v-if="paramsText !== '{}'" class="dev-debug-row">
              <span class="dev-debug-row__label">params</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ paramsText }}</span>
            </div>
            <div v-if="queryText !== '{}'" class="dev-debug-row">
              <span class="dev-debug-row__label">query</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ queryText }}</span>
            </div>

            <div class="dev-debug-divider" />

            <div class="dev-debug-row">
              <span class="dev-debug-row__label">color mode</span>
              <span class="dev-debug-row__value">
                <span class="dev-debug-chip dev-debug-chip--accent">{{ colorMode.value }}</span>
                <span class="dev-debug-row__hint">pref: {{ colorMode.preference }}</span>
              </span>
            </div>
            <div class="dev-debug-actions">
              <button
                v-for="opt in colorModeOptions"
                :key="opt.value"
                type="button"
                class="dev-debug-btn"
                :class="{ 'is-active': colorMode.preference === opt.value }"
                @click="colorMode.preference = opt.value"
              >
                <Icon :name="opt.icon" size="13" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </section>

          <!-- 登录态 tab -->
          <section v-else-if="activeTab === 'auth'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">isLoggedIn</span>
              <span class="dev-debug-row__value">
                <span
                  class="dev-debug-chip"
                  :class="isLoggedIn ? 'dev-debug-chip--ok' : 'dev-debug-chip--muted'"
                >
                  {{ isLoggedIn ? 'true' : 'false' }}
                </span>
              </span>
            </div>
            <template v-if="currentUser">
              <div class="dev-debug-row">
                <span class="dev-debug-row__label">role</span>
                <span class="dev-debug-row__value">
                  <span
                    class="dev-debug-chip"
                    :class="`dev-debug-chip--role-${currentUser.role}`"
                  >
                    {{ currentUser.role }}
                  </span>
                </span>
              </div>
              <div class="dev-debug-row">
                <span class="dev-debug-row__label">nickname</span>
                <span class="dev-debug-row__value dev-debug-row__value--mono">
                  {{ currentUser.nickname }}
                </span>
              </div>
              <div class="dev-debug-row">
                <span class="dev-debug-row__label">email</span>
                <span class="dev-debug-row__value dev-debug-row__value--mono">
                  {{ currentUser.email }}
                </span>
              </div>
              <div class="dev-debug-row">
                <span class="dev-debug-row__label">id</span>
                <span class="dev-debug-row__value dev-debug-row__value--mono">
                  {{ currentUser.id }}
                </span>
              </div>
            </template>

            <div class="dev-debug-divider" />

            <div class="dev-debug-actions dev-debug-actions--column">
              <button
                type="button"
                class="dev-debug-btn"
                :class="{ 'is-active': currentUser?.role === 'owner' }"
                @click="loginAs('owner')"
              >
                <Icon name="lucide:crown" size="13" />
                <span>登录为博主</span>
              </button>
              <button
                type="button"
                class="dev-debug-btn"
                :class="{ 'is-active': currentUser?.role === 'visitor' }"
                @click="loginAs('visitor')"
              >
                <Icon name="lucide:user-round" size="13" />
                <span>登录为访客</span>
              </button>
              <button
                type="button"
                class="dev-debug-btn dev-debug-btn--danger"
                :disabled="!isLoggedIn"
                @click="onLogout"
              >
                <Icon name="lucide:log-out" size="13" />
                <span>退出登录</span>
              </button>
            </div>
          </section>

          <!-- 环境 tab -->
          <section v-else-if="activeTab === 'env'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">mode</span>
              <span class="dev-debug-row__value">
                <span class="dev-debug-chip dev-debug-chip--accent">dev</span>
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">render</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ renderMode }}</span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">Nuxt</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">v{{ nuxtVersion }}</span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">build</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ buildTime }}</span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">UA</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--wrap">
                {{ userAgent }}
              </span>
            </div>
          </section>
        </div>

        <!-- 居中模式：右下角自定义 resize 手柄。原生 resize:both 会和 drawerStyle 的 inline width/height 互相覆盖，必须自管 -->
        <div
          v-if="position === 'center'"
          class="dev-debug-resize-handle"
          aria-label="拖动调整尺寸"
          @pointerdown="onResizePointerDown"
        >
          <Icon name="lucide:move-diagonal-2" size="12" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { mockOwnerUser, mockVisitorUser } from '~/features/auth/mock'
import type { DevDebugTab, DevDebugDockPosition } from '~/composables/useDevDebugPanel'
import { FONT_SCALE_MIN, FONT_SCALE_MAX } from '~/composables/useDevDebugPanel'

const {
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
  increaseFontScale,
  decreaseFontScale,
  resetFontScale,
  reclampFabPosition,
  reclampCenterRect,
  toggle,
  close,
} = useDevDebugPanel()

const { currentUser, isLoggedIn, setUser, logout } = useCurrentUser()
const { success, info } = useToast()
const route = useRoute()
const colorMode = useColorMode()
const runtimeConfig = useRuntimeConfig()

// ---- tab 元数据 ----
const tabs: { id: DevDebugTab; label: string; icon: string }[] = [
  { id: 'viewport', label: '视口', icon: 'lucide:monitor' },
  { id: 'route', label: '路由', icon: 'lucide:route' },
  { id: 'auth', label: '账号', icon: 'lucide:user-round' },
  { id: 'env', label: '环境', icon: 'lucide:server' },
]

// ---- 停靠位置切换 ----
const dockOptions: { value: DevDebugDockPosition; label: string; icon: string }[] = [
  { value: 'left', label: '左侧停靠', icon: 'lucide:panel-left' },
  { value: 'right', label: '右侧停靠', icon: 'lucide:panel-right' },
  { value: 'top', label: '顶部停靠', icon: 'lucide:panel-top' },
  { value: 'bottom', label: '底部停靠', icon: 'lucide:panel-bottom' },
  { value: 'center', label: '居中浮窗', icon: 'lucide:square' },
]

/** 不同停靠位置使用不同 transition：边贴边滑入，居中态 fade+scale */
const transitionName = computed(() => {
  switch (position.value) {
    case 'left': return 'dev-debug-drawer-left'
    case 'right': return 'dev-debug-drawer-right'
    case 'top': return 'dev-debug-drawer-top'
    case 'bottom': return 'dev-debug-drawer-bottom'
    case 'center': return 'dev-debug-drawer-center'
    default: return 'dev-debug-drawer-left'
  }
})

/**
 * 抽屉 inline style：始终注入 zoom（独立缩放系数），居中态额外注入 top/left/width/height
 * 用 CSS zoom 而非 transform: scale —— zoom 真实改变 layout box，子元素的 fixed 计算与
 * pointer 命中区都自动跟随，避免左右贴边模式与视觉错位
 */
const drawerStyle = computed(() => {
  const base: Record<string, string> = { zoom: String(fontScale.value) }
  if (position.value === 'center') {
    const r = centerRect.value
    base.top = `${r.y}px`
    base.left = `${r.x}px`
    base.width = `${r.w}px`
    base.height = `${r.h}px`
  }
  return base
})

// ---- FAB 位置 + 拖拽 ----
const fabStyle = computed(() => ({
  top: `${fabPosition.value.y}px`,
  left: `${fabPosition.value.x}px`,
}))

const isDragging = ref(false)
let dragOffset = { x: 0, y: 0 }
let movedDistance = 0

function onFabPointerDown(e: PointerEvent) {
  if (isOpen.value) return // 抽屉打开时禁止拖动
  if (e.button !== 0) return // 仅左键
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  dragOffset = {
    x: e.clientX - fabPosition.value.x,
    y: e.clientY - fabPosition.value.y,
  }
  movedDistance = 0
  isDragging.value = true
  window.addEventListener('pointermove', onFabPointerMove)
  window.addEventListener('pointerup', onFabPointerUp, { once: true })
}

function onFabPointerMove(e: PointerEvent) {
  movedDistance += Math.abs(e.movementX) + Math.abs(e.movementY)
  fabPosition.value = {
    x: e.clientX - dragOffset.x,
    y: e.clientY - dragOffset.y,
  }
}

function onFabPointerUp() {
  window.removeEventListener('pointermove', onFabPointerMove)
  isDragging.value = false
  // 持久化 + clamp
  setFabPosition(fabPosition.value)
}

function onFabClick() {
  // 拖动距离 > 5px 视为拖动而非点击，不触发 toggle
  if (movedDistance > 5) {
    movedDistance = 0
    return
  }
  toggle()
}

// ---- 居中模式：header 拖拽 ----
// 用 down 时刻的快照 + delta 而非 offset：缩放后屏幕 delta 要除以 zoom 才是逻辑 delta
let headerDragStart = { clientX: 0, clientY: 0, x: 0, y: 0 }

function onHeaderPointerDown(e: PointerEvent) {
  if (position.value !== 'center') return
  // 忽略点击在停靠按钮 / 关闭按钮上的事件
  const target = e.target as HTMLElement
  if (target.closest('button')) return
  if (e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  headerDragStart = {
    clientX: e.clientX,
    clientY: e.clientY,
    x: centerRect.value.x,
    y: centerRect.value.y,
  }
  window.addEventListener('pointermove', onHeaderPointerMove)
  window.addEventListener('pointerup', onHeaderPointerUp, { once: true })
}

function onHeaderPointerMove(e: PointerEvent) {
  const scale = fontScale.value || 1
  centerRect.value = {
    ...centerRect.value,
    x: headerDragStart.x + (e.clientX - headerDragStart.clientX) / scale,
    y: headerDragStart.y + (e.clientY - headerDragStart.clientY) / scale,
  }
}

function onHeaderPointerUp() {
  window.removeEventListener('pointermove', onHeaderPointerMove)
  // clamp + 持久化
  setCenterRect(centerRect.value)
}

// ---- 居中模式：自定义右下角 resize 手柄 ----
// 不用原生 `resize: both` —— 它会写元素的 inline width/height，与 :style="drawerStyle"
// 同步绑定的 width/height 互相覆盖，导致拖动时尺寸"缓慢回弹"。改为手写 pointer drag 走 state 单一数据源
let resizeStart = { x: 0, y: 0, w: 0, h: 0 }

function onResizePointerDown(e: PointerEvent) {
  if (position.value !== 'center') return
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  resizeStart = {
    x: e.clientX,
    y: e.clientY,
    w: centerRect.value.w,
    h: centerRect.value.h,
  }
  window.addEventListener('pointermove', onResizePointerMove)
  window.addEventListener('pointerup', onResizePointerUp, { once: true })
}

function onResizePointerMove(e: PointerEvent) {
  // 拖动时即时 clamp 最小值，避免视觉上缩到 0 后 pointerup 才回弹
  // 缩放后屏幕 delta 要除以 zoom 才是逻辑 delta，让 1:1 视觉拖拽手感不变
  const scale = fontScale.value || 1
  const nextW = Math.max(360, resizeStart.w + (e.clientX - resizeStart.x) / scale)
  const nextH = Math.max(320, resizeStart.h + (e.clientY - resizeStart.y) / scale)
  centerRect.value = { ...centerRect.value, w: nextW, h: nextH }
}

function onResizePointerUp() {
  window.removeEventListener('pointermove', onResizePointerMove)
  // pointerup 时再 clamp + 持久化，避免拖动过程频繁写 localStorage
  setCenterRect(centerRect.value)
}

// 切换到 center 时初始化矩形（首次 x/y = -1 时居中放置）
watch(
  [position, isOpen],
  ([pos, open]) => {
    if (open && pos === 'center') {
      // 首次进入 center 模式：x/y < 0 表示需要按当前视口居中
      if (centerRect.value.x < 0 || centerRect.value.y < 0) {
        setCenterRect(centerRect.value) // clampCenterRect 会把负数翻译为视口中心
      }
    }
  },
  { immediate: false },
)

// ---- 键盘快捷键：Esc 关闭、Ctrl/Cmd+Shift+D 切换 ----
function onKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Shift + D：全局开关
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault()
    toggle()
    return
  }
  // Esc：仅在抽屉开启时关闭
  if (e.key === 'Escape' && isOpen.value) {
    // 避免与其它 Esc 监听器冲突：只在没人调用 stopPropagation 时拦截
    e.preventDefault()
    close()
  }
}

// ---- 视口 tab 数据 ----
const viewport = ref({ w: 0, h: 0 })
const dpr = ref(1)
const isMobileUA = ref(false)
const scrollY = ref(0)

function syncViewport() {
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
  dpr.value = window.devicePixelRatio
}
function syncScroll() {
  scrollY.value = Math.round(window.scrollY)
}

const breakpoint = computed(() => {
  const w = viewport.value.w
  if (w >= 1280) return 'xl'
  if (w >= 1024) return 'lg'
  if (w >= 768) return 'md'
  if (w >= 640) return 'sm'
  if (w >= 480) return 'xs'
  return '<xs'
})

const breakpointHint = computed(() => {
  const w = viewport.value.w
  if (w >= 1280) return '≥1280'
  if (w >= 1024) return '1024–1279'
  if (w >= 768) return '768–1023'
  if (w >= 640) return '640–767'
  if (w >= 480) return '480–639'
  return '<480'
})

// ---- 路由 + 主题 tab 数据 ----
const paramsText = computed(() => JSON.stringify(route.params))
const queryText = computed(() => JSON.stringify(route.query))

const colorModeOptions = [
  { value: 'light', label: '亮', icon: 'lucide:sun' },
  { value: 'dark', label: '暗', icon: 'lucide:moon' },
  { value: 'system', label: '跟随', icon: 'lucide:monitor-cog' },
] as const

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    success('已复制到剪贴板')
  } catch {
    info('复制失败：浏览器拒绝了剪贴板访问')
  }
}

// ---- 登录态 tab 操作 ----
function loginAs(role: 'owner' | 'visitor') {
  setUser({ ...(role === 'owner' ? mockOwnerUser : mockVisitorUser) })
  success(`已切换为${role === 'owner' ? '博主' : '访客'}`)
}
function onLogout() {
  logout()
  info('已退出登录')
}

// ---- 环境 tab 数据 ----
const renderMode = ref<'client' | 'server'>('server')
const userAgent = ref('—')
const nuxtVersion = (runtimeConfig.public as { nuxtVersion?: string }).nuxtVersion ?? '—'
const buildTime = (runtimeConfig.public as { buildTime?: string }).buildTime ?? '—'

// ---- 生命周期：挂载 DOM 监听 ----
onMounted(() => {
  syncViewport()
  syncScroll()
  isMobileUA.value = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  renderMode.value = 'client'
  userAgent.value = navigator.userAgent

  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('scroll', syncScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

function onResize() {
  syncViewport()
  reclampFabPosition()
  reclampCenterRect()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', syncScroll)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onFabPointerMove)
  window.removeEventListener('pointermove', onHeaderPointerMove)
  window.removeEventListener('pointermove', onResizePointerMove)
})
</script>

<style lang="scss" scoped>
/* ==================== FAB ==================== */
.dev-debug-fab {
  position: fixed;
  z-index: 9998;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.55rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-full;
  background: var(--accent-alpha-5, rgba(99, 102, 241, 0.08));
  color: var(--accent);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: grab;
  user-select: none;
  touch-action: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  }

  &.is-open {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
    border-style: solid;
  }

  &.is-dragging {
    cursor: grabbing;
    transform: scale(0.95);
    transition: none;
  }
}

/* ==================== 遮罩 ==================== */
.dev-debug-overlay {
  position: fixed;
  inset: 0;
  z-index: 9997;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

/* ==================== 抽屉（基类） ==================== */
.dev-debug-drawer {
  position: fixed;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  overflow: hidden;
}

/* 左侧停靠 */
.dev-debug-drawer--left {
  top: 0;
  left: 0;
  bottom: 0;
  width: min(320px, 90vw);
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
}

/* 右侧停靠 */
.dev-debug-drawer--right {
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 90vw);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
}

/* 顶部停靠 */
.dev-debug-drawer--top {
  top: 0;
  left: 0;
  right: 0;
  height: min(320px, 80vh);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 底部停靠 */
.dev-debug-drawer--bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: min(320px, 80vh);
  border-top: 1px solid var(--border);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
}

/* 居中浮窗：可拖拽 + 自定义 resize 手柄（不用原生 resize:both，避免与 :style inline width/height 互相覆盖） */
.dev-debug-drawer--center {
  /* top/left/width/height 由 :style 注入 */
  border: 1px solid var(--border);
  border-radius: $radius-md;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

/* 自定义右下角 resize 手柄 */
.dev-debug-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.125rem;
  color: var(--text-faint);
  cursor: nwse-resize;
  user-select: none;
  touch-action: none;
  transition: color 0.18s ease;

  &:hover {
    color: var(--accent);
  }
}

.dev-debug-drawer__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem 0.75rem 1rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent);
  flex-shrink: 0;
  user-select: none;

  &.is-draggable {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

/* ==================== 面板独立缩放 ==================== */
.dev-debug-zoom-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  margin-right: 0.25rem;
}

.dev-debug-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  border-radius: $radius-sm;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.dev-debug-zoom-value {
  min-width: 2.4rem;
  height: 1.375rem;
  padding: 0 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.625rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  border-radius: $radius-sm;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;

  &:hover {
    background: var(--surface-3);
    color: var(--accent);
  }
}

/* ==================== 停靠位置切换 ==================== */
.dev-debug-dock-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  margin-right: 0.25rem;
}

.dev-debug-dock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  border-radius: $radius-sm;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;

  &:hover {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &.is-active {
    color: var(--accent);
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
  }
}

.dev-debug-drawer__title {
  flex: 1;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

.dev-debug-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

/* ==================== Tabs ==================== */
.dev-debug-drawer__tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--border-soft);
  background: var(--surface-1);
}

.dev-debug-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
}

/* ==================== Body ==================== */
.dev-debug-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem 1rem;
}

.dev-debug-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dev-debug-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.375rem 0;
  border-bottom: 1px dashed var(--border-soft);
  font-size: 0.75rem;

  &:last-of-type {
    border-bottom: none;
  }
}

.dev-debug-row__label {
  flex-shrink: 0;
  width: 5rem;
  color: var(--text-soft);
  font-weight: 600;
}

.dev-debug-row__value {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: var(--text-main);
  word-break: break-all;
}

.dev-debug-row__value--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.6875rem;
}

.dev-debug-row__value--wrap {
  white-space: normal;
  line-height: 1.4;
}

.dev-debug-row__value--clickable {
  cursor: pointer;
  border-radius: $radius-sm;
  padding: 0.125rem 0.25rem;
  margin: -0.125rem -0.25rem;
  transition: background 0.18s ease;

  &:hover {
    background: var(--surface-2);
    color: var(--accent);
  }
}

.dev-debug-row__hint {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.dev-debug-divider {
  height: 1px;
  background: var(--border);
  margin: 0.5rem 0;
}

/* ==================== Chips ==================== */
.dev-debug-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.375rem;
  border-radius: $radius-full;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: lowercase;

  &--accent {
    background: rgba(99, 102, 241, 0.14);
    color: var(--accent);
  }
  &--ok {
    background: rgba(34, 197, 94, 0.14);
    color: rgb(22, 163, 74);
  }
  &--warn {
    background: rgba(234, 179, 8, 0.18);
    color: rgb(161, 98, 7);
  }
  &--muted {
    background: var(--surface-2);
    color: var(--text-soft);
  }
  &--role-owner {
    background: rgba(99, 102, 241, 0.14);
    color: var(--accent);
  }
  &--role-visitor {
    background: rgba(34, 197, 94, 0.14);
    color: rgb(22, 163, 74);
  }
}

/* ==================== 操作按钮 ==================== */
.dev-debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.dev-debug-actions--column {
  flex-direction: column;

  .dev-debug-btn {
    width: 100%;
    justify-content: center;
  }
}

.dev-debug-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;

  &:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.is-active {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.18));
    border-color: var(--accent);
    color: var(--accent);
  }

  &--danger:hover:not(:disabled) {
    border-color: rgb(239, 68, 68);
    color: rgb(239, 68, 68);
  }
}

/* ==================== 进出动画 ==================== */
.dev-debug-overlay-enter-active,
.dev-debug-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.dev-debug-overlay-enter-from,
.dev-debug-overlay-leave-to {
  opacity: 0;
}

/* 左侧停靠：从左滑入 */
.dev-debug-drawer-left-enter-active,
.dev-debug-drawer-left-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.dev-debug-drawer-left-enter-from,
.dev-debug-drawer-left-leave-to {
  transform: translateX(-100%);
}

/* 右侧停靠：从右滑入 */
.dev-debug-drawer-right-enter-active,
.dev-debug-drawer-right-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.dev-debug-drawer-right-enter-from,
.dev-debug-drawer-right-leave-to {
  transform: translateX(100%);
}

/* 顶部停靠：从上滑入 */
.dev-debug-drawer-top-enter-active,
.dev-debug-drawer-top-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.dev-debug-drawer-top-enter-from,
.dev-debug-drawer-top-leave-to {
  transform: translateY(-100%);
}

/* 底部停靠：从下滑入 */
.dev-debug-drawer-bottom-enter-active,
.dev-debug-drawer-bottom-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.dev-debug-drawer-bottom-enter-from,
.dev-debug-drawer-bottom-leave-to {
  transform: translateY(100%);
}

/* 居中浮窗：opacity + scale，更快更紧凑 */
.dev-debug-drawer-center-enter-active,
.dev-debug-drawer-center-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dev-debug-drawer-center-enter-from,
.dev-debug-drawer-center-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
</style>
