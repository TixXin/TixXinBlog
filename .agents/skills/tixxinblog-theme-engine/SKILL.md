---
name: tixxinblog-theme-engine
description: 在 TixXinBlog 修改布局主题（themes/）、主题契约、宿主能力位或主题运行时（cookie/水合/切换）时使用；含事实源、改动顺序、验收命令与常见坑。不用于仅调整主题 CSS 细节的视觉微调。
---

# TixXinBlog 主题引擎改动流程

适用于：新增/删除布局主题、改主题契约或能力位、动 cookie/水合/切换事务、补主题单测与 e2e。命令从项目根目录执行，前端目录为 `src/frontend/web-blog/`。

## 先读

- 长期契约：[`docs/themes.md`](../../../docs/themes.md)（唯一权威文档，勿把过程记录写进 docs）。
- 纯逻辑/状态：`app/features/appearance/themeRuntimeState.ts`、`app/features/appearance/themeRegistry.ts`。
- 运行时/门面：`app/composables/useThemeRuntime.ts`、`app/composables/useLayoutTheme.ts`。
- 分发/缓存：`app/components/ThemeComponent.vue`、`app/utils/themeRuntime.ts`、`app/utils/themeComponentCache.ts`、`app/plugins/00.theme-preload.ts`。
- 主题自身：`themes/<name>/theme.json`、`theme.config.ts`、`RootLayout.vue`。

## 四条硬约束

1. 主题偏好唯一事实源是 cookie `blog-layout-theme`，**只允许客户端写**；`localStorage['theme-engine:storage']` 只是降级备份；服务端不为主题输出 `Set-Cookie`（SSR HTML 缓存会重放响应头）。
2. 水合期只信任 SSR payload（`resolveHydratedLayoutTheme`）；任何“水合前读 localStorage 纠正主题”的做法都会重新引入首屏错主题与 mismatch。
3. `?theme=<id>` 是首屏预览：不写 cookie、不写 localStorage；用户主动切换后才持久化。
4. 组件缺失只允许回退**宿主默认壳层**（`app/components/theme/`），绝不跨主题回退；`RootLayout` 必需，缺失渲染可重试错误态，`ThemeAccessory` 缺失合法不渲染。

## 改动顺序（最小 diff）

- **新增主题**：`theme.json`（name/字典 key/version/icon）→ `theme.config.ts`（只导出 capabilities）→ `RootLayout` + 可选 PostCard/StatusFooter/ThemeAccessory → 中英 `theme.themes.<name>.label/description` → `nuxt.config.ts` 的 `themeHostConfigs` 登记（构建期一致性校验）→ `tests/unit/themeRegistry.test.ts` + 新增 `<name>ThemeShell.test.ts` → e2e 主题矩阵补名字。
- **改契约**：`theme-contracts/index.ts` 的 `themeContractNames` 保持 `[...] as const` 字面量（引擎正则解析）→ 宿主 `ThemeComponent` 默认壳层/可选集合 → themes 实现或删除 → 契约矩阵测试。
- **改能力位**：`themeRegistry.ts` 的 `ThemeCapabilities` → 三份 `theme.config.ts` → 消费方（`useThemeSidebarVisibility`、`ThemeSidebarPortal`、`MobileNav`、`useMomentSidebarPlacement`、`useGuestbookResponsive`、`articles/[id].vue`）→ registry 单测。禁止新增按主题 id 的分支。
- **改运行时**：先改 `themeRuntimeState.ts` 纯函数并写 node 单测，再接 `useThemeRuntime`，最后 `useLayoutTheme` 门面；不要绕过运行时直接读/写主题 cookie。

## 验收命令

```sh
corepack pnpm --filter web-blog exec nuxt prepare
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog exec vitest run \
  tests/unit/themeRegistry.test.ts tests/unit/themeRuntimeState.test.ts \
  tests/unit/layoutTheme.test.ts tests/unit/themeSwitchScroll.test.ts \
  tests/unit/nexusThemeShell.test.ts tests/unit/auroraThemeShell.test.ts tests/unit/dockThemeShell.test.ts \
  --hookTimeout=60000
corepack pnpm --filter web-blog exec eslint <改动路径>
corepack pnpm build
```

- Nuxt 测试环境冷启动慢，保留 `--hookTimeout=60000`；不得为换绿删除断言或放宽真实校验。
- 浏览器主题回归需要隔离后端 + PostgreSQL + 生产构建（`corepack pnpm test:e2e`）；环境不具备时在进度文档写 `NOT ASSESSED`，不伪造结果。
- 过程证据写 `.artifacts/theme-engine-fix/02-progress.md`（命令 + 退出码/通过数）；长期约束只回写 `docs/themes.md`。

## 常见坑

- 引擎 0.0.4 的 `theme-sync.client` 运行时插件已被 `nuxt.config.ts` 的 `themeRuntimeHygieneModule` 在 `modules:done` 摘除；升级引擎时重新评估该过滤，不要恢复引擎运行时状态。
- 不要写 `<NexusRootLayout>` 等引擎全局组件别名：dev 可能能解析，生产不存在，统一用 `<ThemeComponent name="...">`。
- 引擎 devtools 路由只在开发可用，生产被 `pages:resolved` 移除；`components:extend` 删别名钩子已移除，不要恢复。
- `theme.json` 与 `theme.config.ts` 单一职责：元信息（含 version/icon）只在 `theme.json`，config 只留 `capabilities`。
- 切换主题会替换 `RootLayout` 整树重挂；滚动/焦点恢复依赖 `#main-content`、`.custom-scrollbar__viewport`/`.article-viewport`、`data-focus-key`，改布局时保留这些结构。
- `<html data-theme>` 由 `app/app.vue` 的 `useHead` 同构输出，主题不要自行设置；移动端每主题只保留一组外观入口。
- Nuxt/Vue 文件与测试遵守仓库文件头、中文注释、单引号无分号；单文件行数上限由 `corepack pnpm lint` 的体量检查强制。
