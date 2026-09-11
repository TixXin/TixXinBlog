# Web Blog 开发 Todo

## 可持续运营建设（当前 P0–P2）

- 本轮七项已完成 7 项，完成率 100%；包含本机实现、日常样本、维护兼容、必要验证、文档、清理与本地提交。
- 已交付真实关于资料、跨域工作台、发布运行、六域搜索、长文素材关联、通知、性能与维护收敛。
- 称呼 `tixxin` 已确认，其余个人事实缺省或隐藏；生产发布、真实外投与长期任务未启用。
- 清单见 [阶段跟踪](../../../docs/sustainable-blog-stage.md)，使用与证据见 [最终验收](../../../docs/sustainable-blog-verification.md)。

## 图库外链与后台工作区（已归档）

- 本阶段2项任务，已完成2项，完成率100%；只对应本轮两项扩展。
- [x] 图库外链：互斥来源、编辑/预览/恢复、媒体引用、v7维护、日常4条增量样本和三浏览器验收。
- [x] 后台工作区：独立滚动、移动抽屉、共用操作栏、列表返回及全部入口巡检。
- 前端227项单测、相关三浏览器243项、静态检查、独立生产构建及日常只读验收通过；隔离资源已清理，日常服务与备份保留。
- 使用及验收记录见 `docs/gallery-external-admin-verification.md`，实际浏览器/系统缩放、真机触控和系统辅助技术属于已记录的环境边界。

> 本文档用于维护 `src/frontend/web-blog/` 当前阶段的开发待办、总体进度与状态变化。开发前先阅读，开发中同步更新，开发完成后复核总进度与任务状态。

## UI 收尾阶段进度（已归档）

- 总任务数：65
- 已完成：65
- 进行中：0
- 未开始：0
- 暂缓：0
- 完成率：100%

## 可靠启动与朋友圈真实业务（已归档）

- 本阶段任务数：7；已完成：7；进行中：0；未开始：0。
- 完成率：100%，仅对应可靠启动与朋友圈真实业务阶段，不代表所有业务已接入真实 API。
- 验收和实现记录见 `docs/next-stage.md`。

## 开发数据保障与留言板真实业务（已归档）

- 本阶段7项模块均已完成：数据检查、增量样本、留言API、前台交互、后台管理、维护兼容、完整验收。
- 当前完成率100%，只对应本阶段，不代表项目、图库、友链或书签云同步已经实现。验收见 `docs/guestbook-stage-verification.md`。
- 跟踪见 `docs/guestbook-stage.md`。

## 图库、项目与友链真实业务（已归档）

- 本阶段总任务数：3；已完成：3；进行中：0；未开始：0。
- 完成率：100%，仅对应本轮三个模块的完整业务交付；每项包含数据、维护兼容、验收与本地提交。
- [x] 图库：真实作品与媒体关系、公开及管理 API、页面、样本、维护与验收；见 `docs/gallery-stage-verification.md`。
- [x] 项目：真实项目与标签、公开及管理 API、页面、样本、维护与验收；见 `docs/project-stage-verification.md`。
- [x] 友链：真实站点维护、公开及管理 API、页面、日常18条样本、v6维护与联合验收；见 `docs/link-stage-verification.md`。
- 最终224项前端单测、三浏览器801项、启动与生产验收、日常数据保留和隔离清理均完成；入口与命令见 `docs/gallery-project-link-delivery.md`。
- 实施记录见 `docs/gallery-project-link-stage.md`。

## 维护约定

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 暂缓 / 阻塞
- 开始新任务前，先把对应事项移入合适状态，并更新总进度
- 开发过程中任务范围、优先级或阻塞状态发生变化时，必须同步更新本文档
- 完成任务后，先更新本文档，再结束本轮开发

## 当前进行中

本轮七项无进行中事项；未授权的生产启用与新增业务分别列为后续动作。

## 待处理

以下事项不计入本轮七项建设完成率：

- [x] 开发测试数据保障与留言持久化、审核和后台管理，已归档至留言阶段验收记录。
- [x] 整理已确认的个人资料及基于仓库事实的内容草稿；未确认事实保持隐藏。
- [ ] 补充个人事实、审阅草稿和生产内容；推送、部署、长期任务与真实外投按目标另行授权。
- [ ] 友链公开申请、访客邮件订阅、自动探活和站点资料抓取另行规划；博主站内通知与 SMTP 通道本轮已实现。
- [ ] 项目外部指标与仓库自动同步，另行确定可信来源和更新策略。
- [ ] 书签当前继续使用本机存储，云同步作为独立需求评估。

## 本阶段已完成

- [x] 日常开发数据补正（2026-09-09）：实际补入18条朋友圈动态及18条评论，恢复照片墙、话题、回顾和当前月日历；三主题桌面/手机验证通过。后续功能必须交付可用测试数据，规则已写入AGENTS.md，见 docs/moment-development-data-repair.md。

- [x] 朋友圈实体、迁移、公开与管理 API、权限及稳定分页；87请求隔离集成和后端43项单测通过，见 docs/backend/moments.md。

- [x] 完整验收交付：前台103项单测、172项相关浏览器用例分批通过、前后端Lint/类型/独立构建、日常服务自检及数据保护，见 docs/next-stage-verification.md。

- [x] 朋友圈前台真实数据、互动、URL筛选与输入恢复；真实业务浏览器验证与缓存单测，见 docs/moment-business.md。

- [x] 后台朋友圈管理、媒体引用、v1/v2内容包和完整备份恢复，见 docs/backend/moment-maintenance.md。

- [x] 默认预览的开发样本、清空和重建工具；隔离备份、去重、已编辑样本保留及依赖失败回滚通过，见 docs/development-database.md。

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
