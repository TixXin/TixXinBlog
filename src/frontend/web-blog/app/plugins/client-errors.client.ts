/**
 * @file client-errors.client.ts
 * @description 浏览器全局错误入口；应用卸载或热更新时释放监听，开发环境仅打印脱敏详情
 */
import { bindClientErrorHandlers, createClientErrorReporter } from '~/features/client-error/reporter'

export default defineNuxtPlugin({
  name: 'client-errors',
  enforce: 'pre',
  setup(app) {
    const reporter = createClientErrorReporter({
      development: import.meta.dev,
      getUrl: () => window.location.href,
      fetch: (...args) => window.fetch(...args),
      print: (report) => {
        // 开发错误保留在本机控制台，不发送到后端。
        // eslint-disable-next-line no-console
        console.error('[client-error]', report)
      },
    })
    const dispose = bindClientErrorHandlers(app.vueApp, window, reporter)
    app.vueApp.onUnmount(dispose)
    if (import.meta.hot) import.meta.hot.dispose(dispose)
  },
})
