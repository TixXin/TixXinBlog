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
          <Transition name="sidebar-slide-left" mode="out-in">
            <!-- 默认模式：博主名片、公告、统计 -->
            <div v-if="!isMomentsMode" key="default" class="aside-left__group">
              <OwnerProfileCard />
              <SiteAnnouncementCard />
              <SidebarSiteStatsCard :stats="siteStats" />
              <DailyQuoteCard />
              <SidebarFooterCard />
            </div>
            <!-- 朋友圈模式：作者名片、动态日历 -->
            <div v-else key="moments" class="aside-left__group">
              <SidebarMomentAuthorCard :stats="momentAuthorStats" />
              <SidebarMomentCalendarCard
                :moment-dates="momentDates"
                :selected-date="selectedDate"
                @select-date="onDateSelect"
              />
              <DailyQuoteCard />
              <SidebarFooterCard />
            </div>
          </Transition>
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
            <!-- 骨架屏占位：SSR 与 hydration 前显示，Teleport 成功后由 CSS 自动隐藏 -->
            <div class="aside-right__skeleton" aria-hidden="true">
              <div class="aside-right__skeleton-card">
                <div class="aside-right__skeleton-line aside-right__skeleton-line--title" />
                <div class="aside-right__skeleton-tags">
                  <span v-for="i in 6" :key="i" class="aside-right__skeleton-tag" />
                </div>
              </div>
              <div class="aside-right__skeleton-card">
                <div class="aside-right__skeleton-line aside-right__skeleton-line--title" />
                <div class="aside-right__skeleton-line" />
                <div class="aside-right__skeleton-line aside-right__skeleton-line--short" />
                <div class="aside-right__skeleton-line" />
                <div class="aside-right__skeleton-line aside-right__skeleton-line--short" />
              </div>
            </div>
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
import { mockMomentAuthorStats, mockMoments } from '~/features/moment/mock'
import OwnerProfileCard from './OwnerProfileCard.vue'
import SiteAnnouncementCard from './SiteAnnouncementCard.vue'
import DailyQuoteCard from './DailyQuoteCard.vue'
import SidebarFooterCard from './SidebarFooterCard.vue'

const siteStats = mockSiteStats
const momentAuthorStats = mockMomentAuthorStats
const { sidebarAnimationClass } = useAppearanceSettings()
useSidebarExitAnimation('.aside-right')

// 监听首页 Tab 状态，切换左侧栏内容
const { homeActiveTab } = useHomeTab()
const isMomentsMode = computed(() => homeActiveTab.value === 'moments')

// 朋友圈日历数据（通过 composable 与 index.vue 共享 selectedDate）
const { selectedDate } = useMomentFilters()
const momentDates = computed(() => mockMoments.map((m) => m.date.slice(0, 10)))

function onDateSelect(date: string | null) {
  selectedDate.value = date
}
</script>

<style lang="scss" scoped>
.theme-nexus {
  --theme-bg-surface: var(--surface-1);
  --theme-bg-surface-elevated: var(--surface-2);
  --theme-bg-surface-sunken: var(--surface-3);
  --theme-border-default: var(--border);
  --theme-border-subtle: var(--border-soft);
}

/* ---- 右侧栏骨架屏占位 ---- */
/* 默认显示；当 Teleport 目标非空（即真实内容到位）时由兄弟选择器隐藏 */
.aside-right__skeleton {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 关键选择器：Teleport 成功后 #right-sidebar-target 有子节点，:empty 失效，骨架屏被隐藏 */
#right-sidebar-target:not(:empty) + .aside-right__skeleton {
  display: none;
}

.aside-right__skeleton-card {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  box-shadow: var(--shadow-card);
}

.aside-right__skeleton-line {
  height: 0.625rem;
  width: 100%;
  border-radius: $radius-sm;
  background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%);
  background-size: 200% 100%;
  animation: aside-skeleton-shimmer 1.6s ease-in-out infinite;

  &--title {
    width: 40%;
    height: 0.875rem;
    margin-bottom: 0.25rem;
  }

  &--short {
    width: 60%;
  }
}

.aside-right__skeleton-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.aside-right__skeleton-tag {
  display: inline-block;
  width: 3.5rem;
  height: 1.25rem;
  border-radius: $radius-full;
  background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%);
  background-size: 200% 100%;
  animation: aside-skeleton-shimmer 1.6s ease-in-out infinite;

  &:nth-child(2) {
    width: 4.5rem;
  }
  &:nth-child(3) {
    width: 2.5rem;
  }
  &:nth-child(4) {
    width: 5rem;
  }
  &:nth-child(5) {
    width: 3rem;
  }
  &:nth-child(6) {
    width: 4rem;
  }
}

@keyframes aside-skeleton-shimmer {
  0%,
  100% {
    background-position: 200% 0;
  }
  50% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aside-right__skeleton-line,
  .aside-right__skeleton-tag {
    animation: none;
  }
}

/* ---- 左侧栏内容组 ---- */
.aside-left__group {
  display: flex;
  flex-direction: column;
  gap: $grid-gap;
}

/* ---- 左侧栏切换动画：slide-left ---- */
.sidebar-slide-left-enter-active {
  transition: all 0.25s ease-out;
}

.sidebar-slide-left-leave-active {
  transition: all 0.2s ease-in;
}

.sidebar-slide-left-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.sidebar-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
