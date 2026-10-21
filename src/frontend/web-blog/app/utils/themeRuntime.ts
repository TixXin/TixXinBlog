/**
 * @file themeRuntime.ts
 * @description 按当前或明确请求的主题并行加载组件；复用缓存、通知响应式缓存版本，并给等待设置截止时间
 * @author TixXin
 * @since 2026-09-07
 */
import type { Component } from 'vue'
import { shallowRef } from 'vue'
import { themeComponentLoaders, themeComponentRegistry } from '#build/theme-engine.registry.mjs'
import { getThemeComponentCache } from './themeComponentCache'

const taskStores = new WeakMap<Map<string, Component>, Map<string, Promise<void>>>()
type Loader = () => Promise<{ default?: Component }>
/** 每个组件就绪时回报 (done, total)，供首屏进度按真实加载推进 */
type ProgressReporter = (done: number, total: number) => void

/**
 * 组件缓存是普通 Map；写完后递增版本，让错误态/超时后的迟到资源可以被动恢复。
 * 只用于浏览器运行时，服务端不需要错误态自愈，也避免模块级响应式状态跨请求。
 */
export const themeCacheVersion = shallowRef(0)

function notifyThemeCacheUpdated() {
  if (import.meta.client) themeCacheVersion.value += 1
}

/**
 * 预加载一个主题的全部组件。
 * - 按主题去重，失败/超时后清掉任务，允许重试；
 * - 超时只让等待方失败，底层 import 继续完成并写入缓存（迟到资源通过缓存版本触发 UI 自愈）；
 * - onProgress 只在首屏首次加载传入，重试不重复推动首屏进度条。
 */
export async function preloadLayoutTheme(id: string, onProgress?: ProgressReporter): Promise<void> {
  const themeComponentCache = getThemeComponentCache()
  const tasks = taskStores.get(themeComponentCache) ?? new Map<string, Promise<void>>()
  taskStores.set(themeComponentCache, tasks)
  const existing = tasks.get(id)
  if (existing) return existing
  const registry = themeComponentRegistry[id]
  const loaders = themeComponentLoaders[id] as Record<string, Loader> | undefined
  if (!registry || !loaders) throw new Error('主题未注册')
  const entries = Object.entries(loaders)
  let done = 0
  const pending = Promise.all(
    entries.map(async ([name, loader]) => {
      const key = `${registry[name]?.sourceTheme}:${name}`
      if (!themeComponentCache.has(key)) {
        const component = (await loader()).default
        if (!component) throw new Error(`主题组件未加载：${name}`)
        themeComponentCache.set(key, component)
        notifyThemeCacheUpdated()
      }
      onProgress?.(++done, entries.length)
    }),
  ).then(() => undefined)
  let timer: ReturnType<typeof setTimeout>
  const task: Promise<void> = Promise.race([
    pending,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('主题资源加载超时')), 8000)
    }),
  ]).finally(() => {
    clearTimeout(timer)
    if (tasks.get(id) === task) tasks.delete(id)
  })
  tasks.set(id, task)
  return task
}
