<!--
  @file app.vue
  @description Nuxt 应用根组件，挂载布局（NuxtPage 已移入 layouts/default.vue 以实现卡片持久化）
  @author TixXin
  @since 2025-03-17
-->

<template>
  <!-- 浏览器顶部加载进度条：NProgress 风格，与中央百分比共享 useLoadingProgress -->
  <CommonAppLoadingTopBar />
  <CommonAppLoadingScreen :visible="isLoading" />
  <!-- 布局主题切换以非阻断状态提示反馈真实加载过程 -->
  <CommonAppLoadingScreen :visible="isThemeSwitchLoading" force-visible />
  <!-- 客户端路由切换后向读屏播报新页面标题 -->
  <NuxtRouteAnnouncer />
  <NuxtLayout />
  <ClientOnly>
    <CommonToastContainer />
    <CommonSearchModal v-model:visible="isSearchOpen" />
    <AuthModal />
    <!-- Dev 调试面板：仅 dev 模式渲染，prod 构建被 DevOnly 整段 tree-shake -->
    <DevOnly>
      <DevDebugPanel />
    </DevOnly>
  </ClientOnly>
</template>

<script setup lang="ts">
import { getAppManifest } from '#app/composables/manifest'
import { hasColorMotion, runColorMotion } from '~/utils/colorMotion'
import { isPageRequestCancellation } from '~/utils/pageRequestCancellation'
import { twitterHandle } from '~/utils/absoluteUrl'

// 根边界在旧布局卸载后仍存在；只消费有所有者标记的取消，真实错误继续交给 Nuxt。
onErrorCaptured((error) => {
  if (isPageRequestCancellation(error)) return false
})

const colorMode = useColorMode()
watch(
  () => colorMode.value,
  () => {
    if (import.meta.client && colorMode.preference === 'system' && !hasColorMotion(document)) {
      runColorMotion({ doc: document, preset: 'instant', apply: () => {} })
    }
  },
  { flush: 'sync' },
)
const { settings: siteSettings } = useSiteSettings()
const route = useRoute()
const siteUrl = useSiteUrl()
const defaultShareImage = useDefaultShareImage()
const siteTwitter = computed(() => twitterHandle(siteSettings.value.socials))
const siteDescription = computed(() => siteSettings.value.seoDescription || siteSettings.value.description || undefined)
useHead({
  htmlAttrs: { lang: 'zh-CN' },
  titleTemplate: (title) =>
    title && title !== siteSettings.value.name ? `${title} - ${siteSettings.value.name}` : siteSettings.value.name,
})
// 全站分享兜底：页面通过 usePageSeo 覆盖；canonical 与 og:url 只取路径，查询参数不进入规范地址
useSeoMeta({
  ogSiteName: () => siteSettings.value.name,
  description: () => siteDescription.value,
  ogTitle: () => siteSettings.value.seoTitle || siteSettings.value.name,
  ogDescription: () => siteDescription.value,
  ogType: 'website',
  ogUrl: () => siteUrl + route.path,
  ogImage: () => defaultShareImage.value?.url,
  ogImageAlt: () => defaultShareImage.value?.alt,
  twitterCard: 'summary',
  twitterSite: () => siteTwitter.value,
  twitterCreator: () => siteTwitter.value,
})
useHead(() => ({
  link: [
    { key: 'canonical', rel: 'canonical', href: siteUrl + route.path },
    { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
    { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${siteSettings.value.name} RSS`, href: '/rss.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${siteSettings.value.name} 闪念 RSS`, href: '/flash.xml' },
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${siteSettings.value.name} 朋友圈 RSS`,
      href: '/moments.xml',
    },
  ],
  meta: [
    { key: 'theme-color-light', name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ebeff4' },
    { key: 'theme-color-dark', name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#23272f' },
  ],
}))
const isSearchOpen = ref(false)
const searchController = { open: () => (isSearchOpen.value = true) }
provide('searchModal', searchController)
// 根组件不能inject自己provide的值，快捷键直接复用同一控制器。
useKeyboardShortcuts(searchController)
useAnalytics()

// 首次访问 loading 动画状态 + 布局主题切换 loading 状态
const { isLoading, isThemeSwitchLoading, checkFirstVisit, dismiss } = useAppLoading()
// 首屏加载进度：由 00.theme-preload 等真实里程碑推进，这里只负责拉满
const { finish: finishProgress, reset: resetProgress } = useLoadingProgress()

// 内容就绪即解除首屏等待：直接挂在 Suspense 解析上，不再经 requestIdleCallback 多等一拍
if (import.meta.client) {
  useNuxtApp().hook('app:suspense:resolve', () => {
    if (checkFirstVisit()) finishProgress()
    else resetProgress()
    dismiss()
    document.documentElement.classList.add('app-client-ready')
    window.dispatchEvent(new Event('blog:ready'))
    // 首次客户端切页前 Nuxt 要先读取应用清单核对路由规则；就绪后立即预取，别让它排在第一次点击的路径上
    void getAppManifest().catch(() => {})
  })
}
</script>
