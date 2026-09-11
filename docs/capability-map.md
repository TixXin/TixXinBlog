# 当前业务能力与数据来源

此清单按实际页面、数据访问和后端入口核对。数据库中可能含开发种子内容；正式运营前仍需整理内容与站点资料。UI 收尾的完成率只对应已归档阶段。

## 核对清单

前端路径以下均相对 `src/frontend/web-blog/app/`；后端路径相对 `src/backend/server-main/src/`。

| 业务       | 页面与实际数据来源                                                                                   | 管理能力                                                                               | 当前证据与剩余工作                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文章       | `/`、`/archive`、`/articles/:id`；`features/post/api.ts` → `/api/v1/posts` → PostgreSQL              | `/admin/posts`；创建编辑、发布撤回、历史、批量及回收站                                 | `blog.spec.ts`、`post-pagination.spec.ts`、后端文章集成验证。真实模式默认开启，显式 Mock 仅供演示/测试                                                                                |
| 评论       | 文章评论走 `/posts/:id/comments`；闪念评论走 `/flashes/:id/comments`                                 | 文章评论审核与策略、闪念评论维护                                                       | `commentController.test.ts`、`comment-moderation-integration.mjs`、`flash-ux.spec.ts`。游客显示资料可在本机保留，身份和权限最终由服务端校验                                           |
| 认证       | `/admin/login`、登录抽屉；`useCurrentUser.ts` → `/api/v1/auth`                                       | 会话查看、撤销、密码与访问保护                                                         | `auth-sessions-integration.mjs`、相关浏览器用例。访问令牌内存保存，刷新使用 HttpOnly Cookie；普通访客身份不是注册用户系统                                                             |
| 闪念       | `/flash`、`/flash/:id`；`HttpFlashRepository` → `/api/v1/flashes` 与 `/admin/flashes`                | `/admin/flashes` 与前台博主编辑器；草稿、归档、图片、置顶、互动                        | `flashRepositoryHttp.test.ts`、`flash-ux.spec.ts`、`service-recovery.spec.ts`。本地仓库只由显式演示配置启用                                                                           |
| 朋友圈     | `/moments`、详情、话题页；`useMomentRepository` → `/api/v1/moments` → PostgreSQL，运行时无 Mock 回退 | `/admin/moments`；发布编辑、草稿归档、置顶删除、媒体、评论审核和回复；内容包及完整备份 | `moment-integration.mjs` 87请求、`moment-business.spec.ts` 跨上下文持久化/图片/筛选/失败/冲突、缓存与恢复单测、备份恢复；三主题三浏览器通过，见[验收记录](archive/content-history/next-stage-verification.md) |
| 留言       | `/guestbook`；真实API与PostgreSQL，无Mock回退                                                        | `/admin/guestbook`；分页、审核、回复、隐藏、置顶与删除，通知/待回复筛选                | 当前54条留言、5待审、26待回复；历史接口与交互证据见[留言阶段](archive/content-history/guestbook-stage.md)，本轮数据及通知见[最终验收](archive/sustainable-blog/sustainable-blog-verification.md)                                       |
| 项目       | `/projects?project=id` 与六域搜索；真实API与PostgreSQL                                               | `/admin/projects`；封面、标签、进展/发布状态、排序、有向关联与v9维护                   | 当前20项目；深链、公开关系、维护映射及三浏览器通过，见[最终验收](archive/sustainable-blog/sustainable-blog-verification.md)；[早期项目验收](archive/content-history/project-stage-verification.md)保留历史证据                         |
| 图库       | `/gallery?photo=id`；真实API与PostgreSQL，受管媒体和外链互斥                                         | 来源切换、恢复、发布/撤回、器材、有向关联；v9兼容v1–v8及完整恢复                       | 当前24作品（20受管、4外链），19公开；搜索/关联/素材与维护通过，见[最终验收](archive/sustainable-blog/sustainable-blog-verification.md)；[外链历史验收](archive/content-history/gallery-external-admin-verification.md)                 |
| 友链       | `/links` 与六域搜索；真实API与PostgreSQL，复用站点资料                                               | `/admin/links`及独立规则；发布、推荐、排序、Logo与删除；v9维护                         | 当前18友链，公开申请未开放；本轮六域检索与v9回归见[最终验收](archive/sustainable-blog/sustainable-blog-verification.md)，[友链历史验收](archive/content-history/link-stage-verification.md)保留当时数量                                |
| 书签       | `/tabs`；`LocalTabRepository` → 当前浏览器 LocalStorage                                              | 本机分组、编辑、排序、导入导出                                                         | `tabImportExport.test.ts`、`motion-features.spec.ts` 等。明确不提供云同步，本阶段继续保留本地存储                                                                                     |
| 站点配置   | `/api/v1/site`、`/about`；真实站点与关于资料                                                         | `/admin/site`；版本历史、显隐排序、刷新恢复、冲突比较及未知提交核对                    | 已移除关于页履历示例；隐藏资料由公共API剔除。称呼tixxin已确认，其他个人事实缺省，见[个人内容](personal-content.md)                                                                    |
| 管理工作区 | `/admin`及18项管理入口；服务端真实汇总                                                               | 六域草稿、五类互动待办、最近编辑、通知与维护摘要；共用读取归属、滚动/移动抽屉/操作栏   | 三主题与断点、三浏览器已验收；数量与筛选一致，见[工作台](operations-workbench.md)                                                                                                     |
| 搜索与统计 | `/search`和弹窗，文章/项目/友链/图库/闪念/朋友圈公开API；实际目录和聚合                              | 全部预览、单类型分页、URL返回、分源失败；人工关联与规则相关文章                        | 保留文章正文与中文检索，不显示虚构排名；见[内容发现](content-discovery.md)                                                                                                            |

测试文件位置为 `src/frontend/web-blog/tests/` 或 `src/backend/server-main/tests/`。已有测试名称只用于定位覆盖范围，不代表未实现业务已完成。

## 本阶段与后续边界

可持续运营本轮还新增：[长文导航](writing-navigation.md)、[媒体说明/筛选/引用位置](media-organization.md)、[有向内容关联与六域检索](content-discovery.md)、[持久任务/站内通知/SMTP/备份传输](operations-and-notifications.md)和[可执行发布配置](release-operations.md)。内容包当前v9兼容v1–v8；完整恢复会严格核对表与媒体库存，再暂停恢复出来的外部投递。性能只记录有配对证据的列表投影收益，见[性能与维护](performance-maintenance.md)。各项本机交付与未授权的生产启用分别记录于[本轮跟踪](archive/sustainable-blog/sustainable-blog-stage.md)。

可靠启动与朋友圈阶段已归档。开发数据与留言阶段也已完成统一检查、带归属的增量样本、真实留言业务与维护兼容，完整验收见[留言阶段](archive/content-history/guestbook-stage-verification.md)。使用方式见[朋友圈业务](moment-business.md)、[留言业务](backend/guestbook.md)和[开发数据库](development-database.md)。

图库、项目和友链真实业务均已完成，日常样本、维护和验收见[交付索引](archive/content-history/gallery-project-link-delivery.md)。友链公开申请、外部指标同步和书签云同步属于后续工作；本轮新增最小持久任务执行器和可选worker镜像；AI增强、独立消息队列平台与外部搜索服务仍未实现。后续按具体业务目标建立独立待办。

导航、标签栏名称和图标等静态配置可以继续位于现有 `mock.ts`，不能仅凭该文件名判断业务是否持久化。真实数据链路以请求、服务端读写、数据库结果和重载验证共同确认。
