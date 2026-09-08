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
  async setup() {
    const { currentTheme } = useThemeEngine()
    const startupError = useState<string | null>('theme-startup-error', () => null)
    const startupContent = useState<string | null>('theme-startup-content', () => null)
    const progress = import.meta.client ? useLoadingProgress() : null
    progress?.set(10)
    try {
      await preloadLayoutTheme(currentTheme.value)
      startupError.value = null
      progress?.set(60)
    } catch {
      // 交给可操作的组件错误态和独立启动守卫恢复，不让首屏品牌层无限等待。
      startupError.value = '当前主题暂时无法加载，请刷新重试。'
      if (import.meta.client) {
        // 保留本站已完成净化的SSR正文；交互控件禁用，链接仍可原生导航。
        const content = document.querySelector('main')?.cloneNode(true) as HTMLElement | undefined
        content?.querySelectorAll('button,input,textarea,select').forEach((node) => node.setAttribute('disabled', ''))
        startupContent.value = content?.outerHTML ?? null
      }
    }
  },
})
