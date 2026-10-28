<!--
  @file StatusFooter.vue
  @description Nexus 底部导航栏：头像半悬浮 + hover 展开博主卡片 + 导航 + 滚动进度 + 登录
  @author TixXin
  @since 2026-04-09
-->

<template>
  <div
    ref="barRef"
    class="nexus-bar"
    :class="{ 'is-expanded': isExpanded }"
    @mouseenter="onBarEnter"
    @mouseleave="onBarLeave"
  >
    <!-- 头像：半悬浮，hover 触发展开 + 在线状态微标签（登录态下切换为当前用户） -->
    <StatusFooterAvatar ref="avatarCompRef" @avatar-enter="onAvatarEnter" />

    <!-- 账号入口按钮：未登录 → 打开登录面板；已登录 → 打开用户菜单 popover -->
    <button
      ref="userMenuButtonRef"
      class="nexus-bar__login"
      :class="{ 'is-open': isLoggedIn ? isUserMenuOpen : isLoginOpen }"
      type="button"
      :aria-label="loginButtonAriaLabel"
      :aria-expanded="isLoggedIn ? isUserMenuOpen : isLoginOpen"
      @click="onLoginButtonClick"
    >
      <Icon :name="loginButtonIcon" size="18" />
    </button>

    <!-- 内容切换区域 -->
    <div class="nexus-bar__body">
      <!-- 收起态：操作图标 + 导航 + 进度；键盘焦点进入时收起展开态，避免聚焦到透明元素 -->
      <StatusFooterNavRow @focusin="onNavFocusIn" />

      <!-- 展开态：横向布局 — 左侧身份信息 | 右侧一言+社交；收起时透明且 inert，不进入 Tab 顺序与读屏 -->
      <StatusFooterOwnerRow :is-expanded="isExpanded" />
    </div>

    <!-- 底部栏内嵌登录面板：仅在非 modal 模式下显示（modal 模式由 app.vue 的 AuthModal 接管） -->
    <StatusFooterLoginPanel
      ref="loginPanelCompRef"
      :is-open="isLoginOpen"
      :prefer-modal="preferModal"
      :bar-el="barRef"
      :avatar-el="avatarWrapEl"
      @close="closeLogin"
    />

    <!-- 用户菜单 popover（底部栏上方悬浮，已登录时可展开）；关闭时把焦点归还触发按钮 -->
    <StatusFooterUserMenu ref="userMenuCompRef" :is-open="isUserMenuOpen" @close="closeUserMenu(true)" />
  </div>
</template>

<script setup lang="ts">
import StatusFooterAvatar from './StatusFooterAvatar.vue'
import StatusFooterNavRow from './StatusFooterNavRow.vue'
import StatusFooterOwnerRow from './StatusFooterOwnerRow.vue'
import StatusFooterLoginPanel from './StatusFooterLoginPanel.vue'
import StatusFooterUserMenu from './StatusFooterUserMenu.vue'

const { isOpen: isLoginOpen, preferModal, toggle: toggleLogin, close: closeLogin } = useLoginDrawer()
const { isLoggedIn, currentUser } = useCurrentUser()
const { t } = useI18n()

const barRef = ref<HTMLElement | null>(null)
const avatarCompRef = ref<InstanceType<typeof StatusFooterAvatar> | null>(null)
const loginPanelCompRef = ref<InstanceType<typeof StatusFooterLoginPanel> | null>(null)
const userMenuCompRef = ref<InstanceType<typeof StatusFooterUserMenu> | null>(null)
const userMenuButtonRef = ref<HTMLElement | null>(null)
const isUserMenuOpen = ref(false)

const avatarWrapEl = computed<HTMLElement | null>(
  () => (avatarCompRef.value?.avatarWrapRef?.$el as HTMLElement | undefined) ?? null,
)

const loginButtonIcon = computed(() => (isLoggedIn.value ? 'lucide:user-round-cog' : 'lucide:circle-user'))
const loginButtonAriaLabel = computed(() =>
  isLoggedIn.value
    ? t('theme.nexus.statusBar.userMenu', { name: currentUser.value?.nickname ?? '' })
    : t('theme.shell.login'),
)

// ---- 展开/收起逻辑 ----
const { isFooterExpanded } = useFooterExpand()
const isExpanded = isFooterExpanded

let expandTimer: ReturnType<typeof setTimeout> | null = null
let collapseTimer: ReturnType<typeof setTimeout> | null = null

function onNavFocusIn() {
  if (expandTimer) {
    clearTimeout(expandTimer)
    expandTimer = null
  }
  isExpanded.value = false
}

function onAvatarEnter() {
  if (isLoginOpen.value) return
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  if (!expandTimer) {
    expandTimer = setTimeout(() => {
      isExpanded.value = true
      expandTimer = null
    }, 120)
  }
}

function onBarEnter() {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
}

function onBarLeave() {
  if (expandTimer) {
    clearTimeout(expandTimer)
    expandTimer = null
  }
  collapseTimer = setTimeout(() => {
    isExpanded.value = false
    collapseTimer = null
  }, 150)
}

function onLoginClick() {
  if (!isLoginOpen.value && isExpanded.value) {
    if (expandTimer) {
      clearTimeout(expandTimer)
      expandTimer = null
    }
    isExpanded.value = false
  }
  toggleLogin()
}

function onLoginButtonClick() {
  if (isLoggedIn.value) {
    toggleUserMenu()
  } else {
    onLoginClick()
  }
}

function toggleUserMenu() {
  if (!isUserMenuOpen.value && isExpanded.value) {
    if (expandTimer) {
      clearTimeout(expandTimer)
      expandTimer = null
    }
    isExpanded.value = false
  }
  isUserMenuOpen.value = !isUserMenuOpen.value
}

/**
 * 关闭用户菜单。restoreFocus 仅在 Escape 或菜单项动作时开启：
 * 外部点击不抢焦点，避免把焦点从用户刚点击的目标上移走。
 */
function closeUserMenu(restoreFocus = false) {
  if (!isUserMenuOpen.value) return
  isUserMenuOpen.value = false
  if (restoreFocus) userMenuButtonRef.value?.focus({ preventScroll: true })
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (isLoginOpen.value && !preferModal.value) {
    const panel = loginPanelCompRef.value?.panelEl
    if (!panel?.contains(target) && !target.closest('.nexus-bar__login')) {
      closeLogin()
    }
  }

  if (isUserMenuOpen.value) {
    const menu = userMenuCompRef.value?.menuEl
    const button = userMenuButtonRef.value
    if (!menu?.contains(target) && !button?.contains(target)) {
      closeUserMenu()
    }
  }
}

function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (isLoginOpen.value) closeLogin()
  // 键盘关闭用户菜单时焦点归还触发按钮，避免焦点跌回文档根导致 Tab 顺序中断
  if (isUserMenuOpen.value) closeUserMenu(true)
}

onMounted(() => {
  document.addEventListener('keydown', onEscKey)
})

let outsideHandlerAttached = false
// 延迟挂载的外部点击监听计时器：卸载或状态快速切换时必须取消，避免泄漏监听
let outsideAttachTimer: ReturnType<typeof setTimeout> | null = null
function attachOutsideHandler() {
  if (outsideHandlerAttached) return
  document.addEventListener('click', onClickOutside)
  outsideHandlerAttached = true
}
function detachOutsideHandler() {
  if (!outsideHandlerAttached) return
  document.removeEventListener('click', onClickOutside)
  outsideHandlerAttached = false
}
function scheduleOutsideHandler() {
  if (outsideAttachTimer) clearTimeout(outsideAttachTimer)
  outsideAttachTimer = setTimeout(() => {
    outsideAttachTimer = null
    attachOutsideHandler()
  }, 0)
}

watch([isLoginOpen, isUserMenuOpen], ([loginOpen, menuOpen]) => {
  if (outsideAttachTimer) {
    clearTimeout(outsideAttachTimer)
    outsideAttachTimer = null
  }
  if (loginOpen || menuOpen) {
    scheduleOutsideHandler()
  } else {
    detachOutsideHandler()
  }
})

onBeforeUnmount(() => {
  if (expandTimer) clearTimeout(expandTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
  if (outsideAttachTimer) clearTimeout(outsideAttachTimer)
  detachOutsideHandler()
  document.removeEventListener('keydown', onEscKey)
})
</script>

<style lang="scss" scoped>
// 底栏高度、展开高度、头像与按钮尺寸由 _nexus-density.scss 按视口分档提供
.nexus-bar {
  --bar-pivot-left: calc(#{$sidebar-left-width} + var(--nx-grid-gap) + var(--bar-avatar-offset));
  --bar-avatar-offset: 1.5rem;
  // 头像左距 + 头像宽 + 1.5rem 留白；默认 80px 头像时等于原先的 7.75rem
  --bar-avatar-pad: calc(2.75rem + var(--nx-bar-avatar) + var(--bar-avatar-offset));
  --bar-divider-gap: 1.5rem;
  --bar-action-size: var(--nx-bar-action);
  --bar-flex-gap: 1.5rem;

  position: relative;
  display: flex;
  align-items: center;
  gap: var(--bar-flex-gap);
  height: var(--nx-bar-h);
  padding: 0 1.25rem;
  padding-left: var(--bar-avatar-pad);
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: var(--nx-card-radius);
  box-shadow:
    0 -1px 0 0 var(--border-soft) inset,
    0 4px 24px rgba(0, 0, 0, 0.06);
  overflow: visible;

  transition:
    height 0.18s cubic-bezier(0.4, 0, 0.6, 1),
    background 0.25s ease,
    box-shadow 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 底栏位于底部对齐的网格行内，增高时自然向上展开，无需再用 transform 上移
  &.is-expanded {
    height: var(--nx-bar-expanded);
    z-index: 20;

    transition:
      height 0.3s cubic-bezier(0.22, 0.68, 0.35, 1),
      background 0.3s ease,
      box-shadow 0.3s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  @media (max-width: #{$breakpoint-lg - 0.02}) {
    display: none;
  }
}

.nexus-bar__body {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.nexus-bar__login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--bar-action-size);
  height: var(--bar-action-size);
  flex-shrink: 0;
  border: none;
  border-radius: $radius-sm;
  color: var(--text-soft);
  background: transparent;
  cursor: var(--interaction-cursor, pointer);
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--surface-2);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0) scale(0.92);
  }

  &.is-open {
    color: var(--accent-text);
    background: var(--surface-2);
  }

  :deep(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
}
</style>
