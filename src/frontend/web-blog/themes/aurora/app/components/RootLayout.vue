<!--
  @file RootLayout.vue
  @description Aurora 双栏布局主题：Hero 视觉区域 + 动态毛玻璃顶栏 + 双栏内容
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-aurora">
    <header
      class="aurora-topbar"
      :class="{ 'aurora-topbar--scrolled': isScrolled, 'aurora-topbar--transparent': isHeroVisible }"
    >
      <div class="aurora-topbar__inner">
        <NuxtLink to="/" class="aurora-topbar__brand">
          <Icon name="lucide:pen-tool" size="20" />
          <span class="aurora-topbar__title">TixXin Blog</span>
        </NuxtLink>
        <nav class="aurora-topbar__nav">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="aurora-topbar__link"
            :class="{ active: isActive(item.to) }"
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
              aria-label="返回顶部"
              @click="onProgressClick"
            >
              <span class="aurora-scroll-progress__text">{{ displayProgress }}%</span>
              <Icon name="lucide:arrow-up" size="14" class="aurora-scroll-progress__icon" />
            </button>
          </Transition>
          <BlogThemeSwitcher />
          <BlogAppearanceEntry />
        </div>
      </div>
    </header>

    <CommonCustomScrollbar
      ref="scrollbarRef"
      :show-back-to-top="true"
      class="aurora-scroll-area"
      viewport-class="aurora-scroll-viewport"
    >
      <section v-if="isHomePage" class="aurora-hero">
        <div class="aurora-hero__bg" :style="heroParallaxStyle" />
        <div class="aurora-hero__inner">
          <h1 class="aurora-hero__title">TixXin Blog</h1>
          <p class="aurora-hero__subtitle">技术探索 · 项目实践 · 生活随笔</p>
        </div>
      </section>

      <div class="aurora-body">
        <main class="aurora-main">
          <div class="main-content">
            <slot />
          </div>
        </main>
        <aside class="aurora-aside">
          <CommonCustomScrollbar
            :show-back-to-top="false"
            class="aurora-aside__scroll"
            viewport-class="aurora-aside__viewport"
          >
            <div id="right-sidebar-target" :class="sidebarAnimationClass" />
          </CommonCustomScrollbar>
        </aside>
      </div>

      <footer class="aurora-footer">
        <ThemeComponent name="StatusFooter" />
      </footer>
    </CommonCustomScrollbar>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { navItems } = useNavItems()

function isActive(to: string) {
  return route.path === to
}

const isHomePage = computed(() => route.path === '/')

const { sidebarAnimationClass } = useAppearanceSettings()

useSidebarExitAnimation('.aurora-aside')

const scrollbarRef = ref<{
  viewport: HTMLElement | null
  scrollProgress: number
  scrollToTop: (smooth?: boolean) => void
} | null>(null)
const isScrolled = ref(false)
const scrollProgress = ref(0)
const scrollY = ref(0)

const isHeroVisible = computed(() => isHomePage.value && !isScrolled.value)

const heroParallaxStyle = computed(() => ({
  transform: `translateY(${scrollY.value * 0.4}px)`,
}))

const showProgress = computed(() => scrollProgress.value > 0)
const displayProgress = computed(() => Math.round(scrollProgress.value))

function onViewportScroll() {
  const viewport = scrollbarRef.value?.viewport
  if (!viewport) return
  scrollY.value = viewport.scrollTop
  isScrolled.value = viewport.scrollTop > 20
  scrollProgress.value = scrollbarRef.value?.scrollProgress ?? 0
}

const progressClicked = ref(false)

function scrollToTop() {
  scrollbarRef.value?.scrollToTop(true)
}

function onProgressClick() {
  progressClicked.value = true
  scrollToTop()
}

watch(showProgress, (val: boolean) => {
  if (!val) progressClicked.value = false
})

onMounted(() => {
  nextTick(() => {
    const viewport = scrollbarRef.value?.viewport
    if (viewport) {
      viewport.addEventListener('scroll', onViewportScroll, { passive: true })
      onViewportScroll()
    }
  })
})

onBeforeUnmount(() => {
  const viewport = scrollbarRef.value?.viewport
  viewport?.removeEventListener('scroll', onViewportScroll)
})
</script>

<style lang="scss" scoped>
.theme-aurora {
  height: 100vh;
  overflow: hidden;
  position: relative;

  --aurora-gradient-start: #667eea;
  --aurora-gradient-end: #764ba2;
  --aurora-hero-height: 40vh;
  --aurora-blur-strength: 16px;
  --aurora-topbar-bg: transparent;
  --aurora-topbar-bg-scrolled: var(--surface-1-alpha-90);
}

:global(.dark) .theme-aurora {
  --aurora-gradient-start: #1a1a2e;
  --aurora-gradient-end: #16213e;
}

// --- 顶栏 ---

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

  &--transparent {
    background: linear-gradient(135deg, var(--aurora-gradient-start), var(--aurora-gradient-end));
    backdrop-filter: none;
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

  .aurora-topbar--transparent & {
    color: #fff;
  }

  &:hover {
    color: var(--accent);
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
  justify-content: flex-end;
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
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition: $transition-fast;

  .aurora-topbar--transparent & {
    color: rgba(255, 255, 255, 0.8);

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
    }

    &.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.18);
    }
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

.aurora-topbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;

  .aurora-topbar--transparent & {
    color: rgba(255, 255, 255, 0.8);

    :deep(button),
    :deep(a) {
      color: rgba(255, 255, 255, 0.8);

      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
      }
    }
  }

  @media (min-width: $breakpoint-xl) {
    width: $sidebar-right-width;
  }
}

// --- Hero ---

.aurora-hero {
  position: relative;
  height: var(--aurora-hero-height);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: #{$breakpoint-md - 0.02}) {
    height: calc(var(--aurora-hero-height) / 2);
  }
}

.aurora-hero__bg {
  position: absolute;
  inset: -20%;
  background: linear-gradient(135deg, var(--aurora-gradient-start), var(--aurora-gradient-end));
  will-change: transform;
}

.aurora-hero__inner {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
}

.aurora-hero__title {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.75rem;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.2);

  @media (max-width: #{$breakpoint-md - 0.02}) {
    font-size: 1.75rem;
  }
}

.aurora-hero__subtitle {
  font-size: 1.125rem;
  font-weight: 400;
  opacity: 0.85;
  margin: 0;

  @media (max-width: #{$breakpoint-md - 0.02}) {
    font-size: 0.875rem;
  }
}

// --- 阅读进度按钮 ---

.aurora-scroll-progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  min-width: 2.75rem;
  border-radius: $radius-sm;
  border: none;
  background: transparent;
  transition:
    color 0.2s ease,
    background 0.2s ease;
  white-space: nowrap;

  &:hover {
    color: var(--accent);
    background: var(--surface-2);

    .aurora-scroll-progress__text {
      opacity: 0;
      transform: scale(0.6);
    }

    .aurora-scroll-progress__icon {
      opacity: 1;
      transform: translateY(0);
      animation: aurora-progress-bounce 0.6s ease infinite;
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
}

.aurora-scroll-progress__icon {
  position: absolute;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
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
}

.progress-fade-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
}

.progress-fade-enter-from,
.progress-fade-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

// --- 内容区 ---

.aurora-scroll-area {
  height: 100%;
}

:deep(.aurora-scroll-viewport) {
  padding-top: 3.5rem;
}

.aurora-body {
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  display: flex;
  gap: $grid-gap;
  min-height: calc(100vh - 3.5rem - 4rem);

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
    padding-bottom: 2rem;
  }
}

.aurora-main {
  flex: 1;
  min-width: 0;
  --post-card-min-h: 140px;
  --post-card-max-h: 190px;
}

.aurora-aside {
  display: none;
  position: relative;

  @media (min-width: $breakpoint-xl) {
    display: flex;
    flex-direction: column;
    width: $sidebar-right-width;
    flex-shrink: 0;
    position: sticky;
    top: 2rem;
    max-height: calc(100vh - 3.5rem - 6rem);
    overflow: visible;
  }
}

:deep(.aurora-aside__scroll) {
  @media (min-width: $breakpoint-xl) {
    height: 100%;
    overflow: visible !important;
  }
}

:deep(.aurora-aside__viewport) {
  @media (min-width: $breakpoint-xl) {
    padding: 2rem;
    margin: -2rem;
  }
}

.aurora-footer {
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

:deep(.back-to-top-enter-active) {
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out;
}

:deep(.back-to-top-leave-active) {
  transition:
    opacity 0.25s ease-in,
    transform 0.25s ease-in;
}

:deep(.back-to-top-enter-from),
:deep(.back-to-top-leave-to) {
  opacity: 0;
  transform: translateX(calc(100% + 20px));
}
</style>
