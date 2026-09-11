# 朋友圈 API 与数据约定

朋友圈使用独立的 `moment`、`moment_comment`、`moment_like` 表，通过 `20260909045323_add_moments` 迁移增加。文章、闪念及原有内容保持原数据边界。

## 公开与管理入口

接口均位于 `/api/v1` 下，响应使用项目统一 envelope。

列表默认置顶优先；可选 `pinnedFirst=false` 按发布时间、创建时间和ID倒序，供公开订阅读取最新30条。非法布尔值拒绝，原页面缺省排序保持不变。前端 `/moments.xml` 与 `/api/moments.json` 使用该公开查询及运行时站点资料，明确省略私人身份和评论，成功及失败均不缓存；上游失败返回503。相关回归为 `moment-feed-query.spec.ts` 和 `moment-public-feeds.spec.ts`。

| 方法与路径                                      | 行为                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `GET /moments`                                  | 公开动态分页；支持 `page`、`pageSize`（1–50）、`q`、`topic`、`date`  |
| `GET /moments/overview`                         | 已发布动态、点赞、公开评论计数；话题、日期计数、照片与回顾条目       |
| `GET /moments/:id`                              | 公开详情、最多3条评论预览及真实公开评论数                            |
| `GET /moments/:id/navigation`                   | 按发布日期、创建日期和 ID 查找前后公开动态，不受置顶影响             |
| `GET /moments/:id/comments`                     | 分页评论；公开评论及当前访客自己的待审评论                           |
| `POST /moments/:id/comments`                    | 访客评论，正文、昵称及唯一 `requestId`；可选头像                     |
| `PUT /moments/:id/like`                         | 提交目标状态 `{ liked: boolean }`，重复请求不会反复切换              |
| `GET /admin/moments`                            | 管理分页，增加 `status=all/draft/published/archived`                 |
| `GET /admin/moments/:id`                        | 管理详情及编辑版本                                                   |
| `GET /admin/moments/submissions/:requestId`     | 确认结果未知的创建提交，仍需博主认证                                 |
| `POST /admin/moments`                           | 创建动态，必须提交正文和 UUID v4 `requestId`                         |
| `PATCH /admin/moments/:id`                      | 编辑、发布、归档及置顶；必须提交最新 `revision`                      |
| `DELETE /admin/moments/:id?revision=N`          | 删除并释放动态及评论的媒体引用；重复删除安全                         |
| `GET /admin/moments/:id/comments`               | 查看该动态全部未删除评论及审核状态                                   |
| `POST /admin/moments/:id/comments`              | 博主回复，显示身份由服务器读取站点配置                               |
| `PATCH /admin/moments/:id/comments/:commentId`  | 提交 `status` 与 `expectedStatus`；并发审核冲突返回409，重复目标安全 |
| `DELETE /admin/moments/:id/comments/:commentId` | 删除评论并释放头像引用                                               |

管理入口使用现有 `AdminAuthGuard`、站点数据上下文和审计。公开写入使用现有 `X-Visitor-Id` 哈希及按连接 IP 的限流；点赞身份遵循现有设备访客规范。客户端不能提交博主标识、点赞计数或发布日期。

## 状态、排序与去重

- 动态状态为 `draft/published/archived`。公开列表、详情、评论和聚合均排除草稿、归档与已删除动态；引用文章转为非公开后，公开动态不再返回其卡片信息。
- 编辑时可保留原有文章关系，包括文章已撤回或从内容包映射到草稿的情况；新增关系仍只能选择公开文章。保留关系不会使私有文章信息出现在公开响应中。
- 列表按置顶、发布日期、创建日期及 ID 倒序稳定排序；分页最大 50 条。日期键使用 UTC 的 `YYYY-MM-DD`，服务端以半开时间区间筛选。
- 发布重复使用同一 `requestId` 和规范化输入时返回同一动态；输入不同返回 409。编辑要求版本匹配，互动计数不改变编辑版本。
- 评论按动态、服务端访客身份和 `requestId` 去重；访客评论遵循现有站点评论审核策略，博主回复身份由认证及站点配置确定。
- 评论创建、审核和删除返回服务端公开 `commentCount`；隐藏或删除评论的旧提交不能重新公开原内容。
- 删除保留不可公开读取的记录及提交标识，用于拒绝迟到重试导致的重建；相关媒体引用和点赞记录释放。物理清理由显式数据库维护命令处理。
- 动态图片、外链图片及评论头像复用现有媒体引用保护；被引用或已经移除的资源不能被误回收或重新引用。媒体文件沿用现有公开 URL 机制。

## 当前验证

隔离集成脚本 `tests/moment-integration.mjs` 已验证 87 个请求，包括未授权访问、非法输入、并发发布/评论去重、分页/筛选、私有数据过滤、目标点赞状态、审核冲突、提交查询、前后导航、真实博主回复、图片说明、引用文章撤回后的编辑、引用释放、删除重试、审计及迁移后的零结构漂移。该脚本纳入后端 `test:integration`。

前台、后台管理、开发数据脚本、内容包和完整恢复已接入，完整验证及环境边界见[阶段验收](../archive/content-history/next-stage-verification.md)。
