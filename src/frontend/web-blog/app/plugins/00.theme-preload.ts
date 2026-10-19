/**
 * @file 00.theme-preload.ts
 * @description 只预加载当前主题，保证水合可同步取组件，可选主题留到用户请求时加载
 * @author TixXin
 * @since 2026-04-10
 */
import { preloadLayoutTheme } from '~/utils/themeRuntime'

export default defineNuxtPlugin({
  name: 'theme-preload',
  enforce: 'pre',
  async setup(nuxtApp) {
    const { currentTheme } = useThemeEngine()
    const startupError = useState<string | null>('theme-startup-error', () => null)
    const startupContent = useState<string | null>('theme-startup-content', () => null)
    // 首屏进度的真实里程碑：主题组件逐个就绪推进到 60，挂载前 75，Suspense 解析由 app.vue 拉满
    const progress = import.meta.client ? useLoadingProgress() : null
    progress?.set(10)
    nuxtApp.hook('app:beforeMount', () => progress?.set(75))
    try {
      await preloadLayoutTheme(currentTheme.value, (done, total) => progress?.set(10 + (50 * done) / total))
      startupError.value = null
    } catch {
      // 交给可操作的组件错误态和独立启动守卫恢复，不让首屏品牌层无限等待。
      // 这里只记录失败标记（字典 key）：插件早于 i18n 就绪，文案由 ThemeLoadError 按当前语言渲染。
      startupError.value = 'layout.themeError.failed'
      if (import.meta.client) {
        // 保留本站已完成净化的SSR正文；交互控件禁用，链接仍可原生导航。
        const content = document.querySelector('main')?.cloneNode(true) as HTMLElement | undefined
        content?.querySelectorAll('button,input,textarea,select').forEach((node) => node.setAttribute('disabled', ''))
        startupContent.value = content?.outerHTML ?? null
      }
    }
  },
})
