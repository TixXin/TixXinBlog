<!--
  @file StatusFooter.vue
  @description Nexus 底部导航栏：头像半悬浮 + 明暗/设置图标 + 水平导航 + 滚动进度
  @author TixXin
  @since 2026-04-09
-->

<template>
  <div class="nexus-bar">
    <!-- 头像：上半部分悬浮在栏外 -->
    <div class="nexus-bar__avatar-wrap" aria-hidden="true">
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
    </div>

    <!-- 操作图标：明暗切换 + 界面设置（无背景包裹） -->
    <div class="nexus-bar__actions">
      <BlogThemeSwitcher />
      <BlogAppearanceEntry />
    </div>

    <!-- 分隔线 -->
    <div class="nexus-bar__separator" aria-hidden="true" />

    <!-- 导航链接 -->
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

    <!-- 滚动进度百分比 -->
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
</template>

<script setup lang="ts">
const route = useRoute()
const { navItems } = useNavItems()
const { scrollProgress, scrollResetFn, scrollDirection } = useScrollProgress()

const avatarUrl =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12'

const avatarError = ref(false)
const progressClicked = ref(false)

const showProgress = computed(() => {
  // 进度已在 CustomScrollbar 中统一处理（聊天模式反转：底部=0，顶部=100）
  // 不在起始位置（普通页面顶部 / 聊天页面底部）时显示
  return scrollProgress.value > 1
})
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

// 滚动后重置点击状态
watch(scrollProgress, (val) => {
  if (progressClicked.value && val > 1) {
    progressClicked.value = false
  }
})
</script>

<style lang="scss" scoped>
.nexus-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 72px;
  padding: 0 1.25rem;
  padding-left: 6.5rem; // 给头像留空间
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  transition: background 0.3s ease;
  overflow: visible; // 允许头像溢出

  @media (max-width: #{$breakpoint-md - 0.02}) {
    display: none;
  }
}

// ---- 头像（半悬浮） ----
.nexus-bar__avatar-wrap {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-75%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--surface-1);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
  z-index: 1;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:hover {
    transform: translateY(-75%) scale(1.08);
  }
}

.nexus-bar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nexus-bar__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--surface-2);
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

// ---- 操作图标（无背景） ----
.nexus-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
}

// ---- 分隔线 ----
.nexus-bar__separator {
  width: 1px;
  height: 1.25rem;
  flex-shrink: 0;
  background: var(--border);
}

// ---- 导航链接 ----
.nexus-bar__nav {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nexus-bar__link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--text-main);
    background: var(--surface-3);
    font-weight: 600;
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
  padding: 0.25rem 0.5rem;
  border-radius: $radius-sm;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: var(--accent);
    background: var(--surface-2);

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
    transform: scale(0.95);
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
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}

// ---- 进度出现/消失动画 ----
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
</style>
