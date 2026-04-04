# TixXin Blog 主题开发指南

当前 `web-blog` 已切换为基于 `@tixxin/nuxt-theme-engine` 的主题方案。
新主题通过项目根目录下的 `themes/` 目录和本地契约入口自动接入，旧的手工注册代码已移除。

## 当前架构

```text
theme-contracts/index.ts                # 本地契约入口
themes/<theme-name>/theme.json          # 主题元数据（name/label/description + meta）
themes/<theme-name>/theme.config.ts     # 宿主侧配置（capabilities、version、icon 回退值）
themes/<theme-name>/app/components/RootLayout.vue
themes/<theme-name>/app/components/ThemeAccessory.vue
app/layouts/default.vue                 # 稳定持有 NuxtPage，作为 ThemeComponent slot 透传给布局
app/composables/useLayoutTheme.ts       # 合并引擎定义 + 宿主配置，提供统一主题 API
app/features/appearance/themeRegistry.ts # 主题注册表：导入各 theme.config.ts，声明类型与常量
app/features/appearance/types.ts        # 纯外观偏好常量（颜色模式、动画预设）
```

职责边界如下：

- `nuxt-theme-engine`（>= 0.0.3）负责主题扫描、主题切换、组件分发、类型生成，以及切换防闪屏（旧树保留直到新组件就绪）
- `theme-contracts/index.ts` 负责声明当前博客允许主题实现哪些逻辑组件
- `themes/` 目录负责放置引擎真正识别的主题定义
- `themes/<theme>/theme.config.ts` 声明宿主侧能力（leftSidebar、rightSidebar、customizer 等），跟随主题走
- `app/features/appearance/themeRegistry.ts` 导入各主题的 `theme.config.ts` 并提供统一的注册查询 API
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
- `ThemeAccessory.vue`（必需）：主题额外挂件，例如 Nexus 的移动端浮动设置按钮
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
  "description": "宽幅图文混排首页",
  "meta": {
    "version": "1.0.0",
    "icon": "lucide:newspaper"
  }
}
```

`meta` 字段为引擎 v0.0.4+ 支持的扩展元数据，可放入 `version`、`icon` 等任意键值对。引擎会将 `meta` 原样透传到运行时。

如需继承父主题，可增加 `extends`：

```json
{
  "name": "magazine",
  "extends": "nexus",
  "label": "杂志风格",
  "description": "基于 Nexus 的杂志化变体",
  "meta": {
    "version": "1.0.0",
    "icon": "lucide:newspaper"
  }
}
```

### 3. 编写 `theme.config.ts`

在主题目录根部创建 `theme.config.ts`，声明宿主侧能力：

```typescript
export default {
  version: '1.0.0',
  icon: 'lucide:newspaper',
  capabilities: {
    leftSidebar: false,
    rightSidebar: true,
    customizer: ['colorMode', 'contentTransition'] as const,
  },
}
```

`version` 和 `icon` 在此处作为回退值，优先从引擎的 `theme.json` meta 获取。`capabilities` 声明该主题支持的侧栏和设置面板定制项。

### 4. 在 `themeRegistry.ts` 中注册

在 `app/features/appearance/themeRegistry.ts` 中添加导入：

```typescript
import magazineConfig from '@@/themes/magazine/theme.config'

export const themeHostConfigs: Record<string, ThemeHostConfig> = {
  nexus: nexusConfig,
  aurora: auroraConfig,
  dock: dockConfig,
  magazine: magazineConfig,  // 新增
}
```

### 5. 编写 `RootLayout.vue`

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

### 6. 编写 `ThemeAccessory.vue`

如果主题有额外悬浮入口，可以写在这里；如果没有，可以提供一个空占位组件。

## 切换防闪屏机制

为了彻底减少主题切换瞬时空白，当前项目做了两层处理：

1. `NuxtPage` 作为 `ThemeComponent` 的 slot 子节点由宿主 `default.vue` 稳定提供，各主题布局通过 `<slot />` 渲染
2. `nuxt-theme-engine`（>= 0.0.3）内置的 `ThemeComponent` 在新主题组件尚未 ready 时继续保留旧主题组件，并在首次加载时使用 `defineAsyncComponent` + `onServerPrefetch` 保证 SSR 兼容

之前曾采用 Teleport defer 将 NuxtPage 挂入布局，但引擎的 defineAsyncComponent 在客户端水合时无法同步渲染目标元素，导致 Teleport 静默失败。改为 slot 透传后，页面内容与布局组件在同一个渲染周期内完成，彻底避免了时序问题。。

## 宿主元信息同步

仅把主题文件放进 `themes/` 还不够。为了让博客设置面板正常显示图标、版本和能力说明，还需要：

1. **`theme.json`** 中声明 `meta.version` 和 `meta.icon`（引擎透传到运行时）
2. **`theme.config.ts`** 中声明 `capabilities` 和 `version`/`icon` 回退值
3. **`themeRegistry.ts`** 中添加一行导入

数据单一来源：

- `name` / `label` / `description` / `version` / `icon` → 唯一定义在 `theme.json` 中（通过 meta 字段）
- `capabilities` → 唯一定义在 `theme.config.ts` 中
- 宿主的 `themeRegistry.ts` 只做导入和查询，不重复声明任何主题元信息

## 当前注意事项

- 新增主题时，创建 `theme.json` + `theme.config.ts` + 组件，然后在 `themeRegistry.ts` 加一行 import
- 当前博客已使用 `RootLayout` 与 `ThemeAccessory` 两个契约组件
- 主题主内容通过 `<slot />` 承接宿主传入的 `NuxtPage`，不再使用 Teleport 或直接渲染 NuxtPage

## 后续扩展方向

当需要更细粒度的主题差异时，建议按下面顺序推进：

1. 在 `theme-contracts/index.ts` 中增加新的逻辑组件契约
2. 在 `themes/<theme>/app/components/` 中实现对应组件
3. 把宿主页面或布局中的固定组件调用改为 `<ThemeComponent name="..." />`
4. 将只属于博客宿主的设置项继续保留在 `useAppearanceSettings.ts`

这样可以把“主题分发能力”和“博客产品设置”保持清晰分层。
