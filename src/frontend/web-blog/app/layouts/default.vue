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
      <p v-if="pagePending" data-page-motion-status class="page-motion-status" role="status">正在加载内容…</p>
    </div>
  </ThemeComponent>
  <ThemeComponent name="ThemeAccessory" />
  <CommonAppearanceDrawer />
  <LayoutMobileNav />
</template>

<script setup lang="ts">
import { isPageRequestCancellation } from '~/utils/pageRequestCancellation'

// 仅终止已销毁页面的初始化；真实网络、渲染和业务错误继续交给Nuxt错误边界。
onErrorCaptured((error) => {
  if (isPageRequestCancellation(error)) return false
})

const { settings: siteSettings } = useSiteSettings()
const pageHost = ref<HTMLElement | null>(null)
const { pending: pagePending } = usePageMotion(pageHost)

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
.page-motion-status {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  padding: 0.375rem 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-full;
  color: var(--text-soft);
  font-size: 0.8125rem;
  pointer-events: none;
}
</style>
