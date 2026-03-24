<!--
  @file DocsLayout.vue
  @description 双栏文档风格布局主题：顶部导航栏 + 宽内容区 + 可选右侧栏
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-docs">
    <header class="docs-topbar anim-fade-in-up" :class="{ 'docs-topbar--scrolled': isScrolled }">
      <div class="docs-topbar__inner">
        <NuxtLink to="/" class="docs-topbar__brand">
          <Icon name="lucide:pen-tool" size="20" />
          <span class="docs-topbar__title">TixXin Blog</span>
        </NuxtLink>
        <nav class="docs-topbar__nav">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="docs-topbar__link"
            :class="{ active: isActive(item.to) }"
          >
            <Icon :name="item.icon" size="16" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <div class="docs-topbar__actions">
          <BlogThemeSwitcher />
          <BlogAppearanceEntry />
          <CommonAppearanceDrawer />
        </div>
      </div>
    </header>

    <div class="docs-body anim-fade-in-up anim-delay-2">
      <main class="docs-main">
        <div class="main-content">
          <NuxtPage :transition="contentTransition" />
        </div>
      </main>
      <aside class="docs-aside">
        <CommonCustomScrollbar
          :show-back-to-top="false"
          class="docs-aside__scroll"
          viewport-class="docs-aside__viewport"
        >
          <div id="right-sidebar-target" :class="sidebarAnimationClass" />
        </CommonCustomScrollbar>
      </aside>
    </div>

    <footer class="docs-footer">
      <LayoutStatusFooter />
    </footer>
    <LayoutMobileNav />
  </div>
</template>

<script setup lang="ts">
import { mockNavItems } from '~/features/nav/mock'

const route = useRoute()
const navItems = mockNavItems

function isActive(to: string) {
  return route.path === to
}

const {
  contentTransitionName,
  contentTransitionDuration,
  sidebarAnimationClass,
} = useAppearanceSettings()

useSidebarExitAnimation('.docs-aside')

const isScrolled = ref(false)

function onScroll() {
  isScrolled.value = window.scrollY > 20
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

const contentTransition = computed(() => ({
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
}))
</script>

<style lang="scss" scoped>
.docs-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
  transition:
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.3s ease,
    background-color 0.3s ease,
    border-color 0.3s ease;

  &--scrolled {
    width: calc(100% - 4rem);
    max-width: calc(#{$container-max-width} - 4rem);
    border-bottom-left-radius: $radius-card;
    border-bottom-right-radius: $radius-card;
    box-shadow: var(--shadow-card);
  }
}

.docs-topbar__inner {
  max-width: $container-max-width;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 2rem;
  height: 3.5rem;
}

.docs-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-main);
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
  transition: $transition-fast;

  &:hover {
    color: var(--accent);
  }
}

.docs-topbar__title {
  @media (max-width: #{$breakpoint-sm - 0.02}) {
    display: none;
  }
}

.docs-topbar__nav {
  display: none;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;

  @media (min-width: $breakpoint-lg) {
    display: flex;
  }
}

.docs-topbar__link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition: $transition-fast;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

.docs-topbar__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.docs-body {
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  gap: $grid-gap;
  min-height: calc(100vh - 3.5rem - 4rem);

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.docs-main {
  flex: 1;
  min-width: 0;
  --post-card-min-h: 140px;
  --post-card-max-h: 190px;
}

.docs-aside {
  display: none;
  position: relative;

  @media (min-width: $breakpoint-xl) {
    display: flex;
    flex-direction: column;
    width: $sidebar-right-width;
    flex-shrink: 0;
    position: sticky;
    top: calc(3.5rem + 2rem);
    max-height: calc(100vh - 3.5rem - 4rem);
    overflow: visible;
  }
}

:deep(.docs-aside__scroll) {
  @media (min-width: $breakpoint-xl) {
    height: 100%;
    overflow: visible !important;
  }
}

:deep(.docs-aside__viewport) {
  @media (min-width: $breakpoint-xl) {
    padding: 2rem;
    margin: -2rem;
  }
}

.docs-footer {
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 1rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 0 2rem 2rem;
  }

  :deep(.site-footer) {
    @media (min-width: $breakpoint-md) {
      display: flex;
    }
  }
}
</style>
