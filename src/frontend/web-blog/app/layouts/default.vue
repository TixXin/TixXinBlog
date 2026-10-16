<!--
  @file default.vue
  @description 博客默认布局，稳定持有页面实例并将主题差异壳层委托给主题引擎渲染
  @author TixXin
  @since 2026-04-03
-->

<template>
  <!-- eslint-disable vue/no-multiple-template-root -- 抽屉与移动导航是全局覆盖层,
       有意与主题壳层平级挂载,避免被主题布局的层叠上下文裁剪;本布局未使用过渡,多根安全 -->
  <ThemeComponent name="RootLayout">
    <CommonSiteAnnouncement :content="siteSettings.announcement" :date="siteSettings.announcementUpdatedAt" />
    <div ref="pageHost" class="page-motion-host">
      <NuxtPage :transition="false" />
    </div>
  </ThemeComponent>
  <ThemeComponent name="ThemeAccessory" />
  <CommonAppearanceDrawer />
  <LayoutMobileNav />
</template>

<script setup lang="ts">
const { settings: siteSettings } = useSiteSettings()
const pageHost = ref<HTMLElement | null>(null)
// 切页期间旧内容保持可见、可操作，不再显示"正在加载内容"提示；加载进度由顶部进度条承担
usePageMotion(pageHost)

const route = useRoute()
const { enable: enableFullbleed, disable: disableFullbleed } = useFullbleedPage()

// 跟随Nuxt已解析的页面元信息；无动画、首次SSR和历史导航也执行，不能依赖过渡钩子。
watch(
  () => route.meta.fullbleed,
  () => {
    if (route.meta.fullbleed) enableFullbleed()
    else disableFullbleed()
  },
  { immediate: true, flush: 'sync' },
)
</script>
<style lang="scss" scoped>
.page-motion-host {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
}
</style>
