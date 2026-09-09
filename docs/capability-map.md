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
| 朋友圈     | `/moments`、详情、话题页；`useMomentRepository` → `/api/v1/moments` → PostgreSQL，运行时无 Mock 回退 | `/admin/moments`；发布编辑、草稿归档、置顶删除、媒体、评论审核和回复；内容包及完整备份 | `moment-integration.mjs` 87请求、`moment-business.spec.ts` 跨上下文持久化/图片/筛选/失败/冲突、缓存与恢复单测、备份恢复；三主题三浏览器通过，见[验收记录](next-stage-verification.md) |
| 留言       | `/guestbook`；`useGuestbookRepository` → `/api/v1/guestbook` → PostgreSQL，无Mock回退                | `/admin/guestbook`；分页、筛选、博主回复、审核、隐藏、置顶和删除                       | 88请求接口集成、12项缓存/草稿单测、真实业务三浏览器回归、v3内容包及完整备份恢复；日常库有29条留言与8条回应，最终验收跟踪见[留言阶段](guestbook-stage.md)                              |
| 项目       | `/projects`；`mockProjects`、`mockTechStack`                                                         | 尚无项目管理接口                                                                       | 展示条目、过滤和 UI；剩余项目数据维护与真实内容，本阶段保持演示                                                                                                                       |
| 图库       | `/gallery`；`mockPhotos`、分类与设备示例                                                             | 尚无图库条目管理接口                                                                   | 搜索、筛选与灯箱已有 UI 验证。通用媒体库已实现，但图库页面仍未从该库读取业务条目                                                                                                      |
| 友链       | `/links`；`mockLinks`、规则与站点示例                                                                | 尚无友链申请审核或管理接口                                                             | 当前为展示数据；剩余真实维护及申请流程，本阶段保持现状                                                                                                                                |
| 书签       | `/tabs`；`LocalTabRepository` → 当前浏览器 LocalStorage                                              | 本机分组、编辑、排序、导入导出                                                         | `tabImportExport.test.ts`、`motion-features.spec.ts` 等。明确不提供云同步，本阶段继续保留本地存储                                                                                     |
| 站点配置   | `/api/v1/site`；`useSiteSettings.ts`                                                                 | `/admin/site`；版本、媒体引用与设置维护                                                | `site-settings-integration.mjs`。作者与站点资料已真实接入；关于页的履历、技能和书单仍有明确标注的示例                                                                                 |
| 搜索与统计 | 文章搜索使用 PostgreSQL 查询；统计、分类、标签、归档来自 `/posts/metadata`                           | 复用内容与站点管理                                                                     | `useSearch.ts`、`usePostMetadata.ts`、服务恢复验证；尚无 Meilisearch 服务接入或完整流量分析平台                                                                                       |

测试文件位置为 `src/frontend/web-blog/tests/` 或 `src/backend/server-main/tests/`。已有测试名称只用于定位覆盖范围，不代表未实现业务已完成。

## 本阶段与后续边界

可靠启动与朋友圈阶段已归档。开发数据与留言阶段也已完成统一检查、带归属的增量样本、真实留言业务与维护兼容，完整验收见[留言阶段](guestbook-stage-verification.md)。使用方式见[朋友圈业务](moment-business.md)、[留言业务](backend/guestbook.md)和[开发数据库](development-database.md)。

项目、图库、友链的真实管理和书签云同步属于后续候选工作；AI 增强、独立 Worker 与外部搜索服务也没有因已有页面或设计文档而自动实现。后续按具体业务目标建立独立待办。

导航、标签栏名称和图标等静态配置可以继续位于现有 `mock.ts`，不能仅凭该文件名判断业务是否持久化。真实数据链路以请求、服务端读写、数据库结果和重载验证共同确认。
