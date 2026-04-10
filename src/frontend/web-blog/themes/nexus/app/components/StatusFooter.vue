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
    <!-- 头像：半悬浮 → 展开时居中，hover 触发展开 + 在线状态 Tooltip -->
    <CommonTooltip rich placement="top">
      <NuxtLink
        to="/"
        class="nexus-bar__avatar-wrap"
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
          @error="onAvatarError"
        />
        <span v-else class="nexus-bar__avatar-fallback">TX</span>
        <span
          class="nexus-bar__presence-dot"
          :class="`nexus-bar__presence-dot--${ownerPresence.status}`"
          :aria-label="`状态：${ownerPresence.label}`"
        />
      </NuxtLink>
      <template #content>
        <div class="nexus-bar__presence-tip">
          <span class="nexus-bar__presence-tip-status">{{ presenceEmoji }} {{ ownerPresence.label }}</span>
          <span v-if="ownerPresence.signature" class="nexus-bar__presence-tip-sig">{{ ownerPresence.signature }}</span>
          <span class="nexus-bar__presence-tip-since">{{ presenceDuration }}</span>
        </div>
      </template>
    </CommonTooltip>

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
            :class="{ 'is-clicked': progressClicked }"
            type="button"
            :aria-label="scrollDirection === 'down' ? '返回底部' : '返回顶部'"
            @click="onProgressClick"
          >
            <span class="nexus-bar__progress-text">{{ displayProgress }}%</span>
            <Icon :name="scrollDirection === 'down' ? 'lucide:arrow-down' : 'lucide:arrow-up'" size="14" class="nexus-bar__progress-icon" />
          </button>
        </Transition>
      </div>

      <!-- 展开态：左侧博主信息 + 右侧在线状态 -->
      <div class="nexus-bar__row-owner">
        <div class="nexus-bar__owner-card">
          <div class="nexus-bar__owner-header">
            <span class="nexus-bar__owner-name">{{ ownerCard.name }}</span>
            <span class="nexus-bar__owner-title">{{ ownerCard.title }}</span>
          </div>
          <p class="nexus-bar__owner-quote">「{{ dailyQuote }}」</p>
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

    <!-- 登录按钮（始终显示） -->
    <button class="nexus-bar__login" type="button" aria-label="登录">
      <Icon name="lucide:circle-user" size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { OwnerPresence } from '~/features/site/types'

const route = useRoute()
const { navItems } = useNavItems()
const { scrollProgress, scrollResetFn, scrollDirection } = useScrollProgress()
const { ownerPresence, presenceDuration, ownerCard, dailyQuote } = useSiteInfo()

const PRESENCE_EMOJI: Record<OwnerPresence, string> = {
  online: '🟢',
  idle: '🟡',
  busy: '🔴',
  offline: '⚫',
}
const presenceEmoji = computed(() => PRESENCE_EMOJI[ownerPresence.value.status])

const avatarUrl =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12'

const avatarError = ref(false)
const progressClicked = ref(false)

const showProgress = computed(() => scrollProgress.value > 1)
const displayProgress = computed(() => Math.round(scrollProgress.value))

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
  progressClicked.value = true
}

watch(scrollProgress, (val) => {
  if (progressClicked.value && val > 1) {
    progressClicked.value = false
  }
})

// ---- 展开/收起逻辑 ----
const { isFooterExpanded } = useFooterExpand()
const isExpanded = isFooterExpanded
let expandTimer: ReturnType<typeof setTimeout> | null = null
let collapseTimer: ReturnType<typeof setTimeout> | null = null

/** hover 头像触发展开 */
function onAvatarEnter() {
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
  }, 300)
}

onBeforeUnmount(() => {
  if (expandTimer) clearTimeout(expandTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
})
</script>

<style lang="scss" scoped>
$bar-height: 72px;
$bar-expanded: 150px;

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

  // 收起动画
  transition:
    height 0.22s cubic-bezier(0.4, 0, 0.6, 1),
    transform 0.22s cubic-bezier(0.4, 0, 0.6, 1),
    background 0.3s ease,
    box-shadow 0.3s ease;

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
  z-index: 1;
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
    transform: scale(1.06);
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

// ---- 在线状态圆点 ----
.nexus-bar__presence-dot {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 10px;
  height: 10px;
  border-radius: $radius-full;
  box-shadow: 0 0 0 2.5px var(--surface-1);
  z-index: 2;
  pointer-events: none;

  &--online {
    background: var(--presence-online);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--presence-online);
      animation: nexus-presence-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
  }

  &--idle { background: var(--presence-idle); }
  &--busy { background: var(--presence-busy); }
  &--offline { background: var(--presence-offline); }
}

@keyframes nexus-presence-ping {
  75%,
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
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
  transition: opacity 0.15s ease;

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
  transition: opacity 0.2s ease 0.05s;

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
  height: 1.25rem;
  flex-shrink: 0;
  background: var(--border-soft);
  opacity: 0.6;
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
    background: var(--surface-3);
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0.125rem;
      left: 50%;
      transform: translateX(-50%);
      width: 1rem;
      height: 2px;
      border-radius: 1px;
      background: var(--accent);
      opacity: 0.8;
    }
  }
}

// ---- 滚动进度按钮 ----
.nexus-bar__progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  min-width: 2.75rem;
  padding: 0.3rem 0.625rem;
  border-radius: $radius-full;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;

  &:hover {
    color: var(--accent);
    background: var(--surface-3);
    border-color: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));

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
    transform: scale(0.92);
  }

  &.is-clicked:hover {
    .nexus-bar__progress-text {
      opacity: 1;
      transform: none;
    }

    .nexus-bar__progress-icon {
      opacity: 0;
      transform: translateY(4px);
      animation: none;
    }
  }
}

.nexus-bar__progress-text {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.nexus-bar__progress-icon {
  position: absolute;
  opacity: 0;
  transform: translateY(4px);
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
  transform: scale(0.8);
}

// ---- 博主信息卡片 ----
.nexus-bar__owner-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.25rem 0;
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

.nexus-bar__owner-quote {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
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

// ---- 在线状态 Tooltip 内容 ----
.nexus-bar__presence-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0;
}

.nexus-bar__presence-tip-status {
  font-weight: 600;
  font-size: 0.8125rem;
}

.nexus-bar__presence-tip-sig {
  font-size: 0.75rem;
  color: var(--text-soft);
  opacity: 0.85;
}

.nexus-bar__presence-tip-since {
  font-size: 0.6875rem;
  color: var(--text-muted);
  opacity: 0.65;
}

// ---- 登录按钮（始终显示） ----
.nexus-bar__login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: $radius-sm;
  color: var(--text-soft);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: $transition-fast;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &:active {
    transform: scale(0.92);
  }
}
</style>
