/**
 * @file modal-focus-origin.client.ts
 * @description 应用拥有一次模态入口监听；卸载和热更新释放，不随弹窗或主题切换累积
 * @author TixXin
 * @since 2026-09-08
 */
import { bindModalFocusOrigin } from '~/utils/modalFocusOrigin'

export default defineNuxtPlugin((app) => {
  const dispose = bindModalFocusOrigin(document)
  app.vueApp.onUnmount(dispose)
  if (import.meta.hot) import.meta.hot.dispose(dispose)
})
