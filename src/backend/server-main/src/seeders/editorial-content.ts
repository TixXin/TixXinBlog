/** @file editorial-content.ts @description 首发技术内容候选，依据当前仓库可核查实现，不代写未经确认的个人经历。 */
export const EDITORIAL_CONTENT_VERSION = 'first-release-2026-09'
export const EDITORIAL_DATASET = 'editorial-v1'
export const EDITORIAL_CREATE_REASON = '整理仓库事实技术草稿'
export const EDITORIAL_REFRESH_REASON = '完善首发候选内容与关联阅读'
export const editorialArticles = [
  {
    key: 'content-boundaries',
    slug: 'tixxinblog-content-boundaries',
    pinned: true,
    readTimeMinutes: 5,
    title: 'TixXinBlog 的内容边界与页面职责',
    summary: '沿着页面、领域和服务端三层结构，说明哪些内容真正持久化、主题如何共享业务，以及搜索与关联阅读的公开边界。',
    body: `一套博客同时承载文章、项目和生活记录后，页面数量并不是最难维护的部分。更需要明确的是：数据由谁保存，页面负责哪些交互，以及同一条内容在不同入口里是否遵守相同的公开规则。本文沿着 TixXinBlog 当前代码梳理这些边界。

## 从页面到数据库

前端使用 Nuxt 4、Vue 3 和 TypeScript。app/pages 中的页面负责组织展示区域、取得数据并连接用户操作；app/features 按领域保存类型、查询与表单工具、仓储契约；app/composables 承担可复用的请求和页面状态控制。展示组件通过 props 接收数据，通过事件把操作交回上层。实际目录中也有负责编辑流程的组件，不能把目录约定理解为所有组件都完全没有状态。

后端使用 NestJS、MikroORM 和 PostgreSQL。服务端决定发布状态、权限、版本是否仍有效，以及媒体和其他内容之间能否建立关系。前端按钮的可用状态便于操作，但它不能替代服务端校验。

## 持久内容不等于所有功能都已上云

文章、评论、闪念、朋友圈、留言、图库、项目和友链都具有真实 API 链路。文章与闪念另外保留显式演示仓库开关；朋友圈和留言使用真实接口，失败时显示错误，不通过退回样本掩盖服务故障。

书签仍使用当前浏览器的 LocalStorage。清理浏览器数据或更换设备会影响这份本机资料，这与服务端保存文章是不同的边界。公开友链申请和访客邮件订阅也没有作为已实现功能提供入口。

## 发布状态和业务状态分别表达什么

项目的“开发中、维护中、已归档”描述项目进展，“草稿、已公开、已撤回”决定站点是否展示。已归档项目可以公开，正在开发的项目也可以暂时保留为草稿。图库作品则必须在受管媒体和外部图片 URL 之间选择一个来源；外链只是一段地址，不能据此补造本地图片尺寸、拍摄时间或作者身份。

这类规则应留在具体领域内。把不同模块的归档、撤回和删除统一成一个状态名称，反而容易丢失含义。

## 三套布局共用一份业务内容

Nexus、Aurora 和 Dock 通过主题引擎与本地插槽契约组织布局。页面和领域层提供内容，主题负责布局差异。切换主题不需要复制文章或重新维护一套数据库记录；验证时仍需检查不同侧栏、滚动区域与窄屏入口是否正确承载同一流程。

## 让搜索和阅读路径遵守公开规则

全站搜索覆盖文章、项目、友链、图库、闪念和朋友圈。“全部类型”分别预览各域前 3 项；选择一种类型后使用真实总数和每页 10 项的分页。这是按来源组织结果，并不是一套跨模块相关度排名。文章检索继续覆盖正文；某个来源失败时，其余来源仍可使用。

文章、项目和图库还可以维护有向、有序的关联。关联从当前内容指向目标，不会自动反向建立；公开详情只展示当前已公开的目标。目标撤回、删除或缺失后，管理端仍可核对原关系，访客不会看到私有标题。自动文章推荐仍按已有专栏和标签规则生成，与博主维护的关联分开。

## 可核查的位置

- 根 package.json 与前后端 package.json：运行版本、依赖和工作区。
- src/frontend/web-blog/app/features、app/composables、theme-contracts：领域工具与主题契约。
- src/frontend/web-blog/app/composables/useSearch.ts：分来源检索与取消保护。
- src/backend/server-main/src/modules/post/post.service.ts：公开列表和正文检索。
- src/backend/server-main/src/modules/content-relations/content-relations.ts：关联校验与公开投影。
- docs/capability-map.md：当前能力与未实现边界。

源码路径相对于 [TixXinBlog 仓库](https://github.com/TixXin/TixXinBlog)，以对应发布版本的检出为准。接下来可以继续看保存失败时的输入保护，再了解内容迁入包与完整备份各自负责什么。`,
  },
  {
    key: 'editing-recovery',
    slug: 'tixxinblog-editing-recovery',
    pinned: false,
    readTimeMinutes: 5,
    title: '保存失败之后，如何保住正在写的内容',
    summary: '把版本冲突、本机恢复副本和响应丢失分开处理：保留输入、核对归属，再决定载入、合并或重新提交。',
    body: `点击保存后没有看到成功提示，并不能直接说明“什么都没有写入”。也可能是另一个标签页先保存了，或者服务器已经完成操作，而响应没有回到当前页面。TixXinBlog 的编辑保护围绕这几种情况分别处理，而不是让用户反复点击同一个按钮。

## 先区分三种状态

| 看到的现象 | 需要核对的事实 | 下一步 |
| --- | --- | --- |
| 版本冲突 | 当前服务器版本已改变 | 保留输入，比较最新版本后合并 |
| 页面刷新后出现恢复副本 | 本机保留了尚未提交的内容 | 核对账号、目标内容和基线后载入 |
| 请求超时或响应丢失 | 服务器是否已经保存仍不确定 | 用版本或稳定请求标识核对结果 |

这三种情况都不应通过清空编辑器来“恢复正常”。读取最新服务器数据和决定覆盖哪些字段，是两个不同动作。

## 版本号阻止无声覆盖

文章和其他已接入版本保护的表单把当前修订版本随保存请求提交。另一个标签页已经保存时，旧版本请求会被服务端拒绝；当前输入继续保留，供用户比较和合并。文章历史恢复会生成新的草稿版本，而不是把互动计数回滚到过去。

站点资料还有独立字段合并的场景。例如一个页面改了公告，另一个页面改了关于页，读取新版本之后不能拿旧的整份配置覆盖公告。已有合并逻辑处理能够判断的独立变更，存在冲突的输入仍需要核对。

## 本机恢复副本不是服务器备份

文章恢复副本保存在浏览器本地，项目、图库等表单也有各自的恢复流程。它们帮助找回未提交的输入，却不能替代数据库和媒体备份：浏览器存储可能被清理，副本也可能来自另一个账号、内容库或旧版本。

因此，恢复入口需要说明副本归属。项目、图库等表单会阻止把其他内容库的副本直接提交；文章恢复前会读取目标当前版本供比较，仍需人工检查要合并的内容。不能凭相同数字编号假定旧媒体或关联目标就是当前目标。保存成功后的副本清理只处理该编辑流程拥有的副本，避免删掉另一个页面仍在使用的内容。

## 不确定结果应先核对，再决定重试

项目、图库等创建流程使用稳定请求标识，并提供原提交结果核查；文章编辑还可以比较服务器版本。它们的作用是减少响应丢失后误建副本的风险，不表示所有接口都有相同的提交协议，更不等于任意网络操作都具有绝对的一次执行保证。

这种区别也适用于邮件：SMTP 接受和运行结果成功落库是不同阶段。接受之后若记录结果失败，任务会保留不确定状态，不能把数据库连接错误当成“邮件尚未发送”而自动重投。

## 长文定位不应该打断输入

文章编辑器根据当前 Markdown 提供章节定位。定位只移动正文选区与滚动位置，不重建输入框，也不改写正文。输入法合成期间暂不接管光标；代码围栏中的标题文本不应成为文章章节。这样，导航是在帮助继续写作，而不是另外制造一次输入恢复问题。

## 维护之后重新确认上下文

完整恢复会撤销旧登录授权并轮换内容上下文。恢复前打开的页面必须重新读取当前状态。内容包迁入则依据预览票据和目标变化检测执行，不能用一份过期预览来决定现在的写入。

## 可核查的位置

- src/frontend/web-blog/app/composables/usePostEditor.ts、usePostRecovery.ts：文章保存、冲突与本机副本。
- src/frontend/web-blog/app/composables/useSiteSettingsEditor.ts：站点字段合并与恢复。
- src/frontend/web-blog/app/components/admin/PostOutline.vue：章节入口。
- src/frontend/web-blog/app/utils/textareaHeadingPosition.ts：正文定位。
- src/backend/server-main/src/modules/post/admin-post.service.ts：文章版本与历史恢复。
- src/backend/server-main/src/modules/operations/task-runner.ts：投递阶段和不确定结果。
- src/backend/server-main/scripts/full-backup.mjs：恢复后的授权与上下文处理。

本文解释现有保护机制，不包含用户个人写作经历。相关入口与数据职责见内容边界一文；需要跨环境搬运内容时，继续阅读迁入包与完整备份的区别。`,
  },
  {
    key: 'backup-boundaries',
    slug: 'tixxinblog-content-package-and-backup',
    pinned: false,
    readTimeMinutes: 5,
    title: '内容迁入包与完整备份分别解决什么问题',
    summary: 'v9 内容包用于受控迁入草稿，完整备份用于数据库与媒体恢复；预览、生成、完整性、传输和恢复需要分别核对。',
    body: `“已经导出文件”和“已经验证恢复”不是同一件事。TixXinBlog 同时提供内容迁入包与完整备份，前者方便组织和搬运内容，后者保留数据库及受管媒体的完整状态。首发准备尤其需要分清二者，避免把日常开发样本连同配置一起搬到正式环境。

## 内容包迁入的是内容，不是整套运行环境

当前内容包导出版本为 v9，兼容导入 v1–v8。迁入先生成预览计划，再由用户确认；可以跳过相同内容，或复制为新草稿。管理账号、会话、通知投递凭据和运行队列不属于内容包。

文章、项目、图库中的有序关联需要通过来源编号映射到目标编号，不能照抄另一数据库的 ID。目标在预览之后发生变化、票据过期或关联无法确认时，应重新核对计划。重复执行同一票据不会被当成新的迁入。

## 首发候选需要一份独立清单

现有导出接口提供完整内容包，没有后台逐条勾选的导出器。对于首发候选，可以在本机按明确的候选身份裁剪合法子包，再通过现有解析、预览和隔离迁入验证，而不是复制日常数据库。

这份清单需要同时说明正文、专栏、标签、媒体及关联目标。只保留文章本身而漏掉关联目标，会让阅读路径失去意义；把无关评论、图库样本、个人配置或通知记录带入，则超出了首发内容选择。

v9 格式要求包中存在基本站点字段。专用候选包使用中性占位值，并在迁入时明确关闭“包含配置”。这些字段不是已确认的正式配置，也不应覆盖目标站点。是否公开仍由博主逐项审阅决定。

## 完整备份保留同一快照下的数据库和媒体

完整备份使用 PostgreSQL 导出快照，记录实际数据表、行数、内容摘要和媒体清单。受管媒体逐个复制并核对摘要；图库或友链中的外部图片只保存地址，备份程序不会抓取远端图片。

恢复目标是新建的隔离数据库容器与媒体目录。恢复时实际表集合必须与清单一致，媒体库存也要按 ID、存储键、摘要和字节数逐项吻合。不能通过遗漏清单条目跳过运行安全或媒体检查。

## 每个阶段都有自己的结果

| 阶段 | 已经确认 | 仍不能据此确认 |
| --- | --- | --- |
| 生成备份 | 产物已经写出 | 将来一定能恢复 |
| 完整性校验 | 清单及文件摘要一致 | 目标应用已经可用 |
| 异地传输校验 | 接收副本和回执一致 | 真实生产恢复已经演练 |
| 隔离恢复 | 数据库、库存和文件在隔离目标通过核对 | 域名、网络或真实收件人链路已启用 |

官方手动备份命令在完成校验后登记工作台记录；记录失败会提示未确认登记，并保留完整产物。后台备份任务与邮件默认不会仅因 HTTP 服务启动而循环执行，需要环境配置和持久控制共同允许。

## 恢复旧队列之前先停止外部副作用

完整恢复会轮换运行代次，暂停邮件和自动备份，并阻止旧任务自动重复投递。应用版本回退、数据库向前修复和备份恢复是不同操作；不能假设每次数据库迁移都可以无损逆转。

## 可核查的位置

- src/backend/server-main/src/modules/backup/content-package.ts：v9 格式与旧包校验。
- src/backend/server-main/src/modules/backup/content-import.service.ts、content-import-relations.ts：票据、事务及编号映射。
- src/backend/server-main/scripts/full-backup.mjs：生成、实际库存核对与恢复安全。
- src/backend/server-main/scripts/backup-transfer.mjs：接收标记、摘要回执与幂等完成。
- src/backend/server-main/src/modules/operations/task-runner.ts：任务控制和有限重试。
- docs/backup-and-recovery.md、docs/operations-and-notifications.md：当前维护命令与启用边界。

这些机制提供可以执行和验证的流程，不替代正式环境的配置确认与恢复演练。内容从哪里来、页面如何组织，可回到内容边界一文；保存时的版本和输入保护见编辑恢复一文。`,
  },
] as const
export const editorialProject = {
  title: 'TixXinBlog：技术写作与内容维护',
  description:
    'TixXinBlog 是使用 Nuxt 4、Vue 3、TypeScript、NestJS、MikroORM 和 PostgreSQL 的个人博客。文章、评论、闪念、朋友圈、留言、图库、项目和友链具有真实 API；Nexus、Aurora、Dock 通过主题契约组织布局。\n\n后台提供版本化编辑、长文章节定位、媒体说明与引用查找，以及文章、项目、图库之间的有序关联。公开搜索按六种内容类型分组预览和分页；运营工作台区分审核、回复、通知已读与备份执行结果。\n\n内容包当前导出 v9 并兼容 v1–v8，完整备份另行保存数据库与受管媒体。邮件和备份任务需要显式配置与启用；书签仍是浏览器 LocalStorage，公开友链申请和访客邮件订阅尚未提供。\n\n本介绍只陈述仓库可核查能力，不包含访问量、用户规模、商业成绩或个人任职经历。源代码地址来自当前仓库 Git remote。',
  coverMediaId: null,
  progress: 'active' as const,
  status: 'draft' as const,
  sortOrder: 0,
  tags: [
    { label: 'Nuxt', color: 'emerald' as const },
    { label: 'NestJS', color: 'rose' as const },
    { label: 'PostgreSQL', color: 'sky' as const },
  ],
  links: [{ kind: 'source' as const, href: 'https://github.com/TixXin/TixXinBlog' }],
}
