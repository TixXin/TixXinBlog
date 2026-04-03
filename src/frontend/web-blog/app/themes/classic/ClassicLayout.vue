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
          <slot />
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
  </div>
</template>

<script setup lang="ts">
const { sidebarAnimationClass } = useAppearanceSettings()

useSidebarExitAnimation('.aside-right')
</script>
