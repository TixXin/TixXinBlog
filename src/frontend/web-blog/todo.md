# Web Blog 开发 Todo

> 本文档用于维护 `src/frontend/web-blog/` 当前阶段的开发待办、总体进度与状态变化。开发前先阅读，开发中同步更新，开发完成后复核总进度与任务状态。

## 总进度

- 总任务数：37
- 已完成：36
- 进行中：0
- 未开始：0
- 暂缓：1
- 完成率：97%

## 维护约定

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 暂缓 / 阻塞
- 开始新任务前，先把对应事项移入合适状态，并更新总进度
- 开发过程中任务范围、优先级或阻塞状态发生变化时，必须同步更新本文档
- 完成任务后，先更新本文档，再结束本轮开发

## 当前进行中

（无）

## 待处理

（无）

## 已完成

- [x] 建立 `web-blog` 开发 Todo 文档：补齐总进度、状态约定与首批任务清单
- [x] Todo 维护规则落地：在项目级规则中加入开发过程中必须同步维护 `todo.md` 的约束
- [x] 目录文档同步：在 `docs/directory-structure.md` 中补充 `src/frontend/web-blog/todo.md` 的职责说明
- [x] 主题 manifest 契约：产出 `BlogThemeManifest` 接口，明确 id、name、version、author、compatibility、capabilities、load() 等必填项
- [x] 主题 runtime 契约：产出 `BlogThemeRuntime` 接口，明确 layout、pageLayouts、components、tokens 结构
- [x] 主题 capabilities 模型：产出 `ThemeCapabilities` 接口，明确 leftSidebar、rightSidebar、customizer 可声明能力
- [x] parent/child 合并策略：在 registry 中实现 `resolveManifest` + `mergeManifests`，明确子覆盖父标量、capabilities/defaults 浅合并规则
- [x] 主题注册中心改造：registry 改为 manifest 注册 + runtime 缓存 + 动态校验，去除硬编码预设依赖
- [x] 默认三套主题迁移：classic、docs、minimal 已迁移为 `BlogThemeManifest` 格式，含 version、compatibility、capabilities 与 load()
- [x] 主题设置面板重构：面板根据 capabilities.customizer 动态显隐区段，布局主题按钮增加版本标签，resetAppearanceSettings 改用 DEFAULT_THEME_ID
- [x] mock 边界清理：新增 useNavItems/useSiteInfo composable 抽象数据源，SidebarNav、MobileNav、StatusFooter、DocsLayout、MinimalLayout 改用 composable，PostTabs 改为 props
- [x] 滚动与布局容器梳理：修复 useReadingProgress 冗余 window 监听，清理 _layout.scss 中 main-content__body 与 CustomScrollbar 的 overflow 职责冲突
- [x] SEO / Meta 补齐：nuxt.config.ts 全局 title 模板 + charset + viewport + OG/Twitter 默认值，8 个页面全部补充 useSeoMeta，文章详情页 useHead 升级为 useSeoMeta 并补齐 OG + Twitter Card
- [x] 图片与首屏性能优化：文章详情封面 fetchpriority="high" 优化 LCP，PostCard alt 动态化，关键图片补 width/height 减 CLS，灯箱去 lazy，封面/头像/友链 @error 兜底（后续可引入 @nuxt/image 做 srcset/格式优化）
- [x] 主题动态加载机制：setLayoutTheme 异步化支持第三方主题加载，新增 switchingState 状态机、preloadTheme hover 预热、AppearanceDrawer loading/error 态与切换防竞态
- [x] 后台主题管理方案：registry 新增 unregisterTheme 卸载接口 + checkCompatibility 兼容性校验 + satisfiesSemver 版本匹配，useLayoutTheme 新增 disableCurrentTheme 回退能力，后端 API 路由设计已记录于方案文档
- [x] 引入 `nuxt-theme-engine`：`nuxt.config.ts` 接入模块，补齐 `theme-contracts/index.ts` 本地契约入口与 `themes/` 主题目录
- [x] 布局主题适配层迁移：`useLayoutTheme` 改为基于 `useThemeEngine()` 驱动，保留切换状态与 hover 预热能力
- [x] 根布局切换迁移：`layouts/default.vue` 改为通过 `<ThemeComponent name="RootLayout" />` 渲染当前主题根布局
- [x] 宿主主题边界拆分：新增 `features/theme/layoutThemes.ts` 承载图标、版本与 capabilities，`useAppearanceSettings` 和 `features/theme/types.ts` 不再依赖旧主题契约
- [x] 文档同步主题引擎方案：重写 `docs/theme-development-guide.md`，并更新 `docs/directory-structure.md` 中的 `theme-contracts/` 与 `themes/` 结构说明
- [x] 安装兼容修复：补充 `packages/theme-contracts` 工作区兼容包，并将 `packages/*` 纳入 `pnpm-workspace.yaml`，用于兜底 `@tixxin/nuxt-theme-engine@0.0.1` 发布包中错误的 `workspace:*` 依赖
- [x] 升级 `nuxt-theme-engine` 至 `0.0.2`：移除 `0.0.1` 临时兼容包与 workspace 补丁，恢复仓库到正常依赖结构
- [x] 主题主内容稳定挂载：`default.vue` 稳定持有 `NuxtPage`，并通过 `Teleport` 将页面内容挂到主题布局中的 `#theme-main-target`
- [x] 主题壳层去重：classic/docs/minimal 布局移除内嵌 `NuxtPage`、`CommonAppearanceDrawer` 与 `LayoutMobileNav`，只保留主题差异壳层与挂载目标
- [x] 切换防闪屏增强：新增本地 `ThemeComponent.vue` 覆盖主题引擎默认实现，在新主题组件 ready 前继续保留旧组件渲染
- [x] 升级至 `nuxt-theme-engine@0.0.3`：移除本地 `ThemeComponent.vue` 覆盖（防闪屏已内置于引擎），修复 classic 主题 `theme.json` 位置错误导致引擎未发现该主题
- [x] 主内容交付方式改为 slot 透传：将 `NuxtPage` 从 `Teleport` 改为 `ThemeComponent` 的 slot 子节点，由布局组件通过 `<slot />` 接收，解决引擎异步组件导致 Teleport 目标不就绪的问题
- [x] 旧主题注册代码清理：删除 `contracts.ts`、`registry.ts`、`types.ts` 及三个 `theme.ts`（已无任何引用，引擎完全接管主题注册与分发）
- [x] 组件分发迁移：StatusFooter、SidebarNav、PostCard 纳入主题契约，三个主题提供桥接组件，布局和 PostCardList 改用 `<ThemeComponent>` 渲染
- [x] 合并主题目录消除桥接层：将 `app/themes/` 下的 ClassicLayout、DocsLayout、MinimalLayout 直接合并到 `themes/*/app/components/RootLayout.vue`，删除 `app/themes/` 目录
- [x] 项目全面改进阶段1：修复文档不准确处、删除子包 lockfile、修复 composable 调用位置、提取重复样式、清理冗余依赖
- [x] 项目全面改进阶段2：接入 @nuxt/eslint + Prettier + Husky + lint-staged + Vitest，创建 CI workflow
- [x] 项目全面改进阶段3：接入 @nuxt/fonts + @nuxt/image + JSON-LD + sitemap/robots + routeRules
- [x] 项目全面改进阶段4：创建 .env.example + Dockerfile + CSP + CI 依赖审计
- [x] 项目全面改进阶段5：PostCardList 拆分为 composable、提炼 CommentBubble、修复 SSR 水合警告、创建 useArticleDetail composable

## 暂缓 / 阻塞

- [-] 评论系统接入：等待后端接口方案与数据模型明确后再进入实现
