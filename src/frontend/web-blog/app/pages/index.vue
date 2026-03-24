<!--
  @file index.vue
  @description 博客首页，主内容区暂为空态提示，右侧栏仅展示站点统计
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner home-page">
    <CommonCustomScrollbar class="home-body">
      <CommonStateBlock
        icon="lucide:construction"
        title="页面建设中"
        description="主页内容正在设计，敬请期待..."
      />
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarSiteStatsCard :stats="siteStats" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockSiteStats } from '~/features/stats/mock'

const siteStats = mockSiteStats
</script>

<style lang="scss" scoped>
.home-page {
  display: flex;
  flex-direction: column;
}

.home-body {
  flex: 1;
  min-height: 0;
}
</style>
