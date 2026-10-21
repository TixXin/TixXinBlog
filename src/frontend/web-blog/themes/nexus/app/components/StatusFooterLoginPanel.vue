<!--
  @file StatusFooterLoginPanel.vue
  @description Nexus 底栏内嵌登录面板：异形 SVG 遮罩与模态焦点管理
  @author TixXin
  @since 2026-04-21
-->

<template>
  <Transition name="nexus-login-panel" @after-leave="clearLoginShape">
    <div
      v-if="isOpen && !preferModal"
      ref="loginPanelRef"
      class="nexus-bar__login-panel"
      :class="{ 'is-shape-ready': loginShape }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="loginTitleId"
      tabindex="-1"
    >
      <svg
        v-if="loginShape"
        class="nexus-bar__login-surface"
        :viewBox="`0 0 ${loginShape.width} ${loginShape.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path :d="loginShape.path" />
      </svg>
      <div class="nexus-bar__login-content">
        <AuthPanel :title-id="loginTitleId" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { createLoginPanelShape } from '~/utils/loginPanelShape'

const props = defineProps<{
  isOpen: boolean
  preferModal: boolean
  barEl: HTMLElement | null
  avatarEl: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loginPanelRef = ref<HTMLElement | null>(null)
const loginTitleId = 'nexus-login-panel-title'

// 内嵌登录面板按模态对话框管理：打开聚焦首个输入框、Tab 约束在面板内、Esc 关闭并归还焦点
useModalFocus(
  computed(() => props.isOpen && !props.preferModal),
  loginPanelRef,
  { close: () => emit('close'), initialFocus: () => loginPanelRef.value?.querySelector('input') ?? null },
)

const loginShape = shallowRef<ReturnType<typeof createLoginPanelShape>>(null)
let shapeObserver: ResizeObserver | undefined
let shapeFrame = 0

function measureLoginShape() {
  const panel = loginPanelRef.value
  const avatar = props.avatarEl
  const bar = props.barEl
  if (!panel || !avatar || !bar) return
  const panelBox = panel.getBoundingClientRect()
  const avatarBox = avatar.getBoundingClientRect()
  const drawerGap = Math.max(0, bar.getBoundingClientRect().top - panelBox.bottom)
  loginShape.value = createLoginPanelShape({
    width: panelBox.width,
    height: panelBox.height,
    avatarX: avatarBox.left + avatarBox.width / 2 - panelBox.left,
    avatarY: avatarBox.top + avatarBox.height / 2 - panelBox.top,
    avatarRadius: avatar.offsetWidth / 2,
    gap: drawerGap + 0.5,
    cornerRadius: parseFloat(getComputedStyle(bar).borderTopLeftRadius),
  })
}

function scheduleLoginShape() {
  if (shapeFrame) return
  shapeFrame = requestAnimationFrame(() => {
    shapeFrame = 0
    measureLoginShape()
  })
}

function stopLoginShape() {
  shapeObserver?.disconnect()
  shapeObserver = undefined
  if (shapeFrame) cancelAnimationFrame(shapeFrame)
  shapeFrame = 0
  window.removeEventListener('resize', scheduleLoginShape)
}

function clearLoginShape() {
  if (!props.isOpen || props.preferModal) loginShape.value = null
}

watch(
  [loginPanelRef, () => props.isOpen, () => props.preferModal, () => props.barEl, () => props.avatarEl],
  ([panel, open, modal, bar, avatar]) => {
    stopLoginShape()
    if (!panel || !open || modal) return
    loginShape.value = null
    measureLoginShape()
    shapeObserver = new ResizeObserver(scheduleLoginShape)
    for (const element of [panel, bar, avatar]) {
      if (element instanceof HTMLElement) shapeObserver.observe(element)
    }
    window.addEventListener('resize', scheduleLoginShape)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  stopLoginShape()
})

defineExpose({
  panelEl: loginPanelRef,
})
</script>

<style lang="scss" scoped>
.nexus-bar__login-panel {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  z-index: 21;
  padding: calc(1.75rem + 1px) calc(1.5rem + 1px);
  visibility: hidden;
  pointer-events: none;

  &.is-shape-ready {
    visibility: visible;
  }
}

.nexus-bar__login-surface {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.06)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.08));

  :global(.dark) & {
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
  }

  path {
    fill: var(--surface-1);
    stroke: var(--border);
    stroke-width: 1px;
    pointer-events: visiblePainted;
  }
}

.nexus-bar__login-content {
  position: relative;
  pointer-events: none;

  :deep(.auth-panel) {
    pointer-events: auto;
  }
}

.nexus-login-panel-enter-active {
  transition: opacity 0.2s ease-out;
  .nexus-bar__login-content {
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    .nexus-bar__login-content {
      transition: none;
    }
  }
}

.nexus-login-panel-leave-active {
  transition: opacity 0.15s ease-in;
  .nexus-bar__login-content {
    transition: transform 0.15s ease-in;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    .nexus-bar__login-content {
      transition: none;
    }
  }
}

.nexus-login-panel-enter-from {
  opacity: 0;
  .nexus-bar__login-content {
    transform: translateY(8px);
  }
}

.nexus-login-panel-leave-to {
  opacity: 0;
  .nexus-bar__login-content {
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nexus-login-panel-enter-from,
  .nexus-login-panel-leave-to {
    .nexus-bar__login-content {
      transform: none;
    }
  }
}
</style>
