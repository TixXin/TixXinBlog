/**
 * @file i18n.ts
 * @description 单测全局注入界面语言：@vue/test-utils 直接 mount 的组件共用 Nuxt 测试应用的 i18n（默认 zh-CN）
 * @author TixXin
 * @since 2026-10-19
 */
import { config } from '@vue/test-utils'
import type { App, Plugin } from 'vue'

type I18nApp = App & { __VUE_I18N_SYMBOL__?: symbol }

/** vue-i18n 与 @nuxtjs/i18n 挂到 globalProperties 上的模板辅助属性 */
const I18N_GLOBAL_PROPERTIES = [
  '$t',
  '$rt',
  '$d',
  '$n',
  '$tm',
  '$te',
  '$i18n',
  '$localePath',
  '$localeRoute',
  '$localeHead',
  '$switchLocalePath',
  '$getRouteBaseName',
  '$routeBaseName',
]

/**
 * 复用 Nuxt 测试应用里已安装的 vue-i18n，而不是对每个测试应用再 app.use 一次：
 * vue-i18n 安装时会改写 app.unmount，卸载测试组件会顺带 dispose 全局实例，影响后续用例。
 */
const sharedNuxtI18n: Plugin = {
  install(app: I18nApp) {
    const host = useNuxtApp().vueApp as I18nApp
    const symbol = host.__VUE_I18N_SYMBOL__
    if (!symbol || app.__VUE_I18N_SYMBOL__) return
    app.__VUE_I18N_SYMBOL__ = symbol
    app.provide(symbol, (host._context.provides as Record<symbol, unknown>)[symbol])
    for (const key of I18N_GLOBAL_PROPERTIES) {
      const descriptor = Object.getOwnPropertyDescriptor(host.config.globalProperties, key)
      if (descriptor) Object.defineProperty(app.config.globalProperties, key, descriptor)
    }
  },
}

config.global.plugins.push(sharedNuxtI18n)
