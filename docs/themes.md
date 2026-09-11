# 主题开发

博客通过 `@tixxin/nuxt-theme-engine` 加载 Nexus、Aurora 和 Dock。主题负责布局与表现；路由页面、请求、身份、内容与编辑状态由宿主维护。以下路径相对 `src/frontend/web-blog/`。

## 文件与契约

```text
theme-contracts/index.ts
themes/<theme>/theme.json
themes/<theme>/theme.config.ts
themes/<theme>/app/components/RootLayout.vue
themes/<theme>/app/components/ThemeAccessory.vue
app/layouts/default.vue
app/composables/useLayoutTheme.ts
app/features/appearance/themeRegistry.ts
```

[本地契约](../src/frontend/web-blog/theme-contracts/index.ts)声明五个逻辑组件：

| 契约             | 职责                                 |
| ---------------- | ------------------------------------ |
| `RootLayout`     | 主题根布局，通过 slot 接收宿主页内容 |
| `ThemeAccessory` | 主题附加入口或挂件                   |
| `StatusFooter`   | 页脚与状态展示                       |
| `SidebarNav`     | 主题侧栏导航                         |
| `PostCard`       | 文章卡片分发                         |

主题中的分发组件可以复用 `app/components/` 的共享实现；需要主题差异时在主题目录替换对应组件。增加逻辑组件时先声明契约，再实现各主题与宿主调用，不绕过现有分发边界。

`app/layouts/default.vue` 稳定持有 `NuxtPage`，作为 `<ThemeComponent name="RootLayout">` 的 slot 内容传入。主题使用 `<slot />`，不额外创建 `NuxtPage`。右侧栏由宿主管理，布局需要提供对应的 `#right-sidebar-target`；紧凑布局和抽屉仍复用同一业务数据。

## 元数据与宿主能力

`theme.json` 由引擎扫描，定义唯一主题名称、显示名称、介绍及 `meta.version/meta.icon`：

```json
{
  "name": "magazine",
  "label": "杂志",
  "description": "宽幅图文布局",
  "meta": {
    "version": "1.0.0",
    "icon": "lucide:newspaper"
  }
}
```

`theme.config.ts` 声明宿主能力，version/icon 仅作引擎元信息缺失时的回退：

```ts
/** @file theme.config.ts @description 杂志主题的宿主能力 */
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

当前 customizer 能力为 `colorMode`、`contentTransition`、`sidebarAnimation`、`layoutDensity`。只声明实际支持的项，设置面板据此决定展示。名称、介绍、版本和图标不在多个查询模块重复维护。

## 添加主题

1. 在 `themes/<唯一名称>/` 创建 `theme.json`、`theme.config.ts` 和契约组件。
2. 在 [nuxt.config.ts](../src/frontend/web-blog/nuxt.config.ts) 导入宿主配置，并加入 `app:templates` 钩子生成的 `themeHostConfigs` 对象，保持所需展示顺序。
3. `themeRegistry.ts` 从 `#build/theme-host.config.mjs` 读取纯元数据，不直接导入主题 SFC 或所有主题运行资源。
4. 使用引擎发现的组件与 `useLayoutTheme()` 切换，更新必要的契约和类型，重新 prepare/build 验证。

不要修改 `.nuxt/` 中的生成文件来注册主题。引擎目录扫描与宿主能力登记缺一不可；仅放入目录不保证设置面板可选。

根布局示例：

```vue
<!-- @file RootLayout.vue @description 杂志主题布局壳层 -->
<template>
  <div class="theme-magazine">
    <header><!-- 主题导航 --></header>
    <main><slot /></main>
    <aside><div id="right-sidebar-target" /></aside>
    <ThemeComponent name="StatusFooter" />
  </div>
</template>
```

实际主题应复用既有导航、移动抽屉与页面区域职责，避免重复全局外观设置或移动导航实例。样式通过共享设计变量和主题命名空间实现，不把业务数据来源改成主题私有副本。

## 切换与动效

引擎在新组件就绪前保留旧主题，`useLayoutTheme()` 管理预热、切换序列、错误和回退。较早请求的结果不能覆盖更新的选择；加载失败应保留可用布局并提供重试。

页面标题、正文、侧栏分别由宿主的页面区域与动效 composable 管理。动画不是数据就绪条件：无动画、减少动态效果、请求取消或导航中断时都必须正确收尾，不能依赖某个 transitionend 才恢复内容。

主题组件必须清理观察器、监听器、定时器、动画与临时节点。支持键盘焦点、Escape、焦点归还、低高度视口、窄屏重排和 `prefers-reduced-motion`。图标统一使用 Lucide，不能以图标或动画替代操作名称和状态反馈。

## 验证

```sh
corepack pnpm --filter web-blog exec nuxt prepare
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog test
corepack pnpm build
```

选择相关浏览器场景验证主题切换、快速导航、失败重试、URL/历史恢复、未保存输入和焦点；现有入口包括 `motion-features.spec.ts`、`motion-remediation.spec.ts`、`page-regions.spec.ts` 和 `page-navigation-races.spec.ts`。

覆盖三主题、明暗模式、正常/关闭/减少动效、移动与桌面断点。单元 DOM 环境不能证明真实排版、系统缩放或辅助技术体验，需要相应浏览器或设备验证。运行方法及本地产物规则见[开发指南](development.md)。
