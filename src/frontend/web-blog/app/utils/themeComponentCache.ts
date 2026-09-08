/**
 * @file themeComponentCache.ts
 * @description 客户端共享、服务端按Nuxt应用请求隔离的主题缓存，避免HMR后SSR沿用旧组件
 * @author TixXin
 * @since 2026-04-10
 */

import type { Component } from 'vue'
import { useNuxtApp } from '#app'

/** 缓存键为 `${sourceTheme}:${componentName}`，值为已解析的 Vue 组件 */
const clientCache = new Map<string, Component>()
const serverCaches = new WeakMap<object, Map<string, Component>>()

export function getThemeComponentCache() {
  if (import.meta.client) return clientCache
  const app = useNuxtApp()
  let cache = serverCaches.get(app)
  if (!cache) {
    cache = new Map<string, Component>()
    serverCaches.set(app, cache)
  }
  return cache
}
