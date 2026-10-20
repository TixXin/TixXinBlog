<!--
  @file DevDebugPanel.vue
  @description Dev 全局调试面板：左上角可拖拽 FAB + 侧抽屉，分 5 个 tab 展示视口/路由+主题/登录态/界面预览/环境
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
      :class="{ 'is-open': isOpen, 'is-dragging': isDragging, 'is-hidden': fabHidden }"
      :style="fabStyle"
      :inert="fabHidden || undefined"
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
          :class="{ 'is-draggable': position === 'center', 'is-narrow': position === 'left' || position === 'right' }"
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
              <span class="dev-debug-row__value dev-debug-row__value--mono"> {{ viewport.w }} × {{ viewport.h }} </span>
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
                <span class="dev-debug-chip" :class="isMobileUA ? 'dev-debug-chip--warn' : 'dev-debug-chip--ok'">
                  {{ isMobileUA ? 'mobile' : 'desktop' }}
                </span>
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">滚动位置</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono"> {{ scrollY }}px </span>
            </div>

            <div class="dev-debug-divider" />

            <p class="dev-debug-note">
              网页无法改变当前窗口尺寸：点预设会按该视口尺寸打开当前页面的预览窗口，再点其他尺寸直接调整同一窗口；在预览窗口里点则调整自身。超出屏幕的尺寸会被浏览器截到屏幕大小。
            </p>
            <div class="dev-debug-viewports">
              <button
                v-for="preset in viewportPresets"
                :key="preset.label"
                type="button"
                class="dev-debug-btn"
                :class="{ 'is-active': viewport.w === preset.w && viewport.h === preset.h }"
                @click="openViewport(preset.w, preset.h)"
              >
                <Icon :name="preset.icon" size="13" />
                <span>{{ preset.label }}</span>
                <span class="dev-debug-viewports__size">{{ preset.w }}×{{ preset.h }}</span>
              </button>
            </div>
            <form class="dev-debug-viewport-custom" @submit.prevent="openViewport(customViewport.w, customViewport.h)">
              <label>
                <span class="sr-only">宽度</span>
                <input v-model.number="customViewport.w" type="number" min="240" max="3840" required />
              </label>
              <span aria-hidden="true">×</span>
              <label>
                <span class="sr-only">高度</span>
                <input v-model.number="customViewport.h" type="number" min="240" max="2160" required />
              </label>
              <button type="submit" class="dev-debug-btn">
                <Icon name="lucide:app-window" size="13" />
                <span>打开</span>
              </button>
            </form>
          </section>

          <!-- 路由 + 主题 tab -->
          <section v-else-if="activeTab === 'route'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">fullPath</span>
              <span
                class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--clickable"
                @click="copyText(route.fullPath)"
              >
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
                <span class="dev-debug-chip" :class="isLoggedIn ? 'dev-debug-chip--ok' : 'dev-debug-chip--muted'">
                  {{ isLoggedIn ? 'true' : 'false' }}
                </span>
              </span>
            </div>
            <template v-if="currentUser">
              <div class="dev-debug-row">
                <span class="dev-debug-row__label">role</span>
                <span class="dev-debug-row__value">
                  <span class="dev-debug-chip" :class="`dev-debug-chip--role-${currentUser.role}`">
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

          <!-- 预览 tab：依赖站点状态的界面（见 useDevPreview），只改前端显示 -->
          <section v-else-if="activeTab === 'preview'" class="dev-debug-section">
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">当前预览</span>
              <span class="dev-debug-row__value">
                <span class="dev-debug-chip" :class="activePreview ? 'dev-debug-chip--warn' : 'dev-debug-chip--muted'">
                  {{ activePreview || '无' }}
                </span>
              </span>
            </div>
            <p class="dev-debug-note">只改变前端显示：提交照常校验，但不请求接口、不创建账号。</p>
            <div v-for="group in previewGroups" :key="group.label" class="dev-debug-group">
              <p class="dev-debug-group__title">{{ group.label }}</p>
              <div class="dev-debug-actions dev-debug-actions--column">
                <button
                  v-for="item in group.items"
                  :key="item.label"
                  type="button"
                  class="dev-debug-btn"
                  :class="{ 'is-active': isPreviewActive(item) }"
                  @click="openPreview(item)"
                >
                  <Icon :name="item.icon" size="13" />
                  <span>{{ item.label }}</span>
                </button>
              </div>
            </div>
            <div class="dev-debug-actions">
              <button type="button" class="dev-debug-btn" :disabled="!activePreview" @click="exitPreview">
                <Icon name="lucide:eye-off" size="13" />
                <span>退出预览</span>
              </button>
            </div>

            <div class="dev-debug-divider" />

            <p class="dev-debug-note">真实走完初始化（空库、自动登录）时，在终端启动初始化沙盒：</p>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">沙盒</span>
              <span
                class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--clickable"
                @click="copyText('corepack pnpm dev:setup')"
              >
                corepack pnpm dev:setup
                <Icon name="lucide:copy" size="11" />
              </span>
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
              <span class="dev-debug-row__label">界面语言</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ locale }}</span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">数据源</span>
              <span class="dev-debug-row__value">
                <span class="dev-debug-chip" :class="usesMock ? 'dev-debug-chip--warn' : 'dev-debug-chip--ok'">
                  {{ usesMock ? '含 Mock' : '真实 API' }}
                </span>
              </span>
            </div>
            <div class="dev-debug-row">
              <span class="dev-debug-row__label">API</span>
              <span class="dev-debug-row__value dev-debug-row__value--mono">{{ apiBaseUrl }}</span>
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

const { currentUser, isLoggedIn, logout } = useCurrentUser()
const { success, info } = useToast()
const route = useRoute()
const colorMode = useColorMode()
const runtimeConfig = useRuntimeConfig()

// ---- tab 元数据 ----
const tabs: { id: DevDebugTab; label: string; icon: string }[] = [
  { id: 'viewport', label: '视口', icon: 'lucide:monitor' },
  { id: 'route', label: '路由', icon: 'lucide:route' },
  { id: 'auth', label: '账号', icon: 'lucide:user-round' },
  { id: 'preview', label: '预览', icon: 'lucide:eye' },
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
    case 'left':
      return 'dev-debug-drawer-left'
    case 'right':
      return 'dev-debug-drawer-right'
    case 'top':
      return 'dev-debug-drawer-top'
    case 'bottom':
      return 'dev-debug-drawer-bottom'
    case 'center':
      return 'dev-debug-drawer-center'
    default:
      return 'dev-debug-drawer-left'
  }
})

/**
 * 抽屉 inline style：始终注入 zoom（独立缩放系数）+ --dev-debug-zoom CSS 变量
 * 居中态额外注入 top/left/width/height
 * 用 CSS zoom 而非 transform: scale —— zoom 真实改变 layout box，子元素的 fixed 计算与
 * pointer 命中区都自动跟随，避免左右贴边模式与视觉错位
 * --dev-debug-zoom 供 dock 模式 SCSS 用 calc(100vh / var) 反向补偿 zoom 对尺寸的双倍放大
 */
const drawerStyle = computed(() => {
  const scale = String(fontScale.value)
  const base: Record<string, string> = {
    zoom: scale,
    '--dev-debug-zoom': scale,
  }
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

// 向下滚动时收起 FAB，避免遮挡正文；向上滚动、回到顶部、面板打开或拖动中保持可见
const fabScrollHidden = ref(false)
watch(scrollY, (y, prev) => {
  if (Math.abs(y - prev) < 8) return
  fabScrollHidden.value = y > 80 && y > prev
})
const fabHidden = computed(() => fabScrollHidden.value && !isOpen.value && !isDragging.value)

// ---- 视口预设：按内容区尺寸打开（或调整）同名预览窗口 ----
// 浏览器不允许脚本改变用户自己打开的窗口尺寸，但脚本用 window.open 打开的弹出窗口可以 resizeTo。
const VIEWPORT_WINDOW = 'tixxin-dev-viewport'
const viewportPresets = [
  { label: '小屏手机', w: 375, h: 667, icon: 'lucide:smartphone' },
  { label: '手机', w: 393, h: 852, icon: 'lucide:smartphone' },
  { label: '平板竖屏', w: 768, h: 1024, icon: 'lucide:tablet' },
  { label: '平板横屏', w: 1024, h: 768, icon: 'lucide:tablet' },
  { label: '笔记本', w: 1366, h: 768, icon: 'lucide:laptop' },
  { label: '桌面', w: 1440, h: 900, icon: 'lucide:monitor' },
  { label: '全高清', w: 1920, h: 1080, icon: 'lucide:monitor' },
] as const
const customViewport = ref({ w: 1280, h: 800 })

/** resizeTo 设置的是窗口外框，加上边框与工具栏的差值，使内容区恰好为目标尺寸 */
function fitViewport(target: Window, w: number, h: number) {
  target.resizeTo(w + target.outerWidth - target.innerWidth, h + target.outerHeight - target.innerHeight)
}

function openViewport(w: number, h: number) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 240 || h < 240) return
  // 已在预览窗口内：直接调整自身
  if (window.name === VIEWPORT_WINDOW) {
    fitViewport(window, w, h)
    return
  }
  const target = window.open(window.location.href, VIEWPORT_WINDOW, `popup,width=${w},height=${h}`)
  if (!target) {
    info('预览窗口被浏览器拦截，请允许本站弹出窗口后重试')
    return
  }
  target.focus()
  // 同名窗口已存在时浏览器只导航、不改尺寸；稍后按内容区尺寸校正一次
  window.setTimeout(() => {
    try {
      if (!target.closed && (target.innerWidth !== w || target.innerHeight !== h)) fitViewport(target, w, h)
    } catch {
      // 窗口仍在导航或已被关闭时跳过
    }
  }, 600)
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
const { open: openRealLogin } = useLoginDrawer()
async function loginAs(role: 'owner' | 'visitor') {
  if (role === 'owner') openRealLogin('login')
  else await logout()
}
async function onLogout() {
  try {
    await logout()
    info('已退出登录')
  } catch {
    info('退出失败，请重试')
  }
}

// ---- 预览 tab 数据：地址参数与 useDevPreview 约定一致 ----
interface PreviewEntry {
  label: string
  icon: string
  path: string
  query: Record<string, string>
}
const PREVIEW_KEYS = ['preview', 'preview-submit']
const previewGroups: { label: string; items: PreviewEntry[] }[] = [
  {
    label: '初始化页 /setup',
    items: [
      { label: '表单', icon: 'lucide:file-pen', path: '/setup', query: { preview: 'form' } },
      {
        label: '表单（模拟提交失败）',
        icon: 'lucide:file-x',
        path: '/setup',
        query: { preview: 'form', 'preview-submit': 'fail' },
      },
      { label: '已完成初始化', icon: 'lucide:circle-check', path: '/setup', query: { preview: 'closed' } },
      { label: '状态读取失败', icon: 'lucide:circle-alert', path: '/setup', query: { preview: 'error' } },
    ],
  },
  {
    label: '未初始化引导',
    items: [
      { label: '首页提示', icon: 'lucide:house', path: '/', query: { preview: 'setup-pending' } },
      { label: '登录页引导', icon: 'lucide:log-in', path: '/admin/login', query: { preview: 'setup-pending' } },
    ],
  },
]
const activePreview = computed(() =>
  PREVIEW_KEYS.map((key) => route.query[key])
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .join(' · '),
)
function isPreviewActive(item: PreviewEntry) {
  return route.path === item.path && PREVIEW_KEYS.every((key) => (route.query[key] ?? undefined) === item.query[key])
}
async function openPreview(item: PreviewEntry) {
  const rest = Object.fromEntries(Object.entries(route.query).filter(([key]) => !PREVIEW_KEYS.includes(key)))
  await navigateTo({ path: item.path, query: item.path === route.path ? { ...rest, ...item.query } : item.query })
}
async function exitPreview() {
  const rest = Object.fromEntries(Object.entries(route.query).filter(([key]) => !PREVIEW_KEYS.includes(key)))
  await navigateTo({ path: route.path, query: rest, hash: route.hash })
}

// ---- 环境 tab 数据 ----
const { locale } = useI18n()
const publicConfig = runtimeConfig.public as { apiBaseUrl?: string; useMockRepo?: boolean; postUseMockRepo?: boolean }
const apiBaseUrl = publicConfig.apiBaseUrl ?? '—'
const usesMock = publicConfig.useMockRepo === true || publicConfig.postUseMockRepo === true
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
  cursor: var(--interaction-cursor, grab);
  user-select: none;
  touch-action: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

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
    cursor: var(--interaction-cursor, grabbing);
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

/* 贴边停靠：用 calc(100vh|100vw / var(--dev-debug-zoom)) 反向补偿 zoom，
   避免 zoom 同时缩放 top/bottom 锚点导致面板溢出视口 */

/* 左侧停靠 */
.dev-debug-drawer--left {
  top: 0;
  left: 0;
  width: min(320px, calc(90vw / var(--dev-debug-zoom, 1)));
  height: calc(100vh / var(--dev-debug-zoom, 1));
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
}

/* 右侧停靠 */
.dev-debug-drawer--right {
  top: 0;
  right: 0;
  width: min(320px, calc(90vw / var(--dev-debug-zoom, 1)));
  height: calc(100vh / var(--dev-debug-zoom, 1));
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
}

/* 顶部停靠 */
.dev-debug-drawer--top {
  top: 0;
  left: 0;
  width: calc(100vw / var(--dev-debug-zoom, 1));
  height: min(320px, calc(80vh / var(--dev-debug-zoom, 1)));
  border-bottom: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 底部停靠 */
.dev-debug-drawer--bottom {
  bottom: 0;
  left: 0;
  width: calc(100vw / var(--dev-debug-zoom, 1));
  height: min(320px, calc(80vh / var(--dev-debug-zoom, 1)));
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
  cursor: var(--interaction-cursor, nwse-resize);
  user-select: none;
  touch-action: none;
  transition: color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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

  // 左右停靠时抽屉只有约 320px：标题独占一行，缩放、停靠与关闭按钮换到第二行，避免标题被挤成多行
  &.is-narrow {
    flex-wrap: wrap;
    row-gap: 0.5rem;

    // 扣掉前置图标（14px）与间距，让图标与标题同在第一行
    .dev-debug-drawer__title {
      flex-basis: calc(100% - 14px - 0.5rem);
    }
  }

  &.is-draggable {
    cursor: var(--interaction-cursor, grab);

    &:active {
      cursor: var(--interaction-cursor, grabbing);
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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &:disabled {
    opacity: 0.35;
    cursor: var(--interaction-cursor, not-allowed);
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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  white-space: nowrap;
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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.2s ease,
    color 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

/* ==================== 预览 tab ==================== */
.dev-debug-note {
  margin: 0.25rem 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}
.dev-debug-group {
  margin-bottom: 0.75rem;
}
.dev-debug-group__title {
  margin: 0 0 0.375rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

/* ==================== 视口预设 ==================== */
.dev-debug-viewports {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.375rem;
}
.dev-debug-viewports .dev-debug-btn {
  justify-content: flex-start;
}
.dev-debug-viewports__size {
  margin-left: auto;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 500;
}
.dev-debug-viewport-custom {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;

  input {
    width: 5rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: $radius-sm;
    background: var(--surface-2);
    color: var(--text-main);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }
}

/* ==================== Tabs ==================== */
.dev-debug-drawer__tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
  cursor: var(--interaction-cursor, pointer);
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  border-radius: $radius-sm;
  padding: 0.125rem 0.25rem;
  margin: -0.125rem -0.25rem;
  transition: background 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-overlay-enter-from,
.dev-debug-overlay-leave-to {
  opacity: 0;
}

/* 左侧停靠：从左滑入 */
.dev-debug-drawer-left-enter-active,
.dev-debug-drawer-left-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-drawer-left-enter-from,
.dev-debug-drawer-left-leave-to {
  transform: translateX(-100%);
}

/* 右侧停靠：从右滑入 */
.dev-debug-drawer-right-enter-active,
.dev-debug-drawer-right-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-drawer-right-enter-from,
.dev-debug-drawer-right-leave-to {
  transform: translateX(100%);
}

/* 顶部停靠：从上滑入 */
.dev-debug-drawer-top-enter-active,
.dev-debug-drawer-top-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-drawer-top-enter-from,
.dev-debug-drawer-top-leave-to {
  transform: translateY(-100%);
}

/* 底部停靠：从下滑入 */
.dev-debug-drawer-bottom-enter-active,
.dev-debug-drawer-bottom-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-drawer-center-enter-from,
.dev-debug-drawer-center-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
</style>
