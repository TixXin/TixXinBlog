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
    <!-- 头像：半悬浮，hover 触发展开 + 在线状态微标签 -->
    <NuxtLink
      to="/"
      class="nexus-bar__avatar-wrap"
      :style="{ '--avatar-glow-color': avatarGlowColor }"
      aria-label="返回首页"
      @mouseenter="onAvatarEnter"
    >
      <NuxtImg
        v-if="!avatarError"
        :src="avatarUrl"
        alt="TixXin"
        :width="80"
        :height="80"
        class="nexus-bar__avatar-img"
        format="webp"
        loading="eager"
        fetchpriority="high"
        @error="onAvatarError"
      />
      <span v-else class="nexus-bar__avatar-fallback">TX</span>
      <span
        class="nexus-bar__presence-badge"
        :class="`nexus-bar__presence-badge--${ownerPresence.status}`"
        :aria-label="`状态：${ownerPresence.label}`"
      >
        <span class="nexus-bar__presence-badge-dot" />
        <span class="nexus-bar__presence-badge-text">{{ ownerPresence.label.slice(0, 2) }}</span>
      </span>
    </NuxtLink>

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
          <!-- 左列：名字、头衔、在线状态 -->
          <div class="nexus-bar__owner-left">
            <div class="nexus-bar__owner-header">
              <span class="nexus-bar__owner-name">{{ ownerCard.name }}</span>
              <span class="nexus-bar__owner-title">{{ ownerCard.title }}</span>
            </div>
            <div class="nexus-bar__owner-status-line">
              <span
                class="nexus-bar__owner-status-dot"
                :class="`nexus-bar__owner-status-dot--${ownerPresence.status}`"
              />
              <span class="nexus-bar__owner-status-label">{{ ownerPresence.label }}</span>
              <span v-if="ownerPresence.signature" class="nexus-bar__owner-status-sig">
                · {{ ownerPresence.signature }}
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
            <div class="nexus-bar__owner-socials">
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

    <!-- 登录按钮（始终显示） -->
    <button class="nexus-bar__login" type="button" aria-label="登录" @click="onLoginClick">
      <Icon name="lucide:circle-user" size="18" />
    </button>

    <!-- 登录面板（底部栏上方悬浮） -->
    <Transition name="nexus-login-panel">
      <div v-if="isLoginOpen" ref="loginPanelRef" class="nexus-bar__login-panel">
        <AuthPanel />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { OwnerPresence } from '~/features/site/types'

const route = useRoute()
const { navItems } = useNavItems()
const { scrollProgress, scrollResetFn, scrollDirection } = useScrollProgress()
const { ownerPresence, ownerCard, dailyQuote } = useSiteInfo()
const { isOpen: isLoginOpen, toggle: toggleLogin, close: closeLogin } = useLoginDrawer()

const loginPanelRef = ref<HTMLElement | null>(null)

// 头像呼吸光晕颜色映射
const GLOW_COLOR_MAP: Record<OwnerPresence, string> = {
  online: 'var(--accent-alpha-20, rgba(99, 102, 241, 0.2))',
  idle: 'rgba(234, 179, 8, 0.15)',
  busy: 'rgba(239, 68, 68, 0.15)',
  offline: 'transparent',
}
const avatarGlowColor = computed(() => GLOW_COLOR_MAP[ownerPresence.value.status])

const avatarUrl =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12'

const avatarError = ref(false)

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
  let next: string
  do {
    next = quotes[Math.floor(Math.random() * quotes.length)]
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

/** 点击外部关闭登录面板 */
function onClickOutside(e: MouseEvent) {
  if (!isLoginOpen.value) return
  const panel = loginPanelRef.value
  const target = e.target as HTMLElement
  // 如果点击在面板内或登录按钮上，忽略
  if (panel?.contains(target)) return
  if (target.closest('.nexus-bar__login')) return
  closeLogin()
}

/** ESC 关闭登录面板 */
function onEscKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isLoginOpen.value) {
    closeLogin()
  }
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: $bar-height;
  padding: 0 1.25rem;
  padding-left: 7.5rem; // 给头像留空间（含间距）
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
  left: 1rem;
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
  gap: 0.5rem;
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
  gap: 0.75rem;
  flex-shrink: 0;
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

// ---- 登录按钮（始终显示） ----
.nexus-bar__login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: $radius-full;
  color: var(--text-soft);
  background: transparent;
  border: 1px solid var(--border-soft);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;

  &:hover {
    color: var(--accent);
    background: var(--surface-2);
    border-color: var(--accent-alpha-20, rgba(99, 102, 241, 0.15));
  }

  &:active {
    transform: scale(0.92);
  }
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
