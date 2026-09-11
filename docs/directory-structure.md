# TixXinBlog 目录与代码入口

本文维护当前目录职责和关键实现入口，不逐项复制全部组件清单。能力判断见[能力清单](capability-map.md)，使用/维护与历史设计分流见[文档导航](README.md)。文件路径以仓库实际代码为准；新增业务时同步更新其类型、维护契约与验证入口。

## 当前工作区

```text
TixXinBlog/
├── AGENTS.md                       # 项目约束与开发授权边界
├── package.json                    # 固定 pnpm/Node 与工作区命令
├── pnpm-workspace.yaml
├── Dockerfile                      # Nuxt 生产镜像
├── compose.yaml                    # 独立本地生产式编排
├── compose.production.yaml         # 固定版本、HTTPS 与可选 worker
├── deploy/                         # Caddy 配置与生产环境模板
├── scripts/
│   ├── dev.mjs                     # 开发自检与服务复用
│   ├── dev/                        # 进程生命周期与隔离启动验证
│   ├── release/                    # 默认预检的版本发布/切换
│   └── container-smoke.mjs         # 独立容器验收
├── src/
│   ├── frontend/web-blog/          # 公开网站和内置 /admin
│   └── backend/server-main/        # NestJS API、实体、迁移与运行工具
├── docs/                           # 当前契约、操作说明与文档导航
│   ├── backend/                    # 当前后端分域接口与维护入口
│   └── archive/                    # 历史设计、阶段交付和旧目标；不作为当前待办
├── .github/workflows/              # CI 检查
├── .artifacts/                     # 本机验收产物，忽略于 Git
├── .playwright-mcp/                # 本机浏览器产物，忽略于 Git
└── .backups/                       # 本机私有完整备份，忽略于 Git
```

目前只有 `web-blog` 与 `server-main` 两个已实现工作区。早期 `web-admin` 预留不对应当前独立应用；后台已经在 `web-blog/app/pages/admin/`，不需要另一个前端启动命令。`temp/` 等历史参考目录不是运行时依赖。

日常入口按职责维护：[能力清单](capability-map.md)判断实现边界，[架构基线](project-architecture.md)说明长期契约，本文定位代码；前后端 `todo.md` 只记录当前工作与明确的后续需求。历史记录从[文档导航](README.md)进入，归档时仅移动受 Git 跟踪的文字与问题清单，本机 `docs/**/evidence/` 原位置不变。

## Nuxt 前端

下列路径相对 `src/frontend/web-blog/`。

| 路径                        | 职责                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `nuxt.config.ts`            | 模块、运行配置、同源 API、SEO、安全头与构建边界                      |
| `app/pages/`                | 文件路由与页面组装；独立页用 `xxx.vue`，有子页时才用 `xxx/index.vue` |
| `app/pages/admin/`          | 工作台、内容/互动管理、站点、媒体、通知、运行与维护                  |
| `app/layouts/admin.vue`     | 后台独立滚动、导航抽屉与管理内容焦点                                 |
| `app/components/<domain>/`  | 展示与交互组件，通过 props/model/events 接受业务状态                 |
| `app/features/<domain>/`    | 领域类型、仓储、查询、编辑与映射工具；不以 mock 文件名推断持久化状态 |
| `app/composables/`          | 跨页面/组件复用的请求、编辑恢复、运行状态与界面生命周期              |
| `app/utils/`                | 地址、内容差异、存储、焦点和排版测量等工具                           |
| `app/plugins/`              | 站点初始化、启动/动效与请求级共享能力                                |
| `app/assets/styles/`        | SCSS、设计变量与共享样式                                             |
| `themes/`                   | Nexus、Aurora、Dock 三主题实现                                       |
| `theme-contracts/`          | 根布局、附件等主题插槽契约                                           |
| `server/routes/`            | Nitro RSS 等路由；业务请求通过同源网关转发                           |
| `tests/unit/`、`tests/e2e/` | Vitest 与隔离 Playwright 回归源码                                    |

### 按功能查找

| 功能                 | 关键代码                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工作台真实汇总与导航 | `pages/admin/index.vue`、`features/admin/overview.ts`、`features/admin/types.ts`                                                                         |
| 关于资料与站点版本   | `pages/admin/site.vue`、`pages/about.vue`、`features/about/settings.ts`、`features/site/editor.ts`、`composables/useSiteSettingsEditor.ts`               |
| 管理完整资料核对     | `components/admin/AboutSettingsFields.vue`、`SiteSettingsPreview.vue`；隐藏关于资料也可在历史/冲突详情核对                                               |
| 六域公开搜索         | `pages/search.vue`、`composables/useSearch.ts`、`features/search/`；单类型分页与分组预览                                                                 |
| 内容有序关联         | `features/content-relation/`、`composables/useContentRelationPicker.ts`、`components/admin/ContentRelations.vue`、`components/common/RelatedContent.vue` |
| 长文章章节与恢复     | `components/admin/PostEditor.vue`、`features/post/outline.ts`、`utils/textareaHeadingPosition.ts`、`composables/usePostEditor.ts`、`usePostRecovery.ts`  |
| 素材整理与引用       | `components/admin/MediaLibrary.vue`、`MediaPicker.vue`、`composables/useMediaLibrary.ts`、`features/media/types.ts`                                      |
| 通知与运行面板       | `pages/admin/notifications.vue`、`operations.vue`、`features/notification/types.ts`、`components/admin/OperationsSummary.vue`、`OperationTask.vue`       |
| 共用管理读取归属     | `composables/useAdminReadResource.ts`；保留失败前数据，隔离账号、内容代次和迟到请求                                                                      |
| 内容包导出/预览/迁入 | `pages/admin/maintenance.vue`、`composables/useContentBackup.ts`、`features/backup/types.ts`                                                             |
| 身份与请求上下文     | `composables/useCurrentUser.ts`、`useAdminApi.ts`、`utils/authCookieLock.ts`                                                                             |

公开文章在 `/articles/:id`，不以早期设计里的 `/posts/:slug` 文档替代实际路由。项目和图库可通过 `?project=<id>`、`?photo=<id>` 进入内容上下文；评论、留言和通知深链由服务端返回确定的目标或位置。

### 主题、动效与请求生命周期

`usePageMotion.ts`、`usePostPageMotion.ts` 和 `utils/pageMotionRegions.ts` 管理可中断页面分区动效；`usePageRequestScope.ts` 与 `utils/pageRequestCancellation.ts` 管理读取取消。`useMotionPreference.ts`、`00.motion-preference.client.ts` 处理减少动态效果；`ImageFrame.vue`、`useImageState.ts` 处理真实图片加载/错误恢复。它们不改变业务数据是否持久化，也不以动画副本作为可操作内容。

`tests/e2e/motionScreenshot.ts` 是截图入口之一：Windows WebKit 使用真实字体请求及 FontFace 状态处理已知的字体聚合等待问题，不跳过业务断言。

## NestJS 后端

下列路径相对 `src/backend/server-main/`。

| 路径                                                   | 职责                                                      |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `src/main.ts`、`src/bootstrap.ts`、`src/app.module.ts` | 启动、统一响应/验证与模块装配；HTTP 启动不执行迁移或 seed |
| `src/config/`                                          | 环境校验、脱敏日志、显式 ORM 实体注册与运行配置           |
| `src/entities/`                                        | 持久化模型；新增实体同步 `config/mikro-orm.options.ts`    |
| `src/migrations/`                                      | 正式迁移，保留兼容与结构漂移检查                          |
| `src/modules/`                                         | 各业务公开/管理接口、事务与读取投影                       |
| `src/seeders/`                                         | 显式开发数据、稳定归属、目标核对和备份工具                |
| `scripts/`                                             | 迁移入口、完整备份/恢复、持久任务 CLI 与备份接收器        |
| `tests/`                                               | 隔离 HTTP、数据工具、内容包、恢复、运行与容器验收         |
| `Dockerfile`                                           | `runtime`、`migration`、`worker` 三类执行目标             |
| `.dev-dist/`                                           | 日常 watch 编译输出，与生产 `dist/` 分开                  |
| `dist/`                                                | 生产构建与验证使用的编译输出，不在其他验收读取时重建      |
| `var/media/`                                           | 缺省受管媒体目录，可由环境指定；忽略于 Git                |

### 业务及维护模块

| 模块                                      | 关键入口与边界                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `modules/post/`                           | 文章、目录、修订、地址、批量处理；`admin-overview.controller.ts` 聚合运营工作台 |
| `modules/comment/`                        | 审核策略、可见性、可靠直接回复口径与文章评论管理                                |
| `modules/flash/`、`moment/`、`guestbook/` | 各自真实发布/互动规则，不强行套用同一状态模型                                   |
| `modules/gallery/`、`project/`、`link/`   | 图库来源互斥、项目进展/发布分离、友链目录与独立规则                             |
| `modules/site/`                           | 基础站点、关于资料与历史版本；公共响应不含隐藏个人资料                          |
| `modules/media/`                          | 文件转换/存储、素材说明、真实尺寸筛选与跨域/历史引用保护                        |
| `modules/content-relations/`              | 三域有向、有序关系的校验、管理选择及公开投影                                    |
| `modules/operations/`                     | 事务事件、站内通知、实时目标解析、运行控制、持久任务与 SMTP                     |
| `modules/backup/`                         | v9 内容包、v1–v8 兼容、预览/执行/映射、事务回滚及维护诊断                       |
| `modules/auth/`、`audit/`、`health/`      | 管理员会话、意图与结果审计、存活及就绪探针                                      |

关联存在 `post`、`project`、`gallery_photo` 的 `related_content` JSONB 数组，不是媒体引用表。媒体说明是 `media_asset.description`；关于资料属于 `site_settings`。三类运行实体 `OperationControl`、`BackgroundTask`、`OwnerNotification` 不进入公开内容包。

完整维护入口为 `scripts/full-backup.mjs`；任务 CLI 为 `scripts/operations.mjs`；显式异机传输与接收器为 `scripts/backup-transfer.mjs`。worker 镜像携带脚本和 PostgreSQL 16 客户端，媒体只读挂载，自动循环及外投默认关闭。恢复先验原表摘要，再轮换内容/运行代次、撤销会话、暂停旧队列，并在恢复副本记录真实恢复校验。

## 验证与历史资料

推荐按变更寻找对应源码，而非重复执行已通过的全部范围：

- `sustainable-admin.spec.ts`、`site-editor-protection.spec.ts`：工作台、关于、通知、运行及断点/焦点。
- `discovery-search.spec.ts`、`content-relations.spec.ts`：公开搜索、跨内容阅读与关联编辑。
- `post-outline.spec.ts`、`media-organization.spec.ts`、`admin-comment-deeplinks.spec.ts`：章节、素材和引用定位。
- 后端 `tests/operations-integration.mjs`、内容包/完整备份相关集成：持久任务、真实本机捕获、映射和恢复边界。
- 后端 `tests/post-list-performance.ts`：同条件公开列表字段投影对比，结论见[性能说明](performance-maintenance.md)。

早期动效、UI、朋友圈、图库/项目/友链等报告保留原始阶段事实，入口在[历史交付索引](README.md#历史交付与设计背景)。旧目录、旧版本号和当时测试数字不作为当前能力声明。新的截图、trace、原始报告和日志只写 `.artifacts/` 或 `.playwright-mcp/`；`docs/img/` 是既有正式文档素材，规则见[验收产物管理](verification-artifacts.md)。
