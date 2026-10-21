<!--
  @file RootLayoutTopbar.vue
  @description Aurora 主题顶栏：品牌、主导航、滚动阅读进度与快捷操作
  @author TixXin
  @since 2026-04-21
-->

<template>
  <header
    class="aurora-topbar"
    :class="{
      'aurora-topbar--scrolled': isScrolled,
      'aurora-topbar--transparent': isHeroVisible,
    }"
  >
    <div class="aurora-topbar__inner">
      <NuxtLink to="/" class="aurora-topbar__brand">
        <Icon name="lucide:pen-tool" size="20" />
        <span class="aurora-topbar__title">{{ siteSettings.name }}</span>
      </NuxtLink>
      <nav id="site-navigation" class="aurora-topbar__nav" :aria-label="$t('theme.shell.mainNav')">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :target="item.newTab ? '_blank' : undefined"
          class="aurora-topbar__link"
          :class="{ active: isActive(item.to) }"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" size="16" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <div class="aurora-topbar__actions">
        <Transition name="progress-fade">
          <button
            v-if="showProgress"
            class="aurora-scroll-progress"
            :class="{ 'is-clicked': progressClicked }"
            type="button"
            :aria-label="$t('theme.shell.backToTop')"
            @click="$emit('progress-click')"
          >
            <span class="aurora-scroll-progress__text">{{ displayProgress }}%</span>
            <Icon name="lucide:arrow-up" size="14" class="aurora-scroll-progress__icon" />
          </button>
        </Transition>
        <BlogThemeSwitcher />
        <BlogAppearanceEntry />
        <button
          class="aurora-topbar__login"
          type="button"
          :aria-label="$t('theme.shell.login')"
          @click="openLogin('login', true)"
        >
          <Icon name="lucide:circle-user" size="18" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  isScrolled: boolean
  isHeroVisible: boolean
  showProgress: boolean
  progressClicked: boolean
  displayProgress: number
}>()

defineEmits<{
  (e: 'progress-click'): void
}>()

const { settings: siteSettings } = useSiteSettings()
const route = useRoute()
const { navItems } = useNavItems()
const { open: openLogin } = useLoginDrawer()

function isActive(to: string) {
  const path = route.path.replace(/\/$/, '') || '/'
  if (path === to) return true
  if (to === '/' && path === '/moments') return true
  return false
}
</script>

<style lang="scss" scoped>
.aurora-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  background: var(--aurora-topbar-bg-scrolled);
  backdrop-filter: blur(var(--aurora-blur-strength));
  border-bottom: 1px solid var(--border-soft);
  transition:
    width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
    max-width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-radius 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
    box-shadow 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
    background-color 0.4s ease,
    border-color 0.4s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &--transparent {
    background: var(--aurora-topbar-bg-scrolled);
    backdrop-filter: blur(var(--aurora-blur-strength));
    border-bottom-color: transparent;
  }

  &--scrolled {
    width: calc(100% - 4rem);
    max-width: calc(#{$container-max-width} - 4rem);
    border-bottom-left-radius: $radius-card;
    border-bottom-right-radius: $radius-card;
    border-bottom-color: transparent;
    box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.12);
    background: var(--aurora-topbar-bg-scrolled);
    backdrop-filter: blur(var(--aurora-blur-strength));
  }
}

.aurora-topbar__inner {
  max-width: $container-max-width;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 2rem;
  height: 3.5rem;
}

.aurora-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-main);
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
  }
}

.aurora-topbar__title {
  @media (max-width: #{$breakpoint-sm - 0.02}) {
    display: none;
  }
}

.aurora-topbar__nav {
  display: none;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;

  @media (min-width: $breakpoint-md) {
    display: flex;
  }
}

.aurora-topbar__link {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:first-child {
    margin-left: auto;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.active {
    color: var(--accent-text);
    background: var(--accent-soft);
  }
}

.aurora-topbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;

  @media (min-width: $breakpoint-xl) {
    width: $sidebar-right-width;
  }
}

.aurora-topbar__login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--surface-2);
    border-color: var(--accent-alpha-20, rgba(99, 102, 241, 0.15));
  }

  &:active {
    transform: scale(0.92);
  }
}

.aurora-scroll-progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  padding: 0.25rem 0.5rem;
  min-width: 2.75rem;
  border-radius: $radius-sm;
  border: none;
  background: transparent;
  transition:
    color 0.2s ease,
    background 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  white-space: nowrap;

  &:hover {
    color: var(--accent-text);
    background: var(--surface-2);

    .aurora-scroll-progress__text {
      opacity: 0;
      transform: scale(0.6);
    }

    .aurora-scroll-progress__icon {
      opacity: 1;
      transform: translateY(0);
      animation: aurora-progress-bounce 0.6s ease infinite;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-clicked:hover {
    .aurora-scroll-progress__text {
      opacity: 1;
      transform: none;
    }

    .aurora-scroll-progress__icon {
      opacity: 0;
      transform: translateY(4px);
      animation: none;
    }
  }
}

.aurora-scroll-progress__text {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.aurora-scroll-progress__icon {
  position: absolute;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

@keyframes aurora-progress-bounce {
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

.progress-fade-enter-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.progress-fade-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.progress-fade-enter-from,
.progress-fade-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>
