# TixXinBlog 项目目录结构

> **此文档需随开发进度实时维护更新。** 新增、删除或重命名文件/目录时，请同步修改本文档。

## 顶层目录

```
TixXinBlog/
├── .cursor/              # Cursor IDE 规则配置
├── .vscode/              # VSCode 编辑器配置
├── docs/                 # 项目文档与设计说明
├── LICENSE               # GPL-3.0 开源协议
├── package.json          # 根 package.json，pnpm 工作区编排
├── pnpm-workspace.yaml   # pnpm 工作区：包含 src/frontend/*、src/backend/*
├── README.md             # 项目说明与快速开始
├── scripts/              # 构建与维护脚本
│   └── clear.js          # 清理依赖：删除 node_modules、pnpm-lock.yaml 并执行 pnpm store prune
├── src/                  # 源代码根目录
│   ├── backend/          # 后端服务
│   └── frontend/         # 前端应用
└── temp/                 # 临时文件（UI 原型等参考资料）
```

### pnpm 工作区与子项目

根目录 `package.json` 通过 `pnpm --filter <package-name>` 调用各子项目。新增子项目时：

1. 将目录创建在已纳入 workspace 的位置：`src/frontend/*` 或 `src/backend/*`
2. 在 `src/frontend/` 或 `src/backend/` 下创建子目录，并包含 `package.json` 且设置唯一 `name`
3. 在根 `package.json` 的 `scripts` 中新增对应脚本，例如：
   - `dev:admin` → `pnpm --filter web-admin dev`
   - `dev:server` → `corepack pnpm --filter server-main start:dev`

当前子项目：`web-blog`（前台及 `/admin` 管理页）、`server-main`（后端服务）；`web-admin` 仅为历史预留。

## docs/ — 项目文档

```
docs/
├── project-architecture.md      # 项目架构基线文档（统一参考）
├── directory-structure.md       # 项目目录结构说明（本文档）
├── ui-ux-remediation-progress.md # 35项UI/UX整改状态、验证证据与隔离环境记录
├── ui-ux-remediation-report.md   # 35项整改最终结果、前后截图、测试证据与覆盖边界
├── motion-audit/               # 全站动效审查：报告、机制台账、覆盖、结构化问题、规范、整改提示词及本轮证据
├── motion-remediation-progress.md # M01–M16动效整改任务、阶段验证与剩余回归
├── theme-development-guide.md   # 主题开发指南（契约体系、开发流程、注册与最佳实践）
└── project-analysis-report.md   # 项目全面分析报告（维度评分与改进路线图）
```

## src/backend/ — 后端服务

`server-main` 已实现文章、认证、评论、闪念和就绪探针（2026-09-06），完整设计见 `docs/backend/`：

```
src/backend/
└── server-main/                       # 主后端服务（NestJS 11 + MikroORM 6 + PostgreSQL）
    ├── src/
    │   ├── main.ts                    # 入口：全局前缀 api/v1、ValidationPipe、CORS、优雅停机
    │   ├── app.module.ts              # 根模块：ConfigModule + nestjs-pino + MikroOrmModule + 业务模块
    │   ├── common/                    # 跨模块复用
    │   │   ├── constants/error-codes.ts          # 错误码枚举（对齐 docs/backend/api.md 附录 A）
    │   │   ├── decorators/visitor-id.decorator.ts # X-Visitor-Id 提取校验并哈希的参数装饰器
    │   │   ├── exceptions/business.exception.ts  # 业务异常（携带业务错误码）
    │   │   ├── filters/all-exceptions.filter.ts  # 全局异常过滤器（统一错误响应）
    │   │   ├── interceptors/response-wrap.interceptor.ts  # 成功响应包装 { code, message, data, traceId }
    │   │   └── utils/                 # trace-id、visitor-id 哈希（含单元测试）
    │   ├── config/                    # env 启动校验 + mikro-orm 配置单一来源
    │   ├── entities/                  # MikroORM 实体：Post / PostTag / PostLike / PostView
    │   ├── migrations/                # 迁移文件与 schema 快照（20260720125632_create_post_tables）
    │   ├── seeders/                   # DevSeeder：跨 workspace 读取前端 post mock 同源灌数（tsx 运行）
    │   └── modules/
    │       ├── health/                # 健康探针 /health /ready（含单元测试）
    │       └── post/                  # 文章接口:列表/详情/点赞/浏览计数（controller/service/dto）
    ├── scripts/migrate.ts             # tsx 迁移工具（initial / create / up / list / check）
    ├── mikro-orm.config.ts            # ORM CLI 入口（转发 src/config/mikro-orm.options.ts）
    ├── Dockerfile                     # 生产镜像多阶段构建（构建上下文为仓库根目录）
    ├── docker-compose.yml             # 本地依赖栈：postgres / redis / meilisearch / minio
    ├── .env.example                   # 环境变量模板
    ├── eslint.config.mjs              # 后端 ESLint 扁平配置
    ├── nest-cli.json / tsconfig*.json # Nest CLI 与 TypeScript 配置
    ├── README.md                      # 快速开始
    └── todo.md                        # 后端子项目任务清单
```

## src/frontend/web-blog/ — 博客前台

```
src/frontend/web-blog/
├── app/                       # Nuxt 4 应用目录
│   ├── app.vue                # 应用根组件（加载条、全局弹窗、页面切换过渡）
│   ├── error.vue              # Nuxt 全局错误页面（404、500 等）
│   ├── assets/                # 静态资源
│   │   └── styles/            # SCSS 样式文件
│   ├── components/            # 可复用 UI 组件
│   │   ├── ThemeComponent.vue # 主题契约组件水合安全加载器（根级）
│   │   ├── about/             # 关于我页组件
│   │   ├── article/           # 文章归档与详情组件
│   │   ├── auth/              # 登录/注册/找回弹窗组件
│   │   ├── blog/              # 博客业务组件（首页相关）
│   │   ├── common/            # 通用基础组件
│   │   ├── dev/               # 开发调试面板
│   │   ├── flash/             # 闪念编辑与展示组件
│   │   ├── gallery/           # 画廊组件
│   │   ├── guestbook/         # 留言板组件
│   │   ├── layout/            # 布局结构组件
│   │   ├── link/              # 友链页组件
│   │   ├── moment/            # 朋友圈动态组件
│   │   ├── project/           # 项目展示页组件
│   │   ├── sidebar/           # 右侧栏组件
│   │   └── tab/               # 标签页 / 书签墙组件
│   ├── composables/           # 组合式函数（跨页面逻辑）
│   ├── config/                # 站点可改配置（site.ts）
│   ├── features/              # 业务域模块（mock 数据、类型、逻辑）
│   │   ├── about/             # 关于我模块
│   │   ├── appearance/        # 外观设置模块（主题注册表 + UI 偏好常量）
│   │   ├── article/           # 文章归档模块
│   │   ├── auth/              # 登录态 mock 模块
│   │   ├── flash/             # 闪念模块（repository 接口 + local/http 双实现 + AI 搜索 mock）
│   │   ├── gallery/           # 画廊模块
│   │   ├── guestbook/         # 留言板模块
│   │   ├── link/              # 友链模块
│   │   ├── moment/            # 朋友圈模块（mock + 话题表）
│   │   ├── nav/               # 导航模块
│   │   ├── post/              # 文章模块
│   │   ├── project/           # 项目展示模块
│   │   ├── site/              # 站点模块
│   │   ├── stats/             # 统计模块
│   │   └── tab/               # 标签页模块（repository 双实现、favicon、导入导出、壁纸）
│   ├── layouts/               # 页面布局（default.vue 将 NuxtPage 作为 slot 传入主题布局）
│   ├── pages/                 # 文件系统路由页面
│   │   ├── admin/moments/     # 博主发布编辑器（owner 守卫）
│   │   ├── articles/          # 文章详情子路由
│   │   ├── flash/             # 闪念列表与详情
│   │   └── moments/           # 朋友圈列表、详情与话题聚合
│   ├── plugins/               # 插件（主题预热、repository 注入与 useMockRepo 切换）
│   └── utils/                 # 工具函数（闪念 Markdown、IndexedDB 壁纸、主题组件缓存）
├── public/                    # 公共静态资源（不经编译）
├── server/                    # Nitro 服务端路由
│   └── routes/                # RSS（rss/moments/flash.xml）与公开 JSON API（api/*.json）
├── tests/                     # Vitest 单元测试
│   └── unit/                  # useRelativeDate、flash 仓储、书签导入导出、闪念 Markdown
├── theme-contracts/           # 本地主题契约入口（RootLayout、ThemeAccessory、StatusFooter、SidebarNav、PostCard）
├── themes/                    # 主题引擎主题目录（theme.json + app/components，布局实现直接在 RootLayout.vue 中）
│   ├── nexus/                 # Nexus 三栏主题（默认；含 SidebarNav 与多张侧栏卡片）
│   ├── aurora/                # Aurora 双栏主题（Hero + 毛玻璃吸顶顶栏）
│   └── dock/                  # Dock 浮岛主题（底部 Dock 导航，2026-07-20 起开放切换）
├── nuxt.config.ts             # Nuxt 配置文件
├── package.json               # 依赖与脚本
├── vitest.config.ts           # Vitest 配置（environment: nuxt）
├── todo.md                    # web-blog 开发待办文档，维护当前任务清单与总进度
├── tsconfig.json              # TypeScript 配置
└── .npmrc                     # npm/pnpm 配置
```

## 样式文件详情

```
app/assets/styles/
├── main.scss              # 全局样式入口，按顺序引入各模块
├── _tokens.scss           # SCSS 编译时变量（断点、圆角、间距、字体）
├── _variables.scss        # CSS 自定义属性；封面叠层、置顶徽标（--pin-badge-*）、页面玻璃态（--surface-1-alpha*）、Tooltip 浮层（--tooltip-*）
├── _base.scss             # 全局基础样式（重置、排版、滚动条、选区）
├── _components.scss       # 全局共享组件样式（卡片、导航、Tab、按钮等）
├── _layout.scss           # 页面布局样式（两级网格、断点响应、滚动行为）
└── _utilities.scss        # 工具类（文本截断、动画延迟等辅助类）
```

## 组件文件详情

### components/about/ — 关于我页组件

| 文件                   | 职责                                          |
| ---------------------- | --------------------------------------------- |
| AboutHero.vue          | 个人信息 Hero：头像、简介、社交链接按钮       |
| SkillBars.vue          | 技能进度条，双列网格展示技能熟练度            |
| ExperienceTimeline.vue | 经历时间线，按时间顺序展示职业和学历          |
| ContactCards.vue       | 联系方式网格，展示邮件、GitHub、Twitter、微信 |
| HobbyCard.vue          | 兴趣爱好卡片，Lucide 图标展示爱好标签         |
| ReadingCard.vue        | 最近在读卡片，展示书籍列表                    |
| DonateCard.vue         | 打赏卡片，可复用于关于页和文章详情页          |

### components/article/ — 文章归档与详情组件

| 文件                | 职责                                               |
| ------------------- | -------------------------------------------------- |
| ArchiveTimeline.vue | 按年份分组的时间线容器，含年份徽章与轨道           |
| ArchiveItem.vue     | 单条归档记录：时间线节点、日期、分类标签与标题链接 |
| ArchiveStats.vue    | 侧栏归档概览统计与分类分布进度条                   |
| ArticleContent.vue  | 文章正文块渲染（标题、段落、代码、引用、列表）     |
| ArticleNav.vue      | 上一篇 / 下一篇导航卡片                            |
| CommentSection.vue  | 评论区：输入区与列表（含一层回复缩进）             |
| RelatedPosts.vue    | 右侧栏相关文章列表                                 |
| StickyHeader.vue    | 文章详情粘性顶栏：返回、标题与元信息               |
| TableOfContents.vue | 右侧栏目录，层级缩进与当前章节高亮                 |

### components/blog/ — 博客业务组件

| 文件                | 职责                                                     |
| ------------------- | -------------------------------------------------------- |
| PostCard.vue        | 文章卡片，展示封面、标题、摘要、标签和元信息             |
| PostCardList.vue    | 文章卡片列表，按 Tab 过滤并渲染文章                      |
| PostTabs.vue        | 文章分类 Tab 栏与搜索输入框                              |
| AppearanceEntry.vue | 左侧栏界面设置入口，展示当前主题与动画摘要并打开设置抽屉 |
| SubscribeCard.vue   | 邮件订阅卡片，提供邮箱输入和订阅按钮                     |
| ThemeSwitcher.vue   | 主题切换器，支持亮色/跟随系统/暗色三种模式               |

### components/common/ — 通用基础组件

| 文件                 | 职责                                                       |
| -------------------- | ---------------------------------------------------------- |
| AppearanceDrawer.vue | 全局界面设置抽屉，集中管理颜色主题、主内容动画和左侧栏动画 |
| BaseCard.vue         | 通用卡片容器，支持可选的 hover 效果                        |
| PageHeader.vue       | 通用页面标题组件，带图标、标题和副标题                     |
| ReadingProgress.vue  | 固定在视口顶部的阅读进度条（3px，强调色）                  |
| SearchBox.vue        | 通用搜索框组件，多页面复用                                 |
| StateBlock.vue       | 通用状态提示组件，用于空态、404、500 等场景                |
| Tooltip.vue          | 通用 Tooltip 提示组件，支持自动定位、明暗适配与方向箭头    |

### components/gallery/ — 画廊组件

| 文件              | 职责                                          |
| ----------------- | --------------------------------------------- |
| GalleryFilter.vue | 画廊分类筛选按钮组，v-model 绑定当前分类      |
| GalleryGrid.vue   | CSS columns 瀑布流容器，向父级抛出选中照片    |
| GalleryItem.vue   | 单张照片卡片，悬停渐变遮罩与元信息            |
| GalleryStats.vue  | 右侧栏画廊统计卡片                            |
| GearCard.vue      | 右侧栏拍摄器材信息卡片                        |
| LightBox.vue      | 全屏灯箱预览大图与说明（Teleport + ESC 关闭） |

### components/guestbook/ — 留言板组件

| 文件                | 职责                                    |
| ------------------- | --------------------------------------- |
| GuestbookHeader.vue | 聊天式顶栏：标题、留言总数、在线状态点  |
| MessageBubble.vue   | 单条留言气泡（访客左对齐 / 博主右对齐） |
| MessageList.vue     | 按日期分组列表与日期分隔徽标            |
| MessageInput.vue    | 底部工具栏占位与可编辑输入区、发送按钮  |
| ChatStats.vue       | 右侧栏对话统计（总留言、活跃用户等）    |
| ChatRules.vue       | 右侧栏对话守则编号列表                  |
| ActiveMembers.vue   | 右侧栏活跃成员头像与留言数              |

### components/layout/ — 布局结构组件

| 文件             | 职责                                   |
| ---------------- | -------------------------------------- |
| MobileNav.vue    | 移动端底部导航栏                       |
| SidebarNav.vue   | 桌面端左侧栏导航                       |
| StatusFooter.vue | 站点底部页脚，展示版权、链接和系统状态 |

### components/link/ — 友链页组件

| 文件             | 职责                                   |
| ---------------- | -------------------------------------- |
| LinkCard.vue     | 单个友链卡片：头像、站点名、描述、域名 |
| LinkGrid.vue     | 友链网格容器，响应式三列布局           |
| LinkForm.vue     | 申请友链表单（纯 UI，不实现提交逻辑）  |
| LinkRules.vue    | 友链须知卡片，编号列表展示规则         |
| SiteInfoCard.vue | 本站信息卡片，展示站点名称、地址和描述 |

### components/project/ — 项目展示页组件

| 文件              | 职责                                              |
| ----------------- | ------------------------------------------------- |
| ProjectCard.vue   | 项目卡片：封面、状态标签、Star 数、技术标签、链接 |
| ProjectGrid.vue   | 项目网格容器，响应式两列布局                      |
| ProjectStats.vue  | 项目概览统计卡片（总项目数、Star、Fork）          |
| TechStackCard.vue | 技术栈进度条卡片                                  |

### components/sidebar/ — 右侧栏组件

| 文件              | 职责                                      |
| ----------------- | ----------------------------------------- |
| CategoryCard.vue  | 专栏分类卡片，展示分类列表及文章数量      |
| HeatmapGrid.vue   | 活跃度热力图，GitHub 风格网格展示近期活动 |
| RightSidebar.vue  | 右侧栏容器，包裹所有右侧卡片子组件        |
| SiteStatsCard.vue | 站点统计卡片，展示运行天数、文章数等数据  |
| TagCloudCard.vue  | 标签云卡片，多行滚动展示标签              |

## 业务域模块详情

### features/ — 按领域组织的业务模块

下表列出展示类型与演示数据资源；它不代表生产页面的数据源。文章、认证、评论与闪念已通过 API 接入，书签明确使用 LocalStorage。

### 真实业务与验收入口（2026-09-06）

- `app/pages/admin/`、`app/layouts/admin.vue`、`app/components/admin/`：博主登录、真实概览、文章草稿/发布/撤回、评论上下文、闪念管理、分类标签和账号安全。
- `app/composables/useAdminApi.ts`、`useCurrentUser.ts`、`usePostEditor.ts`：真实认证、请求和编辑状态；`useAdminFlashes.ts` 管理后台闪念分页与操作状态。
- `app/composables/usePostMetadata.ts`：公开文章归档、分类标签及统计。
- `server/api/v1/[...path].ts`：同源网关；`server/utils/publicContent.ts`：RSS、JSON feed 与 sitemap 的公开数据查询。
- `tests/unit/`、`tests/e2e/`：单元测试与隔离生产浏览器回归；`playwright.config.ts`：浏览器验收配置。
- `src/backend/server-main/src/modules/`：auth、post、comment、flash、health；`src/migrations/`：正式迁移。
- `src/backend/server-main/src/admin-bootstrap.ts`：只创建管理员的生产初始化入口；`tests/`：隔离数据库 HTTP 与浏览器测试驱动。
- 根 `compose.yaml`、`scripts/container-smoke.mjs`、`scripts/check-secrets.mjs`：生产式编排、容器故障恢复验收与秘密扫描。

以下前端路径均相对于 `src/frontend/web-blog/`；后端及根目录路径已显式注明。

| 模块     | 路径                   | 导出内容                                                                                                                                                                                          |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 关于我   | `features/about/`      | `mockProfile`、`mockSkills`、`mockExperiences`、`mockContacts`、`mockHobbies`、`mockReadings` 及 `Profile`、`SkillItem`、`ExperienceItem`、`ContactItem`、`HobbyItem`、`BookItem`                 |
| 文章归档 | `features/article/`    | `mockArchiveYears`、`mockArchiveStats`、`mockCategoryDistribution` 及 `ArchivePost`、`ArchiveYear`、`ArchiveStat`、`CategoryDistribution`                                                         |
| 画廊 | `features/gallery/` | 真实作品/管理/器材类型、URL查询规范化、编辑恢复白名单；仓储为`useGalleryRepository`，公开流为`useGallery` |
| 留言板   | `features/guestbook/`  | 真实留言、回复、统计与管理类型，查询和输入规范化；公开列表与后台通过仓储访问真实API |
| 友链     | `features/link/`       | 真实友链/管理类型、URL查询、编辑恢复、本站资料映射；仓储`useLinkRepository`与列表`useLinks`，本机资料整理明确不提交申请 |
| 导航     | `features/nav/`        | `mockNavItems`、`NavItem`                                                                                                                                                                         |
| 文章     | `features/post/`       | `mockPosts`、`mockPostTabs`、`mockArticleDetail`、`mockComments`、`mockRelatedPosts`、`mockTocItems` 及 `PostItem`、`ArticleDetail`、`ArticleSection`、`CommentItem`、`RelatedPost`、`TocItem` 等 |
| 项目展示 | `features/project/` | 真实项目、独立进展/发布类型、URL查询与恢复白名单；仓储`useProjectRepository`、列表`useProjects`及真实全站项目搜索 |
| 站点     | `features/site/`       | `mockFooterLinks`、`mockPoweredBy`、`mockSiteStatus`、`FooterLink`、`PoweredByItem`、`SiteStatus`                                                                                                 |
| 统计     | `features/stats/`      | `mockSiteStats`、`mockTags`、`mockCategories`、`SiteStats`、`TagItem`、`CategoryItem`                                                                                                             |
| 外观设置 | `features/appearance/` | `themeRegistry.ts`（主题注册表：ThemeHostConfig 导入、LayoutThemeMeta 类型、工具函数）、`types.ts`（COLOR_MODE_OPTIONS、CONTENT_TRANSITION_PRESETS、SIDEBAR_ANIMATION_PRESETS 及对应类型）        |

## 组合式函数

| 文件                                   | 职责                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| composables/useAppearanceSettings.ts   | 管理界面设置抽屉状态、动画偏好与本地持久化，并复用主题切换能力       |
| composables/useTheme.ts                | 颜色主题切换逻辑，封装 colorMode 的读取与设置                        |
| composables/useLayoutTheme.ts          | 布局主题管理，运行时切换三栏/双栏/单栏布局并通过 cookie 持久化       |
| composables/useNavItems.ts             | 导航数据源，封装导航菜单项获取逻辑（当前返回 mock，后续替换为 API）  |
| composables/useSiteInfo.ts             | 站点信息数据源，封装页脚链接、技术栈和状态获取逻辑（当前返回 mock）  |
| composables/useSidebarExitAnimation.ts | 右侧栏页面切换退出动画，导航前克隆内容播放离场动画，供各布局主题复用 |
| composables/useReadingProgress.ts      | 文章正文阅读进度0–100，按实际滚动根计算，不计入评论区                   |
| composables/useTableOfContents.ts      | 根据实际滚动位置及粘性标题高度高亮目录，支持长章节与文末               |
| composables/useModalFocus.ts           | 模态弹层栈、焦点约束/归还、背景隔离与嵌套滚动锁                       |
| composables/usePostListRoute.ts        | 以URL为文章页码、分类、标签与显示模式的单一状态来源                   |
| features/post/listQuery.ts             | 文章列表查询参数校验与规范序列化                                     |
| composables/usePageScrollRestoration.ts | 按浏览器历史项恢复主内容的内部或文档滚动位置                         |
| composables/useMomentOverview.ts       | 朋友圈统一作者资料、公开社交入口与示例统计口径                       |
| features/post/commentSession.ts        | 按Nuxt应用会话与文章隔离的评论控制器，主题重挂保留输入和在途状态       |
| utils/scrollRoot.ts                    | 识别真实滚动根、测量文章顶栏偏移和定位标题                             |
| components/common/ContextDrawer.vue    | 小屏与无侧栏主题的筛选、目录、完整导航抽屉                             |
| tests/unit/postList.test.ts            | 连续文章集合、模式切换、筛选、追加失败和旧响应竞态回归                 |
| tests/unit/postListQuery.test.ts       | URL默认/非法参数与组合筛选状态往返                                   |
| tests/unit/commentSession.test.ts      | 评论会话、文章隔离与退出后的草稿清理                                 |
| tests/unit/flashNoteCard.test.ts        | 实际闪念组件的Boolean缺省值和公开/只读/busy限制                       |
| tests/unit/likesPersistence.test.ts     | 本机收藏存储失败保留状态，存储恢复后可继续保存                         |
| tests/e2e/ux-remediation.spec.ts        | 隔离生产环境的UI整改专项浏览器验收                                   |
| tests/e2e/flash-ux.spec.ts              | 闪念公开互动、权限状态、失败重试、过滤提示和资源状态码验收             |
| tests/e2e/reading-ux.spec.ts            | 长标题、正文、目录落点/高亮、阅读进度与分享锚点的浏览器验收           |
| composables/useArticleDetail.ts        | 按配置读取Mock/API文章，布局切换复用当前已读快照，普通导航仍取接口   |
| composables/usePostListPagination.ts   | 文章列表分页与瀑布流懒加载逻辑，含 IntersectionObserver 管理         |
| composables/usePostListAnimation.ts    | 文章列表瀑布流模式下新卡片交错入场动画控制                           |
| composables/useRelativeDate.ts         | 日期相对时间格式化工具，7 天内显示相对时间，否则显示完整日期         |

## 页面

| 文件                     | 路由            | 职责                                             |
| ------------------------ | --------------- | ------------------------------------------------ |
| pages/index.vue          | `/`             | 文章列表，URL控制分类/标签/分页/连续加载，旧朋友圈锚点兼容转到统一列表 |
| pages/moments/index.vue  | `/moments`      | 统一朋友圈入口，共享搜索、话题和日期URL状态 |
| pages/articles/[id].vue  | `/articles/:id` | 文章详情页：正文、目录、评论、相关文章与打赏卡片 |
| pages/gallery.vue        | `/gallery`      | 画廊页，分类筛选、瀑布流与灯箱                   |
| pages/guestbook.vue      | `/guestbook`    | 留言板页，聊天式列表与侧栏统计/守则/活跃成员     |
| pages/links.vue          | `/links`        | 真实友链网格、规则与本站资料，本标签页资料整理不提交申请             |
| pages/projects.vue       | `/projects`     | 项目展示页，项目卡片网格与技术栈统计             |
| pages/about.vue          | `/about`        | 关于我页，个人信息、技能、经历、联系方式         |

## .cursor/rules/ — Cursor 规则

```
.cursor/rules/
├── main.mdc                   # 项目级架构约束（全局生效）
├── mcp.mdc                    # MCP 服务器使用规则（全局生效）
├── git-commit-message.mdc     # Git 提交消息规范（全局生效）
└── frontend/
    └── nuxt4.mdc              # Nuxt 4 前端规范（src/frontend/** 生效）
```

## src/frontend/web-admin/ — 后台管理前端

独立应用暂未开发；当前博主后台已经位于 `web-blog/app/pages/admin/`。

### 创作保护工作区

`app/components/admin/PostWorkspace.vue` 统一新建和编辑页；`PostHistory.vue` 提供修订分页与比较，`PostConflict.vue` 复用内容比较。`usePostRecovery.ts` 与 `utils/postRecovery.ts` 管理本机副本；`utils/postDifference.ts` 提供长正文差异。后端 `post-revisions.service.ts` 管理内容快照，`taxonomy-aliases.ts` 解析历史目录名。

### 媒体资源

后台 `app/pages/admin/media.vue` 使用可复用 MediaLibrary/MediaPicker；useMediaUpload 提供真实 XHR 进度与幂等重试。CommonContentImage 直接显示已经优化的受管图片。后端 modules/media 通过 MediaStorage 接口读写文件，media_asset/media_reference 持久化元信息与引用。生产 compose 使用 media-data 卷，开发 var/media 排除出 Git 与构建上下文。


### 管理后台长期维护新增模块

- 后端 `modules/backup`：内容包导出、校验、预览、事务迁入与运行诊断；`scripts/full-backup.mjs`：一致快照和隔离恢复。
- 后端 `modules/audit`：持久化意图、白名单摘要、失败补全及只读检索；`auth-sessions.service.ts`：稳定会话撤销。
- 前端 `pages/admin/site.vue`、`audit.vue`、`maintenance.vue`：站点设置、审计和备份维护；业务状态分别在对应 composable。
- `MediaWorkspace` 编排 `useMediaLibrary`，`MediaLibrary` 仅接收 props 展示，媒体选择器复用同一流程。
- `.backups` 为本机私有数据目录，从 Git 和 Docker 上下文排除。备份/恢复说明见 `docs/backup-and-recovery.md`。

### 动效整改新增模块

- `app/composables/useMotionPreference.ts` 与 `app/plugins/00.motion-preference.client.ts`：应用级系统偏好订阅及水合后同步。
- `app/composables/usePageMotion.ts`：页面实例独立于视觉动效，维护可中断的进入、离场和焦点完成通知。
- `app/utils/colorMotion.ts`：文档级颜色事务、取消和即时降级；`app/utils/elementMotion.ts` 与 `app/composables/useEntranceMotion.ts`：受组件作用域管理的元素入场。
- `app/utils/themeRuntime.ts`、`app/types/theme-host.d.ts`：按需主题预加载、截止时间及构建期宿主元数据类型。
- `app/components/common/ThemeLoadError.vue` 与 `public/startup-guard.js`：组件加载失败、入口失败和超时的可恢复反馈；守卫在构建期内联，避免依赖另一份网络脚本。
- `app/composables/useImageState.ts`、`app/components/common/ImageFrame.vue`、`app/plugins/image-motion.client.ts`：稳定图片占位、解码/重试与实际加载后的揭示。
- `tests/unit/motionLifecycle.test.ts`：旧颜色事务与列表卸载中断回归；`tests/e2e/motion-remediation.spec.ts`：三主题快速导航、焦点、偏好、订阅及图片恢复回归。
- `tests/e2e/motion-features.spec.ts`：隔离长文、滚轮中断、有效拖拽、键盘替代、AI搜索及嵌套弹层；`playwright.motion.config.ts`提供三浏览器验证配置。

- `app/composables/usePageRequestScope.ts`、`app/utils/pageRequestCancellation.ts`：页面读取的取消信号与显式预期取消；共享评论提交不随页面销毁中断。
- `app/utils/modalFocusOrigin.ts`、`app/plugins/modal-focus-origin.client.ts`：应用级指针入口记录，兼容WebKit点击按钮不自动聚焦的行为。
- `app/utils/themeComponentCache.ts`：客户端共享、SSR按Nuxt请求隔离的组件缓存；热更新后新SSR请求使用新模板。
- `tests/e2e/motionScreenshot.ts`：等待实际字体请求与FontFace状态后采集原生截图，保留正常动画。
- `docs/motion-remediation/`：逐项处理报告、覆盖记录、动效规范及性能结论；原审查 `docs/motion-audit/` 保留整改前事实。原始截图、轨迹与日志仅在本地 `evidence/` 留存。

### 内容标签与分页

- `app/components/blog/PostTabs.vue`：文章页与朋友圈共用的图标及内容导航，提供一致的当前页状态和键盘焦点。
- `app/composables/usePostPageMotion.ts`：已接受的新分页内容触发可取消入场，遵守内容预设与系统减少动态效果。
- `usePostList.ts` 保留等待/失败时的原列表并向传输层传递取消信号；`usePostListPagination.ts` 区分显式翻页与串行触底追加，滚动位置交由URL历史恢复统一管理。
- `tests/e2e/content-tabs.spec.ts`、`post-pagination.spec.ts`：多主题多尺寸标签往返、慢请求、分页时序、错误恢复及跨页联动回归。
- `docs/content-navigation-fix/`：本轮原因、处理方式及三浏览器结果；实际动画视频和帧数据仅保留本地路径说明。

### 页面分区与朋友圈资料归属

- `app/components/common/PageFrame.vue`：`headerKey` 与 header/default/overlays 插槽，SSR直接输出标题、正文和独立浮层；保留原页面状态与事件。
- `app/utils/pageMotionRegions.ts`：显式区域定位及请求级pending注入；`usePageMotion`按标题组和正文边界分别播放、取消与清理动效，特殊页面继续使用原边界。
- `app/composables/useMomentSidebarPlacement.ts`：作者和日历按主题与断点分配，监听由页面作用域持有；`app/components/moment/InfoDrawer.vue`仅展示固定侧栏缺失的信息。
- `CommonContextDrawer`支持可选`v-model:open`以处理布局变化，并在打开前确定可恢复的入口焦点。
- `tests/e2e/page-regions.spec.ts`、`moment-sidebar.spec.ts`：分区、SSR、慢导航、侧栏去重、跨主题/断点、日期状态和焦点回归；结果见`docs/page-regions/`。

### 本地验收产物

新的截图、录屏、trace 和原始报告写入被忽略的 `.playwright-mcp/` 或 `.artifacts/`。历史 `docs/**/evidence/` 与 `docs/git-validation/` 仅留本机副本，Git 保留文字结论、正式回归脚本及 `docs/img/` 文档素材。存放、复验和分享规则见[验收产物管理](verification-artifacts.md)。

### 内容服务故障恢复

- `app/components/common/RequestFeedback.vue`：加载、失败与重试反馈；`sidebar/PostFilters.vue`：标签与分类的共享展示状态。
- `usePostMetadata.ts` 保留最后成功统计；`useFlashNotes.ts` 与闪念页面区分主列表、归档箱和身份变化的请求状态。
- `tests/e2e/service-recovery.spec.ts` 与两份仓库/统计单测覆盖故障恢复。根目录 `dev:api` 启动后端，启动步骤及验收结果见[服务恢复记录](service-recovery.md)。
