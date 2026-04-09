<!--
  @file RootLayout.vue
  @description Nexus 三栏布局主题：左侧信息栏 + 中间主内容 + 右侧侧边栏，底部导航栏
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-nexus">
    <div class="blog-grid">
      <aside class="aside-left anim-fade-in-up anim-delay-1">
        <CommonCustomScrollbar
          :show-back-to-top="false"
          class="aside-left__scroll"
          viewport-class="aside-left__viewport"
        >
          <SidebarSiteStatsCard :stats="siteStats" />
          <BlogSubscribeCard />
          <SidebarFooterCard />
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
      <ThemeComponent name="StatusFooter" class="footer-row__content anim-fade-in-up anim-delay-5" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { mockSiteStats } from '~/features/stats/mock'
import SidebarFooterCard from './SidebarFooterCard.vue'

const siteStats = mockSiteStats
const { sidebarAnimationClass } = useAppearanceSettings()
</script>

<style lang="scss" scoped>
.theme-nexus {
  --theme-bg-surface: var(--surface-1);
  --theme-bg-surface-elevated: var(--surface-2);
  --theme-bg-surface-sunken: var(--surface-3);
  --theme-border-default: var(--border);
  --theme-border-subtle: var(--border-soft);
}
</style>
