/**
 * @file sidebar-teleport.server.ts
 * @description 把页面 Teleport 到右侧栏的 SSR 内容注入布局挂载点，首屏无需等水合即可显示侧栏
 * @author TixXin
 * @since 2026-10-16
 */

// Nuxt 只为 #teleports 与 body 注入 SSR Teleport 内容；右侧栏挂载点由主题布局渲染，这里补齐同样的注入。
const TARGET_ID = 'right-sidebar-target'
// 挂载点必须是空的 <div>，id 可位于任意属性位置
const TARGET_PATTERN = new RegExp(`(<div\\b[^>]*\\bid="${TARGET_ID}"[^>]*>)(</div>)`)

export default defineNuxtPlugin({
  name: 'sidebar-teleport',
  setup(nuxtApp) {
    nuxtApp.hook('app:rendered', ({ ssrContext, renderResult }) => {
      const content = ssrContext?.teleports?.[`#${TARGET_ID}`]
      if (!content || !renderResult) return
      // 用回调插入，避免内容里的 `$&`、`$'` 等被 String.replace 当作替换模式解释
      renderResult.html = renderResult.html.replace(
        TARGET_PATTERN,
        (_match, open: string, close: string) => open + content + close,
      )
    })
  },
})
