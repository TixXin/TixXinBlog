<!--
  @file default.vue
  @description 博客默认布局，稳定持有页面实例并将主题差异壳层委托给主题引擎渲染；
               提供跳转链接，并在客户端路由切换完成后把焦点移到主内容容器 #main-content
  @author TixXin
  @since 2026-04-03
-->

<template>
  <!-- eslint-disable vue/no-multiple-template-root -- 抽屉与移动导航是全局覆盖层,
       有意与主题壳层平级挂载,避免被主题布局的层叠上下文裁剪;本布局未使用过渡,多根安全 -->
  <!-- 跳转链接放在最前，保证三主题首个 Tab 即可到达 -->
  <LayoutSkipLinks />
  <ThemeComponent name="RootLayout">
    <div ref="pageHost" class="page-motion-host">
      <CommonRequestFeedback
        v-if="siteError"
        data-page-motion-status
        compact
        :pending="sitePending"
        :title="siteError"
        :description="$t('layout.site.staleNotice')"
        @retry="refreshSite()"
      />
      <NuxtPage :transition="false" />
    </div>
  </ThemeComponent>
  <ThemeComponent name="ThemeAccessory" />
  <!-- 覆盖层与移动导航保持同步水合：延迟水合会让文章页等页面的后续节点对不上 SSR 输出 -->
  <CommonAppearanceDrawer />
  <LayoutMobileNav />
</template>

<script setup lang="ts">
const { error: siteError, pending: sitePending, refresh: refreshSite } = useSiteSettings()
const pageHost = ref<HTMLElement | null>(null)
// 切页期间旧内容保持可见、可操作，不再显示"正在加载内容"提示；加载进度由顶部进度条承担
usePageMotion(pageHost)

const route = useRoute()
useRouteFocus()
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

/**
 * 客户端路由切换完成后把焦点移到主内容，让键盘与读屏用户从新页面开头继续。
 * 首屏、同路径（筛选/分页/灯箱）与带 hash 的锚点跳转不处理；
 * 正在输入、已有弹窗或页面自身已移动焦点（搜索结果、标题焦点恢复）时不抢焦点。
 */
function useRouteFocus() {
  if (import.meta.server) return
  const router = useRouter()
  const app = useNuxtApp()
  let pending = false
  let origin: Element | null = null
  let expire: ReturnType<typeof setTimeout> | undefined
  const editable = (element: Element | null) =>
    !!element?.matches('input,textarea,select,[contenteditable=""],[contenteditable="true"]')
  const disposers = [
    router.beforeEach(() => {
      origin = document.activeElement
    }),
    router.afterEach((to, from, failure) => {
      if (failure || to.path === from.path || to.hash) return
      pending = true
      clearTimeout(expire)
      // 页面完成信号缺失时不在之后的无关时机移动焦点
      expire = setTimeout(() => (pending = false), 5000)
    }),
    app.hook('page:finish', async () => {
      if (!pending) return
      await nextTick()
      requestAnimationFrame(() => {
        if (!pending) return
        pending = false
        clearTimeout(expire)
        const active = document.activeElement
        const main = document.getElementById('main-content')
        if (!main || editable(active) || document.querySelector('[aria-modal="true"]')) return
        if (active && active !== document.body && active !== origin && active.isConnected) return
        main.focus({ preventScroll: true })
      })
    }),
  ]
  onBeforeUnmount(() => {
    clearTimeout(expire)
    disposers.forEach((dispose) => dispose())
  })
}
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
