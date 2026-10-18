# 新增内容模块

本文以现有友链模块为例，说明一个内容模块从持久化、公开读取、后台编辑到迁入和完整恢复的接入位置。所有文件路径均相对仓库根目录；接口路径省略 `/api/v1`。先阅读[贡献指南](../CONTRIBUTING.md)、[架构](architecture.md)、[API 契约](api.md)和[开发指南](development.md)，再按以下顺序核对改动。

友链由博主管理，公开页为 `/links`，后台为 `/admin/links`。它使用真实 API，具有草稿、公开、撤回、软删除、推荐和独立规则配置；公开申请、自动探活和站点抓取未开放。公开表单只保存本机输入和复制资料。新增模块应先明确自己的状态、权限、删除和恢复语义，不能直接套用友链或文章的全部能力。

## 1. 定义实体并接入正式迁移

| 当前文件                                                                    | 核对与改动位置                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/backend/server-main/src/entities/friend-link.entity.ts`                | 业务字段、发布状态、推荐、排序、版本、提交标识、发布时间、删除时间和可选 Logo 关系。 |
| `src/backend/server-main/src/entities/link-settings.entity.ts`              | 独立配置的规则与版本；不把配置版本混入每条内容的版本。                               |
| `src/backend/server-main/src/config/mikro-orm.options.ts`                   | 在 `ORM_ENTITIES` 显式登记实体，供 HTTP、迁移及维护工具共同使用。                    |
| `src/backend/server-main/src/migrations/20260910155200_add_friend_links.ts` | 既有建表、索引、约束、默认配置行及媒体引用外键的实现范例。                           |
| `src/backend/server-main/src/migrations/.snapshot-tixxin_blog.json`         | 与实体和正式迁移对应的结构快照。                                                     |

正式持久字段或关系变化需新增迁移并同步结构快照，不修改已发布迁移来改变旧库。既有行的缺省值、历史保留和约束升级都要有明确处理。迁移生成、回放与 `migration:check` 按[开发指南](development.md#安装与配置)在核对过的目标上进行，HTTP 启动不代做迁移。

友链软删除保留记录与提交墓碑，没有文章式的历史修订实体或回收站恢复接口。新模块若需要历史修订，应另外核对 `src/backend/server-main/src/entities/post-revision.entity.ts` 与 `src/backend/server-main/src/modules/post/post-snapshot.ts`，不能把一个 `deletedAt` 字段当成完整恢复方案。

## 2. 定义 DTO、规范化与业务校验

- `src/backend/server-main/src/modules/link/link.dto.ts` 区分公开查询、管理查询、保存、删除版本和规则配置 DTO。核对分页上限、允许状态、UUID、整数范围、可选字段以及 `null` 的清空语义。
- `src/backend/server-main/src/modules/link/link-values.ts` 统一地址规范化、Logo 来源互斥与业务值校验，服务写入和内容包解析复用这些规则。友链地址保留路径、查询和片段的语义；外部 Logo 要求 HTTPS，不能用外链形式绕过受管媒体引用。
- `src/backend/server-main/src/common/validators/max-utf16-length.ts` 提供与浏览器 `maxlength` 一致的 UTF-16 长度校验；超限应拒绝，不截断后保存。
- `src/backend/server-main/src/bootstrap.ts` 已注册全局 `ValidationPipe` 的白名单、未知字段拒绝与类型转换，以及统一前缀和响应处理。新模块沿用此入口，不另设宽松解析路径。

友链复用一个保存 DTO，`requestId` 与 `revision` 的操作约束由 `link.service.ts` 继续校验：创建必须带 `requestId` 且不能带 `revision`，修改必须带 `revision` 且不能带创建标识。不要仅凭 DTO 的可选标记推断接口允许省略这些保护。

## 3. 装配公开接口、后台接口与写入规则

| 当前文件                                                        | 核对与改动位置                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/backend/server-main/src/modules/link/link.controller.ts`   | 公开列表、metadata、详情；后台列表、详情、创建、修改、删除、创建结果查询和规则读写。 |
| `src/backend/server-main/src/modules/link/link.service.ts`      | 查询、真实聚合、公开/管理投影、事务、版本冲突、提交去重、软删除和配置保存。          |
| `src/backend/server-main/src/modules/link/link.module.ts`       | 引入认证模块，装配控制器与服务。                                                     |
| `src/backend/server-main/src/app.module.ts`                     | 登记业务模块，复用现有全局限流与审计装配。                                           |
| `src/backend/server-main/src/common/guards/admin-auth.guard.ts` | 后台持久会话与写入内容上下文校验。                                                   |
| `src/frontend/web-blog/server/api/v1/[...path].ts`              | Nuxt 同源网关的顶层路径白名单；新增公开 API 前缀时同步登记。                         |

友链的公开入口是 `GET /links`、`GET /links/metadata`、`GET /links/:id`。后台提供 `GET/POST /admin/links`、`GET/PATCH/DELETE /admin/links/:id`、`GET /admin/links/submissions/:requestId` 和 `GET/PATCH /admin/links/settings`；DELETE 的版本来自 query。

实现新模块时，逐项核对以下现有保护：

1. 公开列表、详情、统计只处理可公开且未删除的内容；友链按推荐、排序值、ID 倒序，公开投影不暴露管理状态、版本和提交标识。分页和总数来自服务端，失败不能伪装为空列表或零统计。
2. 管理控制器挂 `AdminAuthGuard`。内容恢复后，缺少被要求的上下文返回 428，过时代次或版本冲突返回 409，不能重新登录后覆盖旧页面对应的同编号内容。
3. 创建重试使用同一 UUID v4 `requestId`，相同规范化输入返回原结果，不同输入或已删除提交冲突；网络结果未知时查询原提交。修改、删除在事务内核对版本，保留删除墓碑。
4. 独立表达本域约束：普通友链创建/改址禁止与任何未删除同址记录重复，内容包明确复制可以生成同址草稿，同址最多一条公开记录。此规则不应未经分析推广到其他模块。

## 4. 接入媒体引用与适用的内容关系

友链 Logo 可以没有图片，也可以选择受管媒体或外部 HTTPS 地址，二者互斥。若新增模块使用受管媒体，需要同步以下入口：

- `src/backend/server-main/src/entities/media-reference.entity.ts`：引用类型与模块外键。
- `src/backend/server-main/src/modules/media/media-references.ts`：复用媒体锁定、`synchronizeMediaReferences` 和 URL 解析；友链稳定引用键为 `link:<id>`。
- `src/backend/server-main/src/modules/link/link.service.ts`：在同一事务中保存业务记录及引用，删除或换图只释放自身引用。
- `src/backend/server-main/src/modules/media/media.service.ts`：媒体使用位置、内容名称与后台编辑地址。

不能因业务删除直接删除磁盘文件，其他当前内容或历史引用仍须阻止回收。外部图片只保存校验后的地址，服务器不请求站点、Logo 或远端图片字节。

友链没有结构化 `relatedContent`。需要文章、项目、图库式的有向有序关系时，另行核对 `src/backend/server-main/src/modules/backup/content-relation-plan.ts`、`src/backend/server-main/src/modules/backup/content-import-relations.ts` 和[内容关系约定](architecture.md#内容关系与媒体)，同步公开可见性、历史快照与整批编号映射，不能只增加一个 ID 数组。

## 5. 注册审计动作与安全摘要

`src/backend/server-main/src/modules/audit/audit-description.ts` 定义 `link.create/update/delete/settings`、路由到动作/资源的映射以及允许记录的字段名与结果摘要。新增模块应补明确动作与白名单，不能依赖通用 `admin.write` 兜底作为完整接入。

现有 `src/backend/server-main/src/modules/audit/audit-gate.guard.ts`、`audit.interceptor.ts` 和 `audit.service.ts` 统一登记写入意图和结果：开始审计失败时不开始管理写入，结果不确定时保留相应状态。沿用该流程，不在各个业务服务另建日志机制。摘要只保存允许的字段名、版本、状态和计数，不复制正文、URL 值、密码或令牌。

内容包的模块计数还要接到 `src/backend/server-main/src/modules/backup/backup.controller.ts` 的导出/执行摘要，再同步审计结果白名单；友链使用 `exportedLinks` 与 `importedLinks`。

## 6. 演进内容包版本、预览与导入

当前导出 **v13**，解析器接受 **v1–v13**，即兼容导入 v1–v12，当前版本也可重新导入。精确格式以 `src/backend/server-main/src/modules/backup/content-package.ts` 为准。友链与规则从 v6 引入：v1–v5 夹带 `links/linkSettings` 会拒绝，正常旧包将其规范化为 `links: []`、`linkSettings: null`。

新增可迁移模块或持久字段时，显式演进版本并核对以下完整链路，不重新解释旧版本，也不静默丢弃未知字段：

| 当前文件                                                               | 核对与改动位置                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/backend/server-main/src/modules/backup/content-package.ts`        | 类型、版本门禁、根/条目字段白名单、数量上限、重复来源编号、业务校验和旧包缺省值。 |
| `src/backend/server-main/src/modules/backup/content-export.service.ts` | 导出前数量检查、查询、序列化、删除标记、来源编号和媒体 UUID。                     |
| `src/backend/server-main/src/entities/content-import.entity.ts`        | 预览计划、执行结果、模块计数、设置版本等持久票据契约。                            |
| `src/backend/server-main/src/modules/backup/content-import-plan.ts`    | 目标基准摘要、skip/copy、删除项处理、所需媒体、配置版本和预览计数。               |
| `src/backend/server-main/src/modules/backup/content-import-links.ts`   | 用新编号创建草稿、映射 Logo、同步引用并记录来源编号到新编号的结果。               |
| `src/backend/server-main/src/modules/backup/content-import.service.ts` | importer 调用、目标变化核对、统一事务、文件补偿、票据重试及设置迁入。             |
| `src/frontend/web-blog/app/features/backup/types.ts`                   | 前端预览、计数、配置与执行结果类型，兼容历史票据缺少新增字段。                    |
| `src/frontend/web-blog/app/composables/useContentBackup.ts`            | 下载、上传预览、确认与原票据结果查询流程。                                        |
| `src/frontend/web-blog/app/pages/admin/maintenance.vue`                | 模块预览条目、统计、执行结果及迁入后检查入口。                                    |

友链 `skip` 按规范 URL 保留已有目标，`copy` 明确创建新草稿，源删除项始终跳过；迁入不继承编辑版本和原提交凭据。旧包没有规则时，即使选择迁入设置，也不清空目标规则。历史未完成票据需要重新预览，已完成旧结果应继续可读并可幂等返回。

新模块有跨内容关系时，按整批新编号映射，不能让源编号指向目标站已有内容。内容包不保存登录授权、完整修订历史或全部互动状态；它不能替代完整备份。确认摘要、过期、回滚和恢复边界见[备份与恢复](backup-and-recovery.md)。

## 7. 补齐完整备份与恢复校验

`src/backend/server-main/scripts/full-backup.mjs` 在同一个 `pg_export_snapshot` 下枚举全部 public 表，生成数据库 dump、表计数/行摘要和登记媒体清单。新表进入数据库备份并不意味着模块恢复已完整：还要扩展同脚本的模块专属完整性检查及 `verifyRestoredApplication`。

友链现有检查包括 Logo 引用、来源互斥、状态/版本/排序、公开 URL 唯一性、规则配置与开发样本归属；恢复后的 API 验证覆盖公开列表/统计、后台详情/规则、非公开与删除可见性、旧上下文拒绝和新上下文写入。

旧备份兼容以清单中的实际表集合为依据，友链分支通过 `manifest.counts` 是否含 `friend_link` 决定执行。真实旧结构没有新表时不能当成损坏；应用升级前仍需正式迁移。原始快照校验通过后，现有恢复流程才撤销旧授权、轮换内容与运行代次并暂停外部副作用。受管媒体校验实际字节，外部 Logo 只恢复地址。

同时扩展 `src/backend/server-main/tests/full-backup-integration.mjs` 和 `src/backend/server-main/tests/backup-integrity-integration.mjs`，覆盖新模块、篡改拒绝和真实旧结构。备份、恢复与切换操作遵循[备份与恢复](backup-and-recovery.md#校验与独立恢复)，使用独立目标，不覆盖日常数据库或媒体。

`full-backup-integration.mjs` 仅在配置 `RESTORE_API_IMAGE` 时调用恢复后的 API 验证；未启用该分支的测试通过，不能视为 API 恢复验收完成。

## 8. 定义前端领域类型与真实仓库

| 当前文件                                                     | 核对与改动位置                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/frontend/web-blog/app/features/link/types.ts`           | 公开、管理、编辑、配置与本机草稿类型，区分服务端控制字段。                               |
| `src/frontend/web-blog/app/features/link/query.ts`           | URL 筛选、分页和请求参数规范化。                                                         |
| `src/frontend/web-blog/app/features/link/editor.ts`          | 编辑值、输入校验、`LinkRecovery` 契约与恢复解析。                                        |
| `src/frontend/web-blog/app/composables/useLinkRepository.ts` | 现有友链仓库实际位置；公开读取和后台列表/详情/提交查询/保存/删除/规则接口。              |
| `src/frontend/web-blog/app/composables/useAdminApi.ts`       | 统一管理认证、刷新、内容上下文、提交快照及账号/内容代次检查。                            |
| `src/frontend/web-blog/app/composables/useLinks.ts`          | 公开查询状态，复用 `usePublicReadData.ts` 和 `usePageRequestScope.ts` 的缓存与请求归属。 |
| `src/frontend/web-blog/app/utils/publicReadCache.ts`         | 公开缓存域与查询键；新增模块时核对 `PublicReadDomain`。                                  |
| `src/frontend/web-blog/app/utils/invalidatePublicReads.ts`   | 管理写入撤销对应领域读取及在途结果，核对 `invalidatePublicWrite` 的模块映射。            |

新领域类型放在 `app/features/<domain>/types.ts`，仓库沿用项目的请求入口。友链仓库目前位于上述 composables 文件，公开与后台调用共用领域类型。接口失败展示可恢复错误，不回退 Mock，也不把管理、待审核或个人身份状态放入公共缓存。

## 9. 组装公开页面与后台编辑

- 公开页面参考 `src/frontend/web-blog/app/pages/links.vue`，展示组件参考 `src/frontend/web-blog/app/components/link/LinkGrid.vue`、`LinkCard.vue`、`LinkStats.vue` 和 `LinkRules.vue`。页面组织数据，组件通过 props 和事件交互。
- 后台参考 `src/frontend/web-blog/app/pages/admin/links/index.vue`、`new.vue`、`[id].vue` 和 `settings.vue`，以及 `src/frontend/web-blog/app/components/admin/LinkEditorForm.vue`、`LinkRecoveryDetails.vue`。
- 状态流程位于 `src/frontend/web-blog/app/composables/useAdminLinks.ts`、`useAdminLinkEditor.ts`、`useLinkSettingsEditor.ts`。保留筛选与分页、未保存输入、未知提交查询、冲突重读和身份切换保护。友链列表当前自行维护请求代次；新模块可复用 `src/frontend/web-blog/app/composables/useAdminReadResource.ts` 的共享管理读取，落实相同的账号、内容代次和请求归属保护。
- `src/frontend/web-blog/app/components/link/LinkForm.vue` 与 `src/frontend/web-blog/app/composables/useLocalLinkDraft.ts` 仅用于公开侧本机草稿与复制，不是公开申请 API 的范例。

独立页面用 `xxx.vue`，有子页才用 `xxx/index.vue`。复用 `src/frontend/web-blog/app/components/common/PageFrame.vue`、`RequestFeedback.vue` 和 `StateBlock.vue`，分别表达加载、真实空状态、失败和重试。图标只使用 `<Icon name="lucide:xxx" />`；悬浮/焦点提示使用 `src/frontend/web-blog/app/components/common/Tooltip.vue`（自动组件名 `CommonTooltip`）。提供可读操作名称、表单标签、状态播报、键盘操作、可见焦点、Escape 和焦点归还，支持 `prefers-reduced-motion`。

## 10. 接入导航并遵守三主题契约

三主题共用 `app/pages/links.vue` 与业务状态，不复制三套业务页面：

| 当前文件                                                                                                                                                         | 核对与改动位置                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/web-blog/theme-contracts/index.ts`                                                                                                                 | 当前逻辑组件为 `RootLayout`、`ThemeAccessory`、`StatusFooter`、`SidebarNav`、`PostCard`。只有新增主题分发组件时才扩展契约及主题实现。 |
| `src/frontend/web-blog/app/layouts/default.vue`                                                                                                                  | 稳定持有 `NuxtPage` 并通过 slot 交给主题；主题不另建页面实例。                                                                        |
| `src/frontend/web-blog/themes/nexus/app/components/RootLayout.vue`                                                                                               | Nexus 布局及页面挂载边界。                                                                                                            |
| `src/frontend/web-blog/themes/dock/app/components/RootLayout.vue`                                                                                                | Dock 布局及页面挂载边界。                                                                                                             |
| `src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue`                                                                                              | Aurora 布局及页面挂载边界。                                                                                                           |
| `src/frontend/web-blog/themes/nexus/theme.config.ts`、`src/frontend/web-blog/themes/dock/theme.config.ts`、`src/frontend/web-blog/themes/aurora/theme.config.ts` | 宿主能力；根据能力决定侧栏或紧凑展示，不复制数据。                                                                                    |
| `src/frontend/web-blog/app/plugins/sidebar-teleport.server.ts`                                                                                                   | 右栏 Teleport 的 SSR 注入；使用现有 `#right-sidebar-target` 挂载点。                                                                  |

需要右栏时沿用友链页面按能力 Teleport 的方式，不加 `ClientOnly` 延迟首屏；无右栏布局复用相同 metadata。动效不作为数据就绪条件，取消、错误、减少动态效果与卸载都要正确收尾。更多实现约定见[主题开发](themes.md)。

模块入口还涉及以下登记：

- 公共导航：`src/frontend/web-blog/app/features/nav/types.ts`、`routes.ts` 的类型、`SITE_NAV_KEYS` 和路由目录，`src/frontend/web-blog/app/composables/useNavItems.ts` 的消费，以及 `src/backend/server-main/src/modules/site/site-navigation.ts` 的服务端白名单。隐藏导航只改变展示，不是访问控制；还要检查站点配置与旧内容包兼容。
- 管理导航与概览：`src/frontend/web-blog/app/features/admin/navigation.ts`、`overview.ts`、`types.ts`；若纳入真实工作台统计和最近编辑，同时核对 `src/backend/server-main/src/modules/post/admin-overview.controller.ts`。
- 内容发现：友链搜索位于 `src/frontend/web-blog/app/composables/useSearch.ts`，类型位于 `src/frontend/web-blog/app/features/search/types.ts`。需要纳入搜索的新模块应同步真实来源、分页、统计与错误反馈。
- SEO 与页面缓存：`src/frontend/web-blog/app/composables/usePageSeo.ts`、`src/frontend/web-blog/nuxt.config.ts`；现有写入失效由 `src/frontend/web-blog/server/plugins/ssr-cache-purge.ts` 和 `src/frontend/web-blog/server/utils/ssrCache.ts` 处理。详情收录按需核对 `src/frontend/web-blog/server/api/__sitemap__/urls.ts`，当前没有逐条友链详情 sitemap。

## 11. 提供有稳定归属的代表样本

| 当前文件                                                                                                                        | 核对与改动位置                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/backend/server-main/src/seeders/link-fixtures.ts`                                                                          | `link-v1` 的稳定场景，通过现有服务建立真实内容；覆盖分页、草稿/撤回、推荐、排序、长文案、无图与两种 Logo 来源。 |
| `src/backend/server-main/src/seeders/development-datasets.ts`                                                                   | 登记数据集、说明、数量和 seed 函数。                                                                            |
| `src/backend/server-main/src/seeders/development-data-catalog.ts`                                                               | 登记公开/后台路径、实际数据源、代表场景、最低覆盖及媒体核验。                                                   |
| `src/backend/server-main/src/seeders/fixture-ledger.ts`                                                                         | `FIXTURE_TABLES` 和稳定 dataset/kind/scenario 归属，保留已有编辑与删除记忆。                                    |
| `src/backend/server-main/src/seeders/fixture-cleanup-plan.ts`、`src/backend/server-main/src/seeders/remove-development-data.ts` | 核对本域清理保护、关联与删除顺序，媒体在业务引用处理之后。                                                      |
| `src/backend/server-main/src/seeders/seed-development-data.ts`                                                                  | 复用默认预览、目标/结构检查、完整备份、事务及本次文件补偿。                                                     |
| `src/backend/server-main/src/seeders/link-assets/README.md`                                                                     | 素材来源与许可登记，同目录保留必要运行素材和许可证。                                                            |

样本使用自然文案，统计从真实记录计算，日期功能提供适用日期。重复补齐不覆盖用户编辑或账号配置，不复活已删除记录；友链遇到已有同址用户内容时跳过且不接管归属。样本定向清理也不能破坏其他内容或历史媒体引用。

新增数据集沿用[开发数据流程](development.md#管理员与开发样本)，不在应用启动中 seed。预览同样需要连接目标数据库；实际写入还须核对非生产目标、备份和精确确认。日常代表样本长期保留，自动验收使用独立数据库、媒体和账号。

## 12. 按链路补测试并同步文档

先检查模块本身，再检查它接入的共享边界。友链现有测试可作为覆盖入口：

| 范围                 | 当前文件与覆盖方向                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 校验、媒体与审计单元 | `src/backend/server-main/src/common/validators/max-utf16-length.spec.ts`、`src/backend/server-main/src/modules/media/media-organization.spec.ts`、`src/backend/server-main/src/modules/audit/audit-description.spec.ts`。 |
| API 与权限           | `src/backend/server-main/tests/link-integration.mjs`：公开过滤、管理权限、分页统计、URL、媒体、幂等、并发版本、删除墓碑、内容代次与审计。                                                                                 |
| 内容包版本           | `src/backend/server-main/src/modules/backup/__tests__/content-package-version-gate.spec.ts`；`src/backend/server-main/tests/legacy-content-package.mjs` 构造真正符合旧版本的包。                                          |
| 迁入与恢复           | `src/backend/server-main/tests/link-backup-integration.mjs`、`full-backup-integration.mjs`、`backup-integrity-integration.mjs`：旧包、skip/copy、新编号、历史票据、回滚、断连查结果及完整恢复。                           |
| 样本归属             | `src/backend/server-main/tests/link-fixtures-integration.ts`、`link-fixtures-existing-url.ts`：重复补种、保留编辑/删除、已有同址内容与清理保护。                                                                          |
| 前端业务             | `src/frontend/web-blog/tests/unit/link.test.ts`、`linkFeed.test.ts`、`linkEditor.test.ts`、`linkSettings.test.ts`、`linkSearch.test.ts`、`localLinkDraft.test.ts`。                                                       |
| 共享导航与缓存       | `src/frontend/web-blog/tests/unit/siteNavigation.test.ts`、`siteNavigationFields.test.ts`、`publicReadCache.test.ts`、`publicReadInvalidation.test.ts`、`publicReadOwnership.test.ts`。                                   |
| 浏览器               | `src/frontend/web-blog/tests/e2e/link-business.spec.ts`：真实管理/公开流程、失败恢复、三主题、窄屏和实际断点两侧、键盘、减少动态效果及无 JS 首屏。                                                                        |

前端代码改动在 `src/frontend/web-blog/` 运行 ESLint、Prettier、`corepack pnpm exec nuxi typecheck` 与相关 Vitest；后端代码改动从根目录运行 `corepack pnpm --filter server-main lint`、`typecheck` 和 `test`。具体入口见[贡献指南](../CONTRIBUTING.md#选择与改动相符的验证)。纯文档改动检查路径、链接、格式与差异，不以单元测试代替数据库兼容和恢复验收。

涉及真实持久化、迁入、样本和恢复时，按[开发指南](development.md#验证入口)使用隔离环境。`src/backend/server-main/package.json` 中的 `test:integration`、`test:development-data`、`test:backup-integrity`、`test:backup-restore` 以及根 `package.json` 的 `test:e2e` 都包含构建并依赖相应运行环境；只在具备对应操作范围时执行，不对日常服务运行自动写入用例。不得删除断言、缩减代表数据、扩大超时或掩盖真实错误来制造通过。

最后同步长期文档：

- [内容与后台使用](content.md)：公开入口、后台操作、状态和未开放能力。
- [API 契约](api.md)：参数、响应、权限、冲突、幂等和公开过滤。
- [架构](architecture.md)：领域职责、关系、媒体和共享流程变化。
- [备份与恢复](backup-and-recovery.md)：内容包版本、旧包行为、迁入和完整恢复。
- [开发指南](development.md)与[主题开发](themes.md)：新样本/验证入口，以及实际发生的宿主或主题契约变化。
- [文档索引](README.md)与[贡献指南](../CONTRIBUTING.md)：新增长期指南的入口。

文档只描述当前实现与可执行操作。截图、trace、机器报告和临时验收记录放入忽略的 `.artifacts/` 或 `.playwright-mcp/`，不在 `docs/` 累积任务日志。
