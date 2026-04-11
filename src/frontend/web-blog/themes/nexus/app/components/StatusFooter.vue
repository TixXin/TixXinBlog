<!--
  @file StatusFooter.vue
  @description Nexus 底部导航栏：头像半悬浮 + hover 展开博主卡片 + 导航 + 滚动进度 + 登录
  @author TixXin
  @since 2026-04-09
-->

<template>
  <div
    class="nexus-bar"
    :class="{ 'is-expanded': isExpanded }"
    @mouseenter="onBarEnter"
    @mouseleave="onBarLeave"
  >
    <!-- 头像：半悬浮，hover 触发展开 + 在线状态微标签（登录态下切换为当前用户） -->
    <NuxtLink
      to="/"
      class="nexus-bar__avatar-wrap"
      :style="{ '--avatar-glow-color': avatarGlowColor }"
      :aria-label="`返回首页（当前：${displayName}）`"
      @mouseenter="onAvatarEnter"
    >
      <NuxtImg
        v-if="!avatarError"
        :key="displayAvatarUrl"
        :src="displayAvatarUrl"
        :alt="displayName"
        :width="80"
        :height="80"
        class="nexus-bar__avatar-img"
        format="webp"
        loading="eager"
        fetchpriority="high"
        @error="onAvatarError"
      />
      <span v-else class="nexus-bar__avatar-fallback">{{ avatarFallback }}</span>
      <span
        class="nexus-bar__presence-badge"
        :class="`nexus-bar__presence-badge--${effectivePresence.status}`"
        :aria-label="`状态：${effectivePresence.label}`"
      >
        <span class="nexus-bar__presence-badge-dot" />
        <span class="nexus-bar__presence-badge-text">{{ effectivePresence.label.slice(0, 2) }}</span>
      </span>
    </NuxtLink>

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
      <!-- 收起态：操作图标 + 导航 + 进度 -->
      <div class="nexus-bar__row-nav">
        <div class="nexus-bar__actions">
          <BlogThemeSwitcher />
          <BlogAppearanceEntry />
        </div>
        <div class="nexus-bar__separator" aria-hidden="true" />
        <nav class="nexus-bar__nav" aria-label="站点导航">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nexus-bar__link"
            :class="{ 'is-active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <Icon :name="item.icon" size="16" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <Transition name="nexus-progress-fade">
          <button
            v-if="showProgress"
            class="nexus-bar__progress"
            type="button"
            :aria-label="scrollDirection === 'down' ? '返回底部' : '返回顶部'"
            @click="onProgressClick"
          >
            <svg class="nexus-bar__progress-ring" viewBox="0 0 36 36">
              <circle class="nexus-bar__progress-ring-bg" cx="18" cy="18" r="16" />
              <circle
                class="nexus-bar__progress-ring-fill"
                cx="18" cy="18" r="16"
                :style="{ strokeDashoffset: progressRingOffset }"
              />
            </svg>
            <span class="nexus-bar__progress-center">
              <span class="nexus-bar__progress-text">{{ displayProgress }}</span>
              <Icon
                :name="scrollDirection === 'down' ? 'lucide:arrow-down' : 'lucide:arrow-up'"
                size="12"
                class="nexus-bar__progress-icon"
              />
            </span>
          </button>
        </Transition>
      </div>

      <!-- 展开态：横向布局 — 左侧身份信息 | 右侧一言+社交 -->
      <div class="nexus-bar__row-owner">
        <div class="nexus-bar__owner-card">
          <!-- 左列：名字、头衔、在线状态（登录态下切换为当前用户身份） -->
          <div class="nexus-bar__owner-left">
            <div class="nexus-bar__owner-header">
              <span class="nexus-bar__owner-name">{{ displayName }}</span>
              <span class="nexus-bar__owner-title">{{ displayTitle }}</span>
            </div>
            <div class="nexus-bar__owner-status-line">
              <span
                class="nexus-bar__owner-status-dot"
                :class="`nexus-bar__owner-status-dot--${effectivePresence.status}`"
              />
              <span class="nexus-bar__owner-status-label">{{ effectivePresence.label }}</span>
              <span v-if="effectivePresence.signature" class="nexus-bar__owner-status-sig">
                · {{ effectivePresence.signature }}
              </span>
            </div>
          </div>
          <!-- 分隔线 -->
          <div class="nexus-bar__owner-divider" />
          <!-- 右列：一言 + 社交链接 -->
          <div class="nexus-bar__owner-right">
            <div class="nexus-bar__owner-quote-row">
              <p class="nexus-bar__owner-quote">
                <Transition name="nexus-quote-swap" mode="out-in">
                  <span :key="dailyQuote">「{{ dailyQuote }}」</span>
                </Transition>
              </p>
              <button
                class="nexus-bar__quote-refresh"
                type="button"
                aria-label="换一条"
                @click="refreshQuote"
              >
                <Icon name="lucide:refresh-cw" size="12" />
              </button>
            </div>
            <div v-if="showSocials" class="nexus-bar__owner-socials">
              <a
                v-for="social in ownerCard.socials"
                :key="social.href"
                :href="social.href"
                target="_blank"
                rel="noopener noreferrer"
                class="nexus-bar__social-link"
              >
                <Icon :name="social.icon" size="14" />
                <span>{{ social.label }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 登录面板（底部栏上方悬浮） -->
    <Transition name="nexus-login-panel">
      <div v-if="isLoginOpen" ref="loginPanelRef" class="nexus-bar__login-panel">
        <AuthPanel />
      </div>
    </Transition>

    <!-- 用户菜单 popover（底部栏上方悬浮，已登录时可展开） -->
    <Transition name="nexus-user-menu">
      <div
        v-if="isUserMenuOpen && isLoggedIn"
        ref="userMenuRef"
        class="nexus-bar__user-menu"
        role="menu"
      >
        <div class="nexus-bar__user-menu-header">
          <div class="nexus-bar__user-menu-name">{{ currentUser?.nickname }}</div>
          <div class="nexus-bar__user-menu-email">{{ currentUser?.email }}</div>
        </div>
        <div class="nexus-bar__user-menu-divider" />
        <button
          type="button"
          class="nexus-bar__user-menu-item"
          role="menuitem"
          @click="onUserMenuProfile"
        >
          <Icon name="lucide:user" size="14" />
          <span>个人中心</span>
        </button>
        <button
          type="button"
          class="nexus-bar__user-menu-item"
          role="menuitem"
          @click="onUserMenuSettings"
        >
          <Icon name="lucide:settings" size="14" />
          <span>账号设置</span>
        </button>
        <div class="nexus-bar__user-menu-divider" />
        <button
          type="button"
          class="nexus-bar__user-menu-item nexus-bar__user-menu-item--danger"
          role="menuitem"
          @click="onUserMenuLogout"
        >
          <Icon name="lucide:log-out" size="14" />
          <span>退出登录</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { OwnerPresence } from '~/features/site/types'

const route = useRoute()
const router = useRouter()
const { navItems } = useNavItems()
const { scrollProgress, scrollResetFn, scrollDirection } = useScrollProgress()
const { ownerPresence, ownerCard, dailyQuote } = useSiteInfo()
const { isOpen: isLoginOpen, toggle: toggleLogin, close: closeLogin } = useLoginDrawer()
const { isLoggedIn, currentUser, logout } = useCurrentUser()
const { info } = useToast()

const loginPanelRef = ref<HTMLElement | null>(null)
const userMenuButtonRef = ref<HTMLElement | null>(null)
const userMenuRef = ref<HTMLElement | null>(null)
const isUserMenuOpen = ref(false)

// 头像呼吸光晕颜色映射
const GLOW_COLOR_MAP: Record<OwnerPresence, string> = {
  online: 'var(--accent-alpha-20, rgba(99, 102, 241, 0.2))',
  idle: 'rgba(234, 179, 8, 0.15)',
  busy: 'rgba(239, 68, 68, 0.15)',
  offline: 'transparent',
}

// 默认博主头像（未登录时使用）
const defaultAvatarUrl =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12'

const avatarError = ref(false)

/** 当前应展示的头像 URL：登录后用 currentUser.avatar，否则回落到博主默认头像 */
const displayAvatarUrl = computed(() => currentUser.value?.avatar || defaultAvatarUrl)

/** 当前应展示的名字：登录后用 currentUser.nickname，否则用 ownerCard.name */
const displayName = computed(() => currentUser.value?.nickname || ownerCard.value.name)

/** 头像加载失败时的占位首字母 */
const avatarFallback = computed(() => {
  const name = displayName.value || 'TX'
  return name.slice(0, 2).toUpperCase()
})

/** 展开态左列副标题：访客显示「访客」，其它情况用 ownerCard.title */
const displayTitle = computed(() => {
  if (currentUser.value?.role === 'visitor') return '访客'
  return ownerCard.value.title
})

/**
 * 当前应展示的在线状态：
 * - 已登录 → 强制 online，签名取自 currentUser.signature
 * - 未登录 → 沿用 useSiteInfo().ownerPresence（mock 状态机）
 */
const effectivePresence = computed(() => {
  if (isLoggedIn.value && currentUser.value) {
    return {
      status: 'online' as const,
      label: '在线',
      signature: currentUser.value.signature ?? '',
      since: ownerPresence.value.since,
    }
  }
  return ownerPresence.value
})

const avatarGlowColor = computed(() => GLOW_COLOR_MAP[effectivePresence.value.status])

/** 仅博主或未登录态展示个人社交链接（访客没有个人 socials） */
const showSocials = computed(() => !isLoggedIn.value || currentUser.value?.role === 'owner')

/** 账号入口按钮：图标、aria-label、点击行为均按登录态切换 */
const loginButtonIcon = computed(() =>
  isLoggedIn.value ? 'lucide:user-round-cog' : 'lucide:circle-user',
)
const loginButtonAriaLabel = computed(() =>
  isLoggedIn.value ? `用户菜单：${currentUser.value?.nickname ?? ''}` : '登录',
)

/** 头像 URL 切换时（登录/退出）重置失败标志，让 NuxtImg 重新尝试加载 */
watch(displayAvatarUrl, () => {
  avatarError.value = false
})

const showProgress = computed(() => scrollProgress.value > 1)
const displayProgress = computed(() => Math.round(scrollProgress.value))

// 环形进度条 dashoffset 计算（与 SVG circle r=16 保持一致）
const RING_CIRCUMFERENCE = 2 * Math.PI * 16
const progressRingOffset = computed(() => RING_CIRCUMFERENCE * (1 - scrollProgress.value / 100))

function onAvatarError() {
  avatarError.value = true
}

function isActive(to: string) {
  const path = route.path.replace(/\/$/, '') || '/'
  const target = to.replace(/\/$/, '') || '/'
  return path === target || (target !== '/' && path.startsWith(target + '/'))
}

function onProgressClick() {
  scrollResetFn.value?.()
}

/** 刷新每日一言（避免与当前相同） */
function refreshQuote() {
  const quotes = ownerCard.value.quotes
  if (quotes.length <= 1) return
  let next: string = ''
  do {
    next = quotes[Math.floor(Math.random() * quotes.length)] || ''
  } while (next === dailyQuote.value)
  dailyQuote.value = next
}

// ---- 展开/收起逻辑 ----
const { isFooterExpanded } = useFooterExpand()
const isExpanded = isFooterExpanded
let expandTimer: ReturnType<typeof setTimeout> | null = null
let collapseTimer: ReturnType<typeof setTimeout> | null = null

/** hover 头像触发展开（登录面板打开时不触发展开，避免干扰登录操作） */
function onAvatarEnter() {
  if (isLoginOpen.value) return
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null }
  if (!expandTimer) {
    expandTimer = setTimeout(() => {
      isExpanded.value = true
      expandTimer = null
    }, 120)
  }
}

/** 鼠标在整个底部栏内时保持展开 */
function onBarEnter() {
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null }
}

/** 鼠标离开底部栏时延迟收起 */
function onBarLeave() {
  if (expandTimer) { clearTimeout(expandTimer); expandTimer = null }
  collapseTimer = setTimeout(() => {
    isExpanded.value = false
    collapseTimer = null
  }, 150)
}

// ---- 登录面板逻辑 ----
function onLoginClick() {
  // 打开登录面板时自动收起底部栏，避免视觉遮挡
  if (!isLoginOpen.value && isExpanded.value) {
    if (expandTimer) { clearTimeout(expandTimer); expandTimer = null }
    isExpanded.value = false
  }
  toggleLogin()
}

/** 账号入口按钮点击：登录态打开 popover，未登录打开登录面板 */
function onLoginButtonClick() {
  if (isLoggedIn.value) {
    toggleUserMenu()
  } else {
    onLoginClick()
  }
}

// ---- 用户菜单逻辑 ----
function toggleUserMenu() {
  // 打开菜单时收起展开态，避免与博主信息卡视觉重叠
  if (!isUserMenuOpen.value && isExpanded.value) {
    if (expandTimer) { clearTimeout(expandTimer); expandTimer = null }
    isExpanded.value = false
  }
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function onUserMenuProfile() {
  closeUserMenu()
  // 占位：暂未实现独立的个人中心页，先跳到关于页
  router.push('/about')
}

function onUserMenuSettings() {
  closeUserMenu()
  info('账号设置功能开发中')
}

function onUserMenuLogout() {
  closeUserMenu()
  logout()
  info('已退出登录')
}

/** 点击外部关闭登录面板 / 用户菜单 */
function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (isLoginOpen.value) {
    const panel = loginPanelRef.value
    // 如果点击在面板内或登录按钮上，忽略
    if (!panel?.contains(target) && !target.closest('.nexus-bar__login')) {
      closeLogin()
    }
  }

  if (isUserMenuOpen.value) {
    const menu = userMenuRef.value
    const button = userMenuButtonRef.value
    if (!menu?.contains(target) && !button?.contains(target)) {
      closeUserMenu()
    }
  }
}

/** ESC 关闭登录面板 / 用户菜单 */
function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (isLoginOpen.value) closeLogin()
  if (isUserMenuOpen.value) closeUserMenu()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onEscKey)
})

onBeforeUnmount(() => {
  if (expandTimer) clearTimeout(expandTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onEscKey)
})
</script>

<style lang="scss" scoped>
$bar-height: 72px;
$bar-expanded: 112px;

.nexus-bar {
  // 主内容区左边界（相对底部栏左边）：左栏宽 + grid gap
  --bar-pivot-left: calc(#{$sidebar-left-width} + #{$grid-gap});
  // 头像区右侧的留空（同 padding-left），便于公式复用
  --bar-avatar-pad: 7.75rem;
  // 统一的元素间距：头像-登录-月亮-设置-分隔线-导航 全部使用 1.5rem
  --bar-divider-gap: 1.5rem;
  // 三个左侧按钮的统一尺寸
  --bar-action-size: 2.25rem;
  // nexus-bar 自身 flex gap，与其它间距保持一致
  --bar-flex-gap: 1.5rem;

  position: relative;
  display: flex;
  align-items: center;
  gap: var(--bar-flex-gap);
  height: $bar-height;
  padding: 0 1.25rem;
  padding-left: var(--bar-avatar-pad); // 给头像留空间（含间距）
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow:
    0 -1px 0 0 var(--border-soft) inset,
    0 4px 24px rgba(0, 0, 0, 0.06);
  overflow: visible;

  // 收起动画（快速响应）
  transition:
    height 0.18s cubic-bezier(0.4, 0, 0.6, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.6, 1),
    background 0.25s ease,
    box-shadow 0.25s ease;

  &.is-expanded {
    height: $bar-expanded;
    transform: translateY(#{$bar-height - $bar-expanded});
    z-index: 20;

    // 展开动画（柔和减速）
    transition:
      height 0.3s cubic-bezier(0.22, 0.68, 0.35, 1.0),
      transform 0.3s cubic-bezier(0.22, 0.68, 0.35, 1.0),
      background 0.3s ease,
      box-shadow 0.3s ease;
  }

  @media (max-width: #{$breakpoint-md - 0.02}) {
    display: none;
  }
}

// ---- 头像（半悬浮，展开时位置不变） ----
.nexus-bar__avatar-wrap {
  position: absolute;
  left: 1.25rem;
  bottom: 16px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--surface-1);
  box-shadow:
    0 2px 16px rgba(0, 0, 0, 0.12),
    0 0 0 0 var(--accent-alpha-0);
  z-index: 22;
  cursor: pointer;
  transition:
    transform 0.3s cubic-bezier(0.22, 0.68, 0.35, 1.0),
    box-shadow 0.3s ease,
    border-color 0.3s ease;

  &:hover {
    border-color: var(--accent);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.15),
      0 0 0 3px var(--accent-alpha-20, rgba(99, 102, 241, 0.15));
    transform: scale(1.05);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease;
  }

  &:active {
    transform: scale(1.02);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
  }
}

.nexus-bar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  transition: filter 0.3s ease;

  .nexus-bar__avatar-wrap:hover & {
    filter: brightness(1.05);
  }
}

.nexus-bar__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

// ---- 头像呼吸光晕 ----
.nexus-bar__avatar-wrap::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}

.nexus-bar:not(.is-expanded) .nexus-bar__avatar-wrap::after {
  opacity: 1;
  animation: nexus-avatar-glow 3s ease-in-out infinite;
}

@keyframes nexus-avatar-glow {
  0%,
  100% { box-shadow: 0 0 0 0 var(--avatar-glow-color, transparent); }
  50% { box-shadow: 0 0 12px 2px var(--avatar-glow-color, transparent); }
}

// ---- 在线状态微标签 ----
.nexus-bar__presence-badge {
  position: absolute;
  right: -8px;
  bottom: -2px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px 1px 4px;
  border-radius: $radius-full;
  background: var(--surface-1);
  border: 1.5px solid var(--border-soft);
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--text-soft);
  white-space: nowrap;
  z-index: 2;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

  .nexus-bar.is-expanded & {
    opacity: 0;
    transform: scale(0.8);
  }
}

.nexus-bar__presence-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nexus-bar__presence-badge--online .nexus-bar__presence-badge-dot { background: var(--presence-online); }
.nexus-bar__presence-badge--idle .nexus-bar__presence-badge-dot { background: var(--presence-idle); }
.nexus-bar__presence-badge--busy .nexus-bar__presence-badge-dot { background: var(--presence-busy); }
.nexus-bar__presence-badge--offline .nexus-bar__presence-badge-dot { background: var(--presence-offline); }

.nexus-bar__presence-badge-text {
  line-height: 1;
}

// ---- 内容切换区域 ----
.nexus-bar__body {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

// 收起态导航行
.nexus-bar__row-nav {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: var(--bar-divider-gap); // 分隔线两侧使用对称间距
  transition: opacity 0.12s ease;

  .nexus-bar.is-expanded & {
    opacity: 0;
    pointer-events: none;
  }
}

// 展开态：博主信息
.nexus-bar__row-owner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease 0.04s;

  .nexus-bar.is-expanded & {
    opacity: 1;
    pointer-events: auto;
  }
}

// ---- 操作图标 ----
.nexus-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--bar-divider-gap); // 月亮-设置间距与其它一致
  flex-shrink: 0;
  // 容器宽度恰好包住两个按钮 + gap，分隔线由 nexus-bar 的 flex/row-nav 多个 gap 共同推到主内容区左边
  width: calc(
    var(--bar-pivot-left) - var(--bar-avatar-pad) - var(--bar-action-size) - var(--bar-flex-gap) -
      var(--bar-divider-gap)
  );

  // 仅作用于底部栏内的两个按钮，放大按钮与图标尺寸
  :deep(.theme-switcher),
  :deep(button.appearance-fab) {
    width: 2.25rem;
    height: 2.25rem;
  }

  :deep(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
}

// ---- 分隔线 ----
.nexus-bar__separator {
  width: 1px;
  height: 1.5rem;
  flex-shrink: 0;
  background: var(--border-soft);
  opacity: 0.8;
}

// ---- 导航链接 ----
.nexus-bar__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nexus-bar__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &.is-active {
    color: var(--accent);
    background: var(--accent-alpha-5, rgba(99, 102, 241, 0.05));
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0.1875rem;
      left: 50%;
      transform: translateX(-50%);
      width: 1.25rem;
      height: 2px;
      border-radius: 1px;
      background: var(--accent);
      opacity: 0.9;
    }
  }
}

// ---- 环形滚动进度按钮 ----
.nexus-bar__progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: none;
  background: var(--surface-2);
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.15s ease;

  &:hover {
    background: var(--surface-3);

    .nexus-bar__progress-text {
      opacity: 0;
      transform: scale(0.6);
    }

    .nexus-bar__progress-icon {
      opacity: 1;
      transform: translateY(0);
      animation: nexus-bar-bounce 0.6s ease infinite;
    }
  }

  &:active {
    transform: scale(0.9);
  }
}

.nexus-bar__progress-ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.nexus-bar__progress-ring-bg {
  fill: none;
  stroke: var(--border-soft);
  stroke-width: 2;
}

.nexus-bar__progress-ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 100.53; // 2 * PI * 16
  transition: stroke-dashoffset 0.3s cubic-bezier(0.22, 0.68, 0.35, 1.0);
}

.nexus-bar__progress-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nexus-bar__progress-text {
  font-size: 0.625rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.nexus-bar__progress-icon {
  position: absolute;
  opacity: 0;
  color: var(--accent);
  transform: translateY(3px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

@keyframes nexus-bar-bounce {
  0%,
  100% { transform: translateY(0); }
  40% { transform: translateY(-3px); }
  60% { transform: translateY(1px); }
}

.nexus-progress-fade-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.nexus-progress-fade-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}

.nexus-progress-fade-enter-from,
.nexus-progress-fade-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}

// ---- 博主信息卡片（横向布局） ----
.nexus-bar__owner-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

// 展开态子元素交错入场动画
.nexus-bar__owner-card > * {
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(1) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.06s;
}

.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(2) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.10s;
}

.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(3) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.14s;
}

// 左列：身份 + 状态
.nexus-bar__owner-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

// 中间分隔线
.nexus-bar__owner-divider {
  width: 1px;
  height: 2rem;
  flex-shrink: 0;
  background: var(--border-soft);
  opacity: 0.6;
}

// 右列：一言 + 社交
.nexus-bar__owner-right {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.nexus-bar__owner-header {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
}

.nexus-bar__owner-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 0.02em;
}

.nexus-bar__owner-title {
  font-size: 0.75rem;
  color: var(--text-soft);
}

// 在线状态行
.nexus-bar__owner-status-line {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.nexus-bar__owner-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &--online { background: var(--presence-online); }
  &--idle { background: var(--presence-idle); }
  &--busy { background: var(--presence-busy); }
  &--offline { background: var(--presence-offline); }
}

.nexus-bar__owner-status-label {
  font-weight: 600;
}

.nexus-bar__owner-status-sig {
  color: var(--text-muted);
  font-style: italic;
}

// 一言行（含刷新按钮）
.nexus-bar__owner-quote-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.nexus-bar__owner-quote {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
}

.nexus-bar__quote-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: $radius-full;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    transform 0.3s ease;

  .nexus-bar__owner-quote-row:hover & {
    opacity: 1;
  }

  &:hover {
    color: var(--accent);
  }

  &:active {
    transform: rotate(180deg);
  }
}

// 一言切换动画
.nexus-quote-swap-enter-active,
.nexus-quote-swap-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.nexus-quote-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.nexus-quote-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.nexus-bar__owner-socials {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.125rem;
}

.nexus-bar__social-link {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent);
  }
}

// ---- 登录按钮（与左侧两个图标视觉风格一致：无边框、圆角小） ----
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
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

  // 自定 hover 动效：图标轻微上抬 + 颜色高亮
  &:hover {
    color: var(--accent);
    background: var(--surface-2);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0) scale(0.92);
  }

  // 面板/popover 打开时保持高亮
  &.is-open {
    color: var(--accent);
    background: var(--surface-2);
  }

  // 图标尺寸与其它两个按钮一致（20px）
  :deep(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
}

// ---- 用户菜单 popover ----
.nexus-bar__user-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  // 与账号入口按钮（.nexus-bar__login）水平对齐
  left: var(--bar-avatar-pad);
  z-index: 21;
  min-width: 200px;
  padding: 0.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.nexus-bar__user-menu-header {
  padding: 0.5rem 0.625rem 0.625rem;
}

.nexus-bar__user-menu-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.nexus-bar__user-menu-email {
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nexus-bar__user-menu-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.25rem 0;
}

.nexus-bar__user-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;

  &:hover {
    background: var(--surface-2);
    transform: translateX(2px);
  }

  &--danger {
    color: var(--danger, #ef4444);

    &:hover {
      background: rgba(239, 68, 68, 0.08);
      color: var(--danger, #ef4444);
    }
  }
}

/* 用户菜单进出动画 */
.nexus-user-menu-enter-active {
  transition: opacity 0.18s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nexus-user-menu-leave-active {
  transition: opacity 0.14s ease-in, transform 0.14s ease-in;
}

.nexus-user-menu-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

.nexus-user-menu-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

// ---- 登录面板（底部栏上方悬浮） ----
.nexus-bar__login-panel {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  z-index: 21;
  padding: 1.75rem 1.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

/* 登录面板进出动画 */
.nexus-login-panel-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nexus-login-panel-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}

.nexus-login-panel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.nexus-login-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
