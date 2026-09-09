# Web Blog 开发 Todo

> 本文档用于维护 `src/frontend/web-blog/` 当前阶段的开发待办、总体进度与状态变化。开发前先阅读，开发中同步更新，开发完成后复核总进度与任务状态。

## UI 收尾阶段进度（已归档）

- 总任务数：65
- 已完成：65
- 进行中：0
- 未开始：0
- 暂缓：0
- 完成率：100%

## 当前阶段：可靠启动与朋友圈真实业务

- 本阶段任务数：7；已完成：3；进行中：1；未开始：3。
- 完成率：43%。历史 UI 阶段的 100% 不代表所有业务已接入真实 API。
- 验收和实现记录见 `docs/next-stage.md`。

## 维护约定

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 暂缓 / 阻塞
- 开始新任务前，先把对应事项移入合适状态，并更新总进度
- 开发过程中任务范围、优先级或阻塞状态发生变化时，必须同步更新本文档
- 完成任务后，先更新本文档，再结束本轮开发

## 当前进行中

- [~] 朋友圈前台真实数据、互动、筛选与失败/草稿恢复。

## 待处理

- [ ] 后台朋友圈管理与媒体引用、备份恢复兼容。
- [ ] 显式开发数据导入、清空与重置脚本及隔离验证。
- [ ] 三主题三浏览器、生产构建及完整验收交付。

## 本阶段已完成

- [x] 朋友圈实体、迁移、公开与管理 API、权限及稳定分页；75请求隔离集成和后端43项单测通过，见 docs/backend/moments.md。

- [x] 统一开发启动、自检、服务归属识别与进程清理；跨平台生命周期和隔离完整启动验证通过，见 docs/development-runtime.md。

- [x] 建立实际能力清单，修正文档的数据源和阶段描述；朋友圈实施后同步更新对应状态，见 docs/capability-map.md。

## UI 收尾阶段已完成

- [x] 内容服务故障与恢复：恢复本机后端，补齐首页/归档重试、共享统计保留、闪念错误与空态分离及草稿保护；91项单测、120项相关浏览器回归及三主题SSR断连恢复通过，新增dev:api与双服务启动说明，见 docs/service-recovery.md（2026-09-08）。

- [x] 标题与正文独立切换：11个普通页面接入PageFrame，共享标签稳定、栏目标题120ms淡入、正文独立过渡；三浏览器专项、115项既有回归、83项单测与生产构建通过，详情入口与WebKit时序补测见 docs/page-regions/。

- [x] 朋友圈作者与日历统一归属：列表/详情/话题页复用侧栏策略，紧凑抽屉补充资料；三主题各9个宽度点与跨断点关闭验证通过。

- [x] 文章分页动画时序与标签联动：数据接受后再过渡，保留原列表、取消旧请求并统一滚动恢复；三浏览器135项专项、9项既有回归、83项单测及生产构建通过，见 docs/content-navigation-fix/（2026-09-08）。

- [x] 全部文章/朋友圈标签栏统一：复用PostTabs的图标、间距与当前页状态，统一操作区；三主题×320/390/768/1024/1440/1920宽度的18项直接进入、键盘切换及历史往返验证通过（2026-09-08）。

- [x] 动效审查M01–M16正式整改与本机验收：113项完整生产、104项跨浏览器核心、30项跨浏览器功能、81项单测及75组响应矩阵通过；故障恢复、HMR、前后性能证据与真实设备限制见 docs/motion-remediation/（2026-09-08）。

- [x] 全站动效审查与整改方案：30类机制、24主题组合、16项分级发现和10组后续整改任务，见 docs/motion-audit/；本项记录审查阶段产物，后续正式整改见 docs/motion-remediation/。

- [x] UI/UX 审查35项整改与验收：78项单测、22项隔离生产E2E、Lint/类型/构建通过，截图与边界见 docs/ui-ux-remediation-report.md（2026-09-07）

- [x] 后台长期维护能力：创作保护、媒体、批量回收、评论审核、站点设置、会话审计、备份恢复及统一验收（详见 docs/admin-long-term-progress.md）

- [x] 后台日常管理完善（详见 docs/admin-management-progress.md）（2026-09-07 验收通过）
- [x] 文章搜索、RSS、相关推荐统一真实数据源；文章列表改为后端分页。
- [x] 文章点赞和浏览计数接入真实 API，并通过并发验证。
- [x] 闪念 HTTP 与博主身份统一，公开与管理员能力均已联调。
- [x] Dock 移动导航可访问名称与 390px 操作验证通过。

- [x] 全项目审计 28 项整改与验收（详见 docs/remediation-progress.md）（2026-09-07，旧密钥撤销验证通过）

- [x] 文章评论真实联调：按域数据源、游客评论/回复/点赞、失败恢复、浏览器与自动化验收（2026-09-06，见 docs/comment-integration-validation.md）

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
- [x] 滚动与布局容器梳理：修复 useReadingProgress 冗余 window 监听，清理 \_layout.scss 中 main-content\_\_body 与 CustomScrollbar 的 overflow 职责冲突
- [x] SEO / Meta 补齐：nuxt.config.ts 全局 title 模板 + charset + viewport + OG/Twitter 默认值，8 个页面全部补充 useSeoMeta，文章详情页 useHead 升级为 useSeoMeta 并补齐 OG + Twitter Card
- [x] 图片与首屏性能优化：文章详情封面 fetchpriority="high" 优化 LCP，PostCard alt 动态化，关键图片补 width/height 减 CLS，灯箱去 lazy，封面/头像/友链 @error 兜底（后续可引入 @nuxt/image 做 srcset/格式优化）
- [x] 主题动态加载机制：setLayoutTheme 异步化支持第三方主题加载，新增 switchingState 状态机、preloadTheme hover 预热、AppearanceDrawer loading/error 态与切换防竞态
- [x] 后台主题管理方案：registry 新增 unregisterTheme 卸载接口 + checkCompatibility 兼容性校验 + satisfiesSemver 版本匹配，useLayoutTheme 新增 disableCurrentTheme 回退能力，后端 API 路由设计已记录于方案文档
- [x] 引入 `nuxt-theme-engine`：`nuxt.config.ts` 接入模块，补齐 `theme-contracts/index.ts` 本地契约入口与 `themes/` 主题目录
- [x] 布局主题适配层迁移：`useLayoutTheme` 改为基于 `useThemeEngine()` 驱动，保留切换状态与 hover 预热能力
- [x] 根布局切换迁移：`layouts/default.vue` 改为通过 `<ThemeComponent name="RootLayout" />` 渲染当前主题根布局
- [x] 宿主主题边界拆分：新增 `features/appearance/themeRegistry.ts` 承载图标、版本与 capabilities，各主题通过 `theme.config.ts` 声明能力
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
- [x] 主题重命名：classic → nexus、docs → aurora、minimal → dock，更新所有引用与元数据
- [x] Nexus 主题增强：响应式断点下调至 lg/md、微交互克制化、CSS 变量体系（--theme-bg-surface 等）
- [x] Aurora 主题增强：新增 Hero 视觉区域（仅首页）、毛玻璃吸顶动态顶栏、滚动视差效果、渐变/模糊 CSS 变量
- [x] Dock 主题大改：底部浮岛式 Dock 导航（spring 弹性动画 + 图标联动缩放）、隐藏全局 MobileNav
- [x] 主题重构收尾：更新 directory-structure.md、theme-development-guide.md、project-analysis-report.md
- [x] 主题元信息职责分离：消除 layoutThemes.ts 与 theme.json 的重复声明，theme.json 增加 meta 字段，各主题新增 theme.config.ts 声明 capabilities，features/theme/ 重命名为 features/appearance/，新建 themeRegistry.ts 替代 layoutThemes.ts
- [x] Vite optimizeDeps 预打包：fuse.js/markdown-it/shiki 等 dev 运行时依赖显式声明，消除中途发现依赖导致的整页 reload（2026-07-20）
- [x] 开放 Dock 浮岛主题：移除外观抽屉的开发中拦截与提示，恢复 hover 预热，三套主题均可切换（2026-07-20）
- [x] 修复 formatRelativeDate：纯日期串按本地时区解析（修复 UTC 负偏移时区整体错一天），未来日期回退完整日期显示（2026-07-20）
- [x] 单元测试扩充：新增 flash 仓储 CRUD/归档/搜索/评论、Netscape 书签解析与 JSON 导入导出、闪念 Markdown 渲染与 XSS 净化共 22 个用例；补装 happy-dom + @vue/test-utils 使 nuxt 测试环境可运行（2026-07-20）
- [x] post 域接入后端 API：features/post/api.ts + usePostList，useArticleDetail 增加 HTTP 分支；useMockRepo/apiBaseUrl 读环境变量，CSP connect-src 自动放行 API origin；与 server-main 联调实测通过（2026-07-20）
- [x] 评论系统读取接入：fetchComments 对接 GET /posts/:id/comments，HTTP 模式评论区渲染数据库评论树（后端 auth + comment 模块同日落地，原暂缓阻塞解除）（2026-07-20）
- [x] vue-tsc 全量类型错误清零：修复 12 处存量错误（View Transitions 声明冲突、空数组守卫、可空图标、run 回调返回值、色板联合类型、FlashNoteDraft.isArchived、主题 PostCard 桥接 props）；CI typecheck 步骤自此为真实门禁（2026-07-20）

## 暂缓 / 阻塞

（无）
