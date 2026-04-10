/**
 * @file themeComponentCache.ts
 * @description 主题组件模块级共享缓存，由预加载插件写入、ThemeComponent 同步读取，避免水合时异步空帧
 * @author TixXin
 * @since 2026-04-10
 */

import type { Component } from 'vue'

/** 缓存键为 `${sourceTheme}:${componentName}`，值为已解析的 Vue 组件 */
export const themeComponentCache = new Map<string, Component>()
