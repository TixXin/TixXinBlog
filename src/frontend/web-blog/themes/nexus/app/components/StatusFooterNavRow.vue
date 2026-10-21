<!--
  @file StatusFooterNavRow.vue
  @description Nexus 底栏收起态导航行：主题与外观操作、站点导航与环形滚动进度
  @author TixXin
  @since 2026-04-21
-->

<template>
  <div class="nexus-bar__row-nav" @focusin="$emit('focusin')">
    <div class="nexus-bar__actions">
      <BlogThemeSwitcher />
      <BlogAppearanceEntry />
    </div>
    <div class="nexus-bar__separator" aria-hidden="true" />
    <nav id="site-navigation" class="nexus-bar__nav" :aria-label="$t('theme.shell.siteNav')">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :target="item.newTab ? '_blank' : undefined"
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
        :aria-label="
          $t(scrollDirection === 'down' ? 'theme.nexus.statusBar.progressDown' : 'theme.nexus.statusBar.progressUp', {
            progress: displayProgress,
          })
        "
        @click="onProgressClick"
      >
        <svg class="nexus-bar__progress-ring" viewBox="0 0 36 36">
          <circle class="nexus-bar__progress-ring-bg" cx="18" cy="18" r="16" />
          <circle
            class="nexus-bar__progress-ring-fill"
            cx="18"
            cy="18"
            r="16"
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
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'focusin'): void
}>()

const route = useRoute()
const { navItems } = useNavItems()
const { scrollProgress, scrollResetFn, scrollDirection } = useScrollProgress()

const showProgress = computed(() => scrollProgress.value > 1)
const displayProgress = computed(() => Math.round(scrollProgress.value))

// 环形进度条 dashoffset 计算（与 SVG circle r=16 保持一致）
const RING_CIRCUMFERENCE = 2 * Math.PI * 16
const progressRingOffset = computed(() => RING_CIRCUMFERENCE * (1 - scrollProgress.value / 100))

function isActive(to: string) {
  const path = route.path.replace(/\/$/, '') || '/'
  const target = to.replace(/\/$/, '') || '/'
  return path === target || (target !== '/' && path.startsWith(target + '/'))
}

function onProgressClick() {
  scrollResetFn.value?.()
}
</script>

<style lang="scss" scoped>
.nexus-bar__row-nav {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: var(--bar-divider-gap);
  transition: opacity 0.12s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  :global(.nexus-bar.is-expanded) & {
    opacity: 0;
    pointer-events: none;
  }
}

.nexus-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--bar-divider-gap);
  flex-shrink: 0;
  width: calc(
    var(--bar-pivot-left) - var(--bar-avatar-pad) - var(--bar-action-size) - var(--bar-flex-gap) - var(
        --bar-divider-gap
      )
  );

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

.nexus-bar__separator {
  width: 1px;
  height: 1.5rem;
  flex-shrink: 0;
  background: var(--border-soft);
  opacity: 0.8;
}

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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &.is-active {
    color: var(--accent-text);
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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.2s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
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
  stroke-dasharray: 100.53;
  transition: stroke-dashoffset 0.3s cubic-bezier(0.22, 0.68, 0.35, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-bar__progress-icon {
  position: absolute;
  opacity: 0;
  color: var(--accent-text);
  transform: translateY(3px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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

.nexus-progress-fade-enter-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-progress-fade-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-progress-fade-enter-from,
.nexus-progress-fade-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}
</style>
