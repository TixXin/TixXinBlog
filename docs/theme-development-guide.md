# TixXin Blog 主题开发指南

本文档面向需要为 TixXin Blog 开发自定义布局主题的开发者，系统介绍主题契约体系、开发流程、注册机制与最佳实践。

## 目录

- [架构概览](#架构概览)
- [核心概念](#核心概念)
- [快速开始：创建一个新主题](#快速开始创建一个新主题)
- [Manifest 字段详解](#manifest-字段详解)
- [Runtime 字段详解](#runtime-字段详解)
- [Capabilities 能力声明](#capabilities-能力声明)
- [布局组件开发规范](#布局组件开发规范)
- [注册主题](#注册主题)
- [父子主题继承](#父子主题继承)
- [CSS Tokens 注入](#css-tokens-注入)
- [组件覆盖](#组件覆盖)
- [兼容性校验](#兼容性校验)
- [内置主题参考](#内置主题参考)
- [常见问题](#常见问题)

---

## 架构概览

主题系统采用 **Manifest + Runtime** 两阶段架构：

```
┌─────────────────────────────────────────────────────────┐
│  themes/contracts.ts                                    │
│  定义全部类型：BlogThemeManifest, BlogThemeRuntime,     │
│  ThemeCapabilities, ThemeCustomizerCapability 等        │
└────────────────────────┬────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
┌──────────┐      ┌──────────┐        ┌──────────┐
│ classic/ │      │  docs/   │        │ minimal/ │     ... 第三方主题
│ theme.ts │      │ theme.ts │        │ theme.ts │
│ Layout   │      │ Layout   │        │ Layout   │
└────┬─────┘      └────┬─────┘        └────┬─────┘
     │                 │                   │
     └────────────┬────┴───────────────────┘
                  ▼
     ┌────────────────────────┐
     │  themes/registry.ts    │
     │  注册、查询、缓存、    │
     │  父子合并、兼容性校验  │
     └────────────┬───────────┘
                  ▼
     ┌────────────────────────────┐
     │ composables/useLayoutTheme │
     │ 响应式状态、异步切换、     │
     │ 预加载、cookie 持久化     │
     └────────────┬───────────────┘
                  ▼
     ┌────────────────────────┐
     │ layouts/default.vue    │
     │ <component :is="..."/> │
     │ 动态渲染激活主题布局   │
     └────────────────────────┘
```

**加载流程**：

1. `useLayoutTheme()` 从 cookie 读取当前主题 ID
2. 通过 `getCachedRuntime(id)` 同步获取布局组件（内置主题始终有缓存）
3. 第三方主题通过 `resolveRuntime(id)` 异步加载，加载完毕后写入缓存再切换
4. `layouts/default.vue` 通过 `<component :is="activeLayout">` 渲染当前布局

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Manifest** | 主题的"身份证"——声明 ID、名称、版本、能力、兼容性与异步加载入口 |
| **Runtime** | 主题的"运行产物"——布局组件、可选的组件覆盖与 CSS tokens |
| **Capabilities** | 主题声明自己拥有的布局能力（左栏、右栏）和支持的自定义选项 |
| **Registry** | 主题注册中心，管理所有主题的 manifest 与 runtime 缓存 |
| **Parent** | 父主题 ID，子主题可继承父主题的 capabilities 和 defaults |

---

## 快速开始：创建一个新主题

以创建一个名为 `magazine` 的杂志风格主题为例：

### 1. 创建目录结构

```
app/themes/magazine/
├── theme.ts              # Manifest 与 Runtime 定义
└── MagazineLayout.vue    # 主布局组件
```

### 2. 编写布局组件

```vue
<!-- app/themes/magazine/MagazineLayout.vue -->
<!--
  @file MagazineLayout.vue
  @description 杂志风格主题布局
  @author YourName
  @since 2026-03-26
-->
<template>
  <div class="page-root theme-magazine">
    <!-- 顶部导航 -->
    <header class="magazine-header">
      <LayoutSidebarNav />
    </header>

    <!-- 主内容区 -->
    <main class="magazine-content">
      <NuxtPage :transition="contentTransition" />
    </main>

    <!-- 右侧栏挂载点（如 capabilities.rightSidebar = true 时必须提供） -->
    <aside class="magazine-sidebar">
      <div id="right-sidebar-target" />
    </aside>

    <!-- 页脚 -->
    <LayoutStatusFooter />

    <!-- 全局必要组件 -->
    <CommonAppearanceDrawer />
    <LayoutMobileNav />
  </div>
</template>

<script setup lang="ts">
const {
  contentTransitionName,
  contentTransitionDuration,
} = useAppearanceSettings()

const contentTransition = {
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
}
</script>
```

### 3. 编写 Manifest 与 Runtime

```typescript
// app/themes/magazine/theme.ts
import type { BlogThemeManifest, BlogThemeRuntime } from '../contracts'
import MagazineLayout from './MagazineLayout.vue'

export const magazineRuntime: BlogThemeRuntime = {
  layout: MagazineLayout,
}

const magazineTheme: BlogThemeManifest = {
  id: 'magazine',
  name: '杂志风格',
  version: '1.0.0',
  description: '宽幅杂志排版，适合图文混排内容',
  author: 'YourName',
  icon: 'lucide:newspaper',
  compatibility: { app: '>=1.0.0' },
  capabilities: {
    leftSidebar: false,
    rightSidebar: true,
    customizer: ['colorMode', 'contentTransition'],
  },
  load: async () => magazineRuntime,
}

export default magazineTheme
```

### 4. 注册主题

在 `app/themes/registry.ts` 的 `registerBuiltinThemesSync()` 中添加：

```typescript
import magazineTheme, { magazineRuntime } from './magazine/theme'

export function registerBuiltinThemesSync() {
  registerThemeWithRuntime(classicTheme, classicRuntime)
  registerThemeWithRuntime(docsTheme, docsRuntime)
  registerThemeWithRuntime(minimalTheme, minimalRuntime)
  registerThemeWithRuntime(magazineTheme, magazineRuntime) // 新增
}
```

完成！主题会自动出现在外观设置面板中。

---

## Manifest 字段详解

`BlogThemeManifest` 是主题的完整声明，所有字段定义在 `app/themes/contracts.ts` 中。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 唯一标识符，建议使用 kebab-case（如 `'magazine'`） |
| `name` | `string` | 是 | 显示名称，中文或英文均可 |
| `version` | `string` | 是 | semver 版本号（如 `'1.0.0'`） |
| `description` | `string` | 是 | 一句话描述 |
| `author` | `string` | 是 | 作者名 |
| `icon` | `string` | 是 | lucide 图标名（如 `'lucide:newspaper'`），用于外观面板展示 |
| `parent` | `string` | 否 | 父主题 ID，启用父子继承 |
| `preview` | `ThemePreview` | 否 | 预览信息（封面图 URL、调色板） |
| `compatibility` | `ThemeCompatibility` | 是 | 兼容性声明 |
| `capabilities` | `ThemeCapabilities` | 是 | 能力声明 |
| `defaults` | `Partial<ThemeCustomizerState>` | 否 | 设置项默认值 |
| `load` | `() => Promise<BlogThemeRuntime>` | 是 | 异步加载运行时产物的入口函数 |

### compatibility

```typescript
interface ThemeCompatibility {
  app: string   // 宿主版本范围，格式：'>=x.y.z'
  nuxt?: string // Nuxt 版本范围（可选）
}
```

### preview

```typescript
interface ThemePreview {
  cover?: string    // 预览封面图 URL
  palette?: string[] // 调色板色值，如 ['#5b7cfa', '#f0f0f0', '#1a1a2e']
}
```

---

## Runtime 字段详解

`BlogThemeRuntime` 是主题加载后的运行产物。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `layout` | `Component` | 是 | 主布局组件，渲染为 `<component :is="layout">` |
| `pageLayouts` | `Record<string, Component>` | 否 | 路由级子布局，键为路由 name 或 path 模式 |
| `components` | `Partial<ThemeComponentSlots>` | 否 | 覆盖宿主默认组件 |
| `tokens` | `Record<string, string>` | 否 | CSS 自定义属性注入 |

---

## Capabilities 能力声明

主题通过 `capabilities` 声明自己的布局结构和支持的设置项。外观设置面板根据此声明动态显示/隐藏对应区段。

### 布局能力

| 字段 | 类型 | 说明 |
|------|------|------|
| `leftSidebar` | `boolean` | 主题是否包含左侧导航栏 |
| `rightSidebar` | `boolean` | 主题是否包含右侧栏（需提供 `#right-sidebar-target` 挂载点） |

### 自定义项 (customizer)

在 `customizer` 数组中声明支持的设置面板项：

| 值 | 面板中的区段 | 说明 |
|----|-------------|------|
| `'colorMode'` | 颜色主题 | 亮色 / 暗色 / 跟随系统 |
| `'contentTransition'` | 主内容切换 | 页面切换动画（纵向滑动、淡入淡出等） |
| `'sidebarAnimation'` | 右侧栏动画 | 侧栏进入/退出动画 |
| `'layoutDensity'` | 布局密度 | 紧凑 / 常规 / 宽松（预留） |

**示例**：单栏主题没有右栏，不声明 `sidebarAnimation`：

```typescript
capabilities: {
  leftSidebar: false,
  rightSidebar: false,
  customizer: ['colorMode', 'contentTransition'],
}
```

---

## 布局组件开发规范

### 必须包含的元素

1. **`<NuxtPage>`** — 渲染路由页面内容
2. **`<CommonAppearanceDrawer>`** — 外观设置面板
3. **`<LayoutMobileNav>`** — 移动端底部导航

### 根据 capabilities 必须提供的元素

- `rightSidebar: true` → 必须包含 `<div id="right-sidebar-target" />`，各页面通过 `<Teleport to="#right-sidebar-target">` 投送右侧栏内容
- `leftSidebar: true` → 需要渲染 `<LayoutSidebarNav>` 组件

### 推荐包含的元素

- `<LayoutStatusFooter>` — 页脚
- `<BlogAppearanceEntry>` — 外观设置入口按钮（桌面端可在导航区，移动端用浮动按钮）

### NuxtPage 过渡动画

使用 `useAppearanceSettings()` 获取用户选择的过渡效果：

```typescript
const {
  contentTransitionName,
  contentTransitionDuration,
  sidebarAnimationClass,
} = useAppearanceSettings()

const contentTransition = {
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
}
```

### CSS 类名约定

- 根元素使用 `.page-root .theme-{id}` 双类名，方便全局样式覆盖
- 内部使用 BEM 命名：`.theme-{id}__header`、`.theme-{id}__content`
- 使用 `scoped` 样式或 BEM 命名避免与其他主题冲突

---

## 注册主题

### 内置主题（同步注册）

内置主题在应用启动时同步注册，确保 SSR 水合一致性：

```typescript
import { registerThemeWithRuntime } from '~/themes/registry'

// theme.ts 同步导入布局组件
import MyLayout from './MyLayout.vue'

export const myRuntime: BlogThemeRuntime = { layout: MyLayout }

// 在 registry.ts 的 registerBuiltinThemesSync() 中调用
registerThemeWithRuntime(myManifest, myRuntime)
```

### 第三方主题（异步注册）

第三方主题通过 `registerTheme()` 仅注册 manifest，runtime 在首次切换时通过 `load()` 异步加载：

```typescript
import { registerTheme } from '~/themes/registry'

const remoteTheme: BlogThemeManifest = {
  id: 'remote-theme',
  // ...
  load: async () => {
    const module = await import('some-npm-theme-package')
    return module.runtime
  },
}

registerTheme(remoteTheme)
```

切换到该主题时，`useLayoutTheme` 的 `setLayoutTheme()` 会自动调用 `load()` 并缓存结果。加载期间 UI 显示 loading 态，失败显示 error 态并保持当前主题不变。

---

## 父子主题继承

通过设置 `parent` 字段，子主题可继承父主题的属性：

```typescript
const childTheme: BlogThemeManifest = {
  id: 'classic-dark',
  name: '经典暗黑版',
  parent: 'classic', // 继承经典主题
  // ...仅覆盖需要改变的字段
}
```

**合并规则**：

| 字段类型 | 合并策略 |
|----------|----------|
| 标量字段（id, name, version...） | 子覆盖父 |
| `capabilities` | 浅合并（`{ ...parent.capabilities, ...child.capabilities }`） |
| `defaults` | 浅合并（`{ ...parent.defaults, ...child.defaults }`） |
| `load` | 始终使用子主题的 `load()` |

**注意**：`resolveManifest()` 会递归解析父链，支持多级继承（A → B → C）。

---

## CSS Tokens 注入

主题可通过 `runtime.tokens` 注入 CSS 自定义属性，用于微调颜色、间距等视觉参数而不需要覆盖整个布局：

```typescript
export const myRuntime: BlogThemeRuntime = {
  layout: MyLayout,
  tokens: {
    '--accent': '#e74c3c',
    '--sidebar-width': '280px',
    '--content-max-width': '720px',
  },
}
```

> 注：tokens 的注入机制将在后续版本中自动应用到 `:root`。当前阶段，主题可在布局组件的 `onMounted` 中手动设置。

---

## 组件覆盖

主题可通过 `runtime.components` 替换宿主的默认组件：

```typescript
import CustomPostCard from './components/CustomPostCard.vue'

export const myRuntime: BlogThemeRuntime = {
  layout: MyLayout,
  components: {
    PostCard: CustomPostCard,
  },
}
```

可覆盖的组件插槽（`ThemeComponentSlots`）：

| 插槽名 | 默认组件 | 说明 |
|--------|---------|------|
| `PostCard` | `blog/PostCard.vue` | 文章列表卡片 |
| `SidebarNav` | `layout/SidebarNav.vue` | 侧栏导航 |
| `StatusFooter` | `layout/StatusFooter.vue` | 页脚 |
| `PageHeader` | `common/PageHeader.vue` | 页面标题栏 |

> 注：组件覆盖的消费机制将在后续版本中实现。当前阶段，主题可在自己的布局中直接使用自定义组件。

---

## 兼容性校验

主题安装/注册前可调用 `checkCompatibility()` 校验：

```typescript
import { checkCompatibility } from '~/themes/registry'

const result = checkCompatibility(someManifest, '1.0.0')
if (!result.ok) {
  console.warn('主题不兼容：', result.reason)
}
```

校验内容：
1. `compatibility.app` — 当前宿主版本是否满足要求（`>=x.y.z` 格式）
2. `parent` — 父主题是否已安装

---

## 内置主题参考

| 主题 | ID | 布局 | capabilities |
|------|-----|------|-------------|
| 经典三栏 | `classic` | 左侧导航 + 中间内容 + 右侧信息栏 | `leftSidebar: true`, `rightSidebar: true`, customizer: colorMode / contentTransition / sidebarAnimation |
| 双栏文档 | `docs` | 顶部导航 + 宽内容区 + 可选右栏 | `leftSidebar: false`, `rightSidebar: true`, customizer: colorMode / contentTransition / sidebarAnimation |
| 单栏极简 | `minimal` | 顶部导航 + 居中单列内容 | `leftSidebar: false`, `rightSidebar: false`, customizer: colorMode / contentTransition |

建议阅读 `app/themes/classic/theme.ts` 和 `app/themes/classic/ClassicLayout.vue` 作为完整参考实现。

---

## 常见问题

### 主题切换后页面闪白？

确保布局组件不依赖客户端才能确定的条件渲染。SSR 和客户端首次渲染的结构必须一致。内置主题通过 `registerThemeWithRuntime()` 同步注册，保证 SSR 阶段就能获取到布局组件。

### 右侧栏内容不显示？

1. 确认 `capabilities.rightSidebar` 设为 `true`
2. 确认布局中包含 `<div id="right-sidebar-target" />`
3. 页面通过 `<ClientOnly><Teleport to="#right-sidebar-target">` 投送内容

### 外观面板中某些设置项不见了？

面板根据 `capabilities.customizer` 数组动态显示区段。若未声明 `'sidebarAnimation'`，则"右侧栏动画"区段不会显示。这是预期行为。

### 如何从第三方 npm 包加载主题？

```typescript
const npmTheme: BlogThemeManifest = {
  id: 'npm-theme-name',
  // ...
  load: async () => {
    const mod = await import('npm-theme-name')
    return mod.runtime
  },
}
registerTheme(npmTheme)
```

主题包需导出符合 `BlogThemeRuntime` 接口的 `runtime` 对象。

### 如何卸载主题？

```typescript
import { unregisterTheme } from '~/themes/registry'

unregisterTheme('theme-id') // 默认主题 classic 不可卸载
```

若卸载的是当前激活主题，需先调用 `disableCurrentTheme()` 回退到默认主题。
