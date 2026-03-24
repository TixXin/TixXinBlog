<!--
  @file ClassicLayout.vue
  @description 经典三栏布局主题：左侧导航栏 + 中间主内容 + 右侧信息栏
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-classic">
    <div class="blog-grid">
      <aside class="aside-left anim-fade-in-up anim-delay-1">
        <CommonCustomScrollbar :show-back-to-top="false" class="aside-left__scroll" viewport-class="aside-left__viewport">
          <LayoutSidebarNav>
            <template #footer>
              <BlogThemeSwitcher />
              <BlogAppearanceEntry />
            </template>
          </LayoutSidebarNav>
          <BlogSubscribeCard />
        </CommonCustomScrollbar>
      </aside>

      <div class="page-columns anim-fade-in-up anim-delay-2">
        <main class="main-content">
          <NuxtPage :transition="contentTransition" />
        </main>
        <aside class="aside-right">
          <CommonCustomScrollbar
            :show-back-to-top="false"
            class="aside-right__scroll"
            viewport-class="aside-right__viewport"
          >
            <div id="right-sidebar-target" :class="sidebarAnimationClass" />
          </CommonCustomScrollbar>
        </aside>
      </div>
    </div>

    <div class="footer-row">
      <LayoutStatusFooter class="anim-fade-in-up anim-delay-5" />
    </div>

    <!-- 移动端浮动设置按钮（桌面端由侧栏导航卡片底部按钮替代） -->
    <div class="classic-mobile-fab">
      <BlogAppearanceEntry />
    </div>
    <CommonAppearanceDrawer />
    <LayoutMobileNav />
  </div>
</template>

<script setup lang="ts">
const {
  contentTransitionName,
  contentTransitionDuration,
  sidebarAnimationClass,
} = useAppearanceSettings()

useSidebarExitAnimation('.aside-right')

const contentTransition = computed(() => ({
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
}))
</script>

<style lang="scss" scoped>
.classic-mobile-fab {
  position: fixed;
  top: calc(1rem + env(safe-area-inset-top));
  right: 1rem;
  z-index: 82;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card-hover);
  }

  @media (min-width: $breakpoint-lg) {
    display: none;
  }
}
</style>
