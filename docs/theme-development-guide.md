# TixXin Blog 主题开发指南

当前 `web-blog` 已切换为基于 `@tixxin/nuxt-theme-engine` 的主题方案。
新主题通过项目根目录下的 `themes/` 目录和本地契约入口自动接入，旧的手工注册代码已移除。

## 当前架构

```text
theme-contracts/index.ts        # 本地契约入口
themes/<theme-name>/theme.json  # 主题元数据
themes/<theme-name>/app/components/RootLayout.vue
themes/<theme-name>/app/components/ThemeAccessory.vue
app/layouts/default.vue         # 稳定持有 NuxtPage，作为 ThemeComponent slot 透传给布局
app/composables/useLayoutTheme.ts
app/features/theme/layoutThemes.ts
```

职责边界如下：

- `nuxt-theme-engine`（>= 0.0.3）负责主题扫描、主题切换、组件分发、类型生成，以及切换防闪屏（旧树保留直到新组件就绪）
- `theme-contracts/index.ts` 负责声明当前博客允许主题实现哪些逻辑组件
- `themes/` 目录负责放置引擎真正识别的主题定义
- `app/features/theme/layoutThemes.ts` 负责宿主博客自己的主题元信息与设置面板能力声明
- 所有布局实现直接位于 `themes/<theme>/app/components/RootLayout.vue` 中，不存在额外的桥接层

## 运行流程

1. `nuxt.config.ts` 注册 `@tixxin/nuxt-theme-engine`
2. 模块扫描 `themes/` 目录下每个主题的 `theme.json` 和 `app/components`
3. `app/layouts/default.vue` 通过 `<ThemeComponent name="RootLayout">` 渲染当前主题根布局，`NuxtPage` 作为 slot 子节点传入
4. 各主题 `RootLayout.vue` 直接包含完整布局实现，在合适位置用 `<slot />` 渲染页面内容
5. `useLayoutTheme()` 通过 `useThemeEngine()` 读写当前主题，并补齐博客自己的 icon、版本和能力信息
6. `AppearanceDrawer` 与 `LayoutMobileNav` 由宿主稳定渲染，不再跟随主题布局整树重挂

## 本地契约入口

当前博客使用本地契约入口 `theme-contracts/index.ts`：

```ts
export interface ThemeComponentContracts {
  RootLayout: Record<string, never>
  ThemeAccessory: Record<string, never>
}

export const themeContractNames = ['RootLayout', 'ThemeAccessory'] as const
```

这意味着当前每个主题可以提供以下组件：

- `RootLayout.vue`（必需）：主题壳层，通过 `<slot />` 接收页面内容，并提供 `#right-sidebar-target`
- `ThemeAccessory.vue`（必需）：主题额外挂件，例如 classic 的移动端浮动设置按钮
- `StatusFooter.vue`（推荐）：页脚状态栏，各主题布局通过 `<ThemeComponent name="StatusFooter" />` 渲染
- `SidebarNav.vue`（可选）：侧边导航栏，仅提供左侧栏的主题需要实现
- `PostCard.vue`（推荐）：文章卡片，文章列表通过 `<ThemeComponent name="PostCard" />` 渲染

当前三套主题中 `StatusFooter`、`SidebarNav`、`PostCard` 分发组件桥接到 `app/components/` 下的共享实现，而 `RootLayout` 直接包含完整布局实现。如需自定义某个主题的组件外观，直接替换该主题目录下的对应文件即可。

## 创建一个新主题

以新增 `magazine` 主题为例：

### 1. 创建目录

```text
themes/magazine/
├── theme.json
└── app/
    └── components/
        ├── RootLayout.vue
        └── ThemeAccessory.vue
```

### 2. 编写 `theme.json`

```json
{
  "name": "magazine",
  "label": "杂志风格",
  "description": "宽幅图文混排首页"
}
```

如需继承父主题，可增加 `extends`：

```json
{
  "name": "magazine",
  "extends": "classic",
  "label": "杂志风格",
  "description": "基于 classic 的杂志化变体"
}
```

### 3. 编写 `RootLayout.vue`

新的 `RootLayout.vue` 不再直接渲染 `NuxtPage`，而是通过 `<slot />` 接收宿主传入的页面内容：

```vue
<template>
  <div class="page-root theme-magazine">
    <header class="magazine-header">
      <!-- 主题自己的导航壳 -->
    </header>

    <main class="magazine-main">
      <slot />
    </main>

    <aside class="magazine-aside">
      <div id="right-sidebar-target" />
    </aside>
  </div>
</template>
```

### 4. 编写 `ThemeAccessory.vue`

如果主题有额外悬浮入口，可以写在这里；如果没有，可以提供一个空占位组件。

## 切换防闪屏机制

为了彻底减少主题切换瞬时空白，当前项目做了两层处理：

1. `NuxtPage` 作为 `ThemeComponent` 的 slot 子节点由宿主 `default.vue` 稳定提供，各主题布局通过 `<slot />` 渲染
2. `nuxt-theme-engine`（>= 0.0.3）内置的 `ThemeComponent` 在新主题组件尚未 ready 时继续保留旧主题组件，并在首次加载时使用 `defineAsyncComponent` + `onServerPrefetch` 保证 SSR 兼容

之前曾采用 Teleport defer 将 NuxtPage 挂入布局，但引擎的 defineAsyncComponent 在客户端水合时无法同步渲染目标元素，导致 Teleport 静默失败。改为 slot 透传后，页面内容与布局组件在同一个渲染周期内完成，彻底避免了时序问题。。

## 宿主元信息同步

仅把主题文件放进 `themes/` 还不够。为了让博客设置面板正常显示图标、版本和能力说明，还需要同步更新：

- `app/features/theme/layoutThemes.ts`

这里维护的是宿主层数据，例如：

- 主题显示名
- 主题图标
- 版本号
- `leftSidebar` / `rightSidebar`
- 该主题支持哪些自定义项

如果不更新这个文件，主题引擎可以识别主题，但博客自己的设置面板无法完整展示它。

## 当前注意事项

- 新增主题时，优先修改 `themes/` 与 `app/features/theme/layoutThemes.ts`
- 当前博客已使用 `RootLayout` 与 `ThemeAccessory` 两个契约组件
- 主题主内容通过 `<slot />` 承接宿主传入的 `NuxtPage`，不再使用 Teleport 或直接渲染 NuxtPage

## 后续扩展方向

当需要更细粒度的主题差异时，建议按下面顺序推进：

1. 在 `theme-contracts/index.ts` 中增加新的逻辑组件契约
2. 在 `themes/<theme>/app/components/` 中实现对应组件
3. 把宿主页面或布局中的固定组件调用改为 `<ThemeComponent name="..." />`
4. 将只属于博客宿主的设置项继续保留在 `useAppearanceSettings.ts`

这样可以把“主题分发能力”和“博客产品设置”保持清晰分层。
