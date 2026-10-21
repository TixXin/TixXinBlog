<!--
  @file RootLayout.vue
  @description Aurora 双栏布局主题：Hero 视觉区域 + 动态毛玻璃顶栏 + 双栏内容
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-aurora">
    <RootLayoutTopbar
      :is-scrolled="isScrolled"
      :is-hero-visible="isHeroVisible"
      :show-progress="showProgress"
      :progress-clicked="progressClicked"
      :display-progress="displayProgress"
      @progress-click="onProgressClick"
    />

    <CommonCustomScrollbar
      ref="scrollbarRef"
      :show-back-to-top="false"
      class="aurora-scroll-area"
      viewport-class="aurora-scroll-viewport"
    >
      <RootLayoutHero :scroll-y="scrollY" :viewport="scrollbarRef?.viewport ?? null" />

      <div class="aurora-body">
        <main id="main-content" class="aurora-main" tabindex="-1">
          <div class="main-content">
            <!-- 本主题没有公告卡片，公告以横条形式放在内容区顶部 -->
            <CommonSiteAnnouncement :content="siteSettings.announcement" :date="siteSettings.announcementUpdatedAt" />
            <slot />
          </div>
        </main>
        <aside v-show="route.meta.rightSidebar !== false" class="aurora-aside">
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
import { resolveScrollRoot } from '~/utils/scrollRoot'
import RootLayoutTopbar from './RootLayoutTopbar.vue'
import RootLayoutHero from './RootLayoutHero.vue'

const { settings: siteSettings } = useSiteSettings()
const route = useRoute()
const { sidebarAnimationClass } = useAppearanceSettings()

const isHomePage = computed(() => route.path === '/' || route.path === '/moments')

const scrollbarRef = ref<{
  viewport: HTMLElement | null
  scrollProgress: number
  scrollToTop: (smooth?: boolean) => void
} | null>(null)
const isScrolled = ref(false)
const scrollProgress = ref(0)
const scrollY = ref(0)

const isHeroVisible = computed(() => isHomePage.value && scrollY.value < 100)
const showProgress = computed(() => scrollProgress.value > 0)
const displayProgress = computed(() => Math.round(scrollProgress.value))
const progressClicked = ref(false)

let scrollFrame = 0
function onViewportScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    updateViewportScroll()
  })
}

function updateViewportScroll() {
  const viewport = scrollbarRef.value?.viewport
  if (!viewport) return
  const root = resolveScrollRoot(viewport)
  const currentScrollTop = root?.scrollTop ?? window.scrollY
  scrollY.value = currentScrollTop
  isScrolled.value = currentScrollTop > 20
  const range = root
    ? root.scrollHeight - root.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight
  scrollProgress.value = range > 0 ? (currentScrollTop / range) * 100 : 0
}

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
  window.addEventListener('scroll', onViewportScroll, { passive: true })
  nextTick(() => {
    const viewport = scrollbarRef.value?.viewport
    if (viewport) {
      viewport.addEventListener('scroll', onViewportScroll, { passive: true })
      onViewportScroll()
    }
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('scroll', onViewportScroll)
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
      display: grid;
    }
  }
}

:deep(.back-to-top-enter-active) {
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

:deep(.back-to-top-leave-active) {
  transition:
    opacity 0.25s ease-in,
    transform 0.25s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

:deep(.back-to-top-enter-from),
:deep(.back-to-top-leave-to) {
  opacity: 0;
  transform: translateX(calc(100% + 20px));
}

/* ---- 低高度视口：压缩 Hero 与顶栏，把可视高度优先留给正文 ---- */
@media (max-height: 600px) {
  .theme-aurora {
    --aurora-hero-height: 26vh;
  }

  :deep(.aurora-topbar__inner) {
    height: 3rem;
    padding: 0 1.25rem;
  }

  .aurora-body {
    padding-top: 1rem;
    min-height: 0;
  }
}
</style>
