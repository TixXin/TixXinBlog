/**
 * @file themeComponentCache.ts
 * @description 客户端共享、生产服务端进程级复用、开发服务端按请求隔离的主题缓存，避免 HMR 后 SSR 沿用旧组件
 * @author TixXin
 * @since 2026-04-10
 */

import type { Component } from 'vue'
import { useNuxtApp } from '#app'

/** 缓存键为 `${sourceTheme}:${componentName}`，值为已解析的 Vue 组件 */
const clientCache = new Map<string, Component>()
const serverCaches = new WeakMap<object, Map<string, Component>>()
/** 生产 SSR：主题组件是无状态模块定义，进程级缓存可避免每个请求重复走动态 import */
let productionServerCache: Map<string, Component> | null = null

export function getThemeComponentCache(): Map<string, Component> {
  if (import.meta.client) return clientCache
  if (!import.meta.dev) {
    productionServerCache ??= new Map<string, Component>()
    return productionServerCache
  }
  // 开发期按 NuxtApp（每请求）隔离：HMR 更新主题 SFC 后不能沿用旧组件
  const app = useNuxtApp()
  let cache = serverCaches.get(app)
  if (!cache) {
    cache = new Map<string, Component>()
    serverCaches.set(app, cache)
  }
  return cache
}
