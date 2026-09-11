# API 契约

业务 API 的统一前缀为 `/api/v1`。浏览器通过 Nuxt 同源网关访问；后端连通性使用 `/health` 与 `/ready`，其中就绪检查包含数据库连接状态。以下路径省略业务前缀。

本文说明稳定的接口边界和主要入口；精确字段、默认值和限制以[当前控制器与 DTO](../src/backend/server-main/src/modules/)为准。前端类型位于 `src/frontend/web-blog/app/features/<domain>/`，不从旧设计或示例响应推导新字段。

## 响应、身份与错误

普通 JSON 成功响应：

```json
{ "code": 0, "message": "ok", "data": {}, "traceId": "request-trace" }
```

错误使用对应 HTTP 状态，响应为 `{ code, message, data: null, traceId }`。图片、内容包下载和订阅使用各自的文件格式，不套 JSON envelope。不要只看 HTTP 是否完成或 `data` 是否为空来推断成功；保留 `traceId` 便于定位，日志不应包含令牌或正文。

| HTTP 状态 | 客户端处理                                                 |
| --------- | ---------------------------------------------------------- |
| 400       | 参数、长度、来源或业务约束不满足；保留输入并提示具体问题   |
| 401 / 403 | 登录失效或权限不足；恢复身份后重新读取当前状态             |
| 404       | 不存在或当前身份不可见，不泄露私有记录状态                 |
| 409       | 内容版本、提交标识、票据或内容代次冲突；核查原结果后合并   |
| 428       | 缺少恢复后要求的内容上下文；重新读取上下文                 |
| 429       | 请求限流；按反馈稍后重试，不切换访客标识规避限制           |
| 5xx       | 保留已知数据和未保存输入，提供重试，不以 Mock 或假零值替代 |

管理接口使用 `Authorization: Bearer <accessToken>`。访问令牌由前端内存持有，刷新令牌使用 HttpOnly Cookie，生产 Cookie 带 Secure；状态变更同时遵循同源/Origin 校验。`X-Visitor-Id` 是设备访客标识，服务端将其哈希后使用；客户端昵称、头像或博主字段不能授予管理权限。

读取站点时取得 `X-Content-Context`，管理及要求该保护的公开写入附带当前值。完整恢复/重建会轮换内容代次，旧页面必须重新读取，即使账号重新登录也不能继续提交旧上下文。

| 认证入口                                                         | 行为                                  |
| ---------------------------------------------------------------- | ------------------------------------- |
| `POST /auth/login`                                               | 管理员登录，建立持久会话与刷新 Cookie |
| `POST /auth/refresh`                                             | 轮换刷新凭据与访问令牌                |
| `POST /auth/logout`                                              | 撤销当前授权并清除 Cookie             |
| `GET /auth/me`、`GET /auth/session`                              | 当前身份与会话状态                    |
| `GET /auth/sessions`                                             | 当前账号会话列表                      |
| `DELETE /auth/sessions/:id`、`POST /auth/sessions/revoke-others` | 撤销指定或其他会话                    |
| `POST /auth/password`                                            | 修改密码，沿用账号与会话版本保护      |

认证实现见[auth](../src/backend/server-main/src/modules/auth/)。审计保留操作者、动作、字段摘要和结果，不复制敏感正文或凭据；写入结果不确定时保留相应状态。

## 写入版本与幂等

支持版本的记录在 PATCH/DELETE 时使用读取到的 `revision`，省略字段表示保持原值；只有契约允许时才使用 `null` 或空字符串清空。版本冲突不能自动覆盖。图库、项目、友链与朋友圈的创建使用 UUID v4 `requestId`；相同标识和规范化输入返回原记录，不同输入或已删除提交返回冲突。

未知创建结果可用对应 `/admin/<domain>/submissions/:requestId` 查询。删除保留必要提交墓碑，迟到请求不能复活内容。其他领域的提交/重试字段依其 DTO，不把某个域的标识强加到全部接口。

目标状态操作与切换操作不同：朋友圈点赞是 `PUT { liked }`，留言回应是 `PUT { emoji, reacted }`；文章和闪念的点赞仍使用各自的 POST 切换入口，不能把切换请求当作任意重试都安全的设置操作。

## 文章、目录、评论与闪念

| 方法与路径                                                                             | 作用                               |
| -------------------------------------------------------------------------------------- | ---------------------------------- |
| `GET /posts`、`GET /posts/metadata`                                                    | 公开列表、搜索、分页与真实目录聚合 |
| `GET /posts/:id`、`GET /posts/by-slug/:slug`                                           | 公开文章详情及地址解析             |
| `GET /posts/:id/navigation`、`GET /posts/:id/related`                                  | 前后文章与规则相关文章             |
| `POST /posts/:id/like`、`POST /posts/:id/view`                                         | 访客点赞切换与去重浏览计数         |
| `GET /posts/:id/interaction`                                                           | 当前访客互动状态，私有且不缓存     |
| `GET/POST /posts/:id/comments`、`POST /comments/:id/like`                              | 文章评论、回复与点赞               |
| `GET/POST /admin/posts`、`GET/PATCH/DELETE /admin/posts/:id`                           | 管理列表、创建、版本化编辑及回收   |
| `GET /admin/posts/:id/revisions`、`GET /admin/posts/:id/revisions/:revision`           | 修订列表与具体快照                 |
| `POST /admin/posts/:id/revisions/:historical/restore`、`POST /admin/posts/:id/restore` | 恢复历史内容或回收记录             |
| `POST /admin/posts/batch/preview`、`POST /admin/posts/batch/execute`                   | 明确编号及版本的批量预览和执行     |
| `GET /admin/posts/batch`、`GET /admin/posts/batch/:ticket`                             | 最近批量任务及原票据结果           |
| `GET /admin/taxonomy`                                                                  | 专栏和标签；写入入口在同一控制器   |
| `GET /admin/comments`、`GET/PATCH /admin/comments/policy`                              | 评论管理与版本化审核策略           |
| `POST /admin/comments/:id/moderation`、`POST /admin/comments/:id/reply`                | 影响范围确认后的审核与博主直接回复 |
| `GET /flashes`、`GET /flashes/search`、`GET /flashes/:id`                              | 公开闪念列表、搜索及详情           |
| `POST /flashes/:id/like`、`POST /flashes/:id/comments`                                 | 闪念互动                           |
| `GET/POST /admin/flashes`、`GET/PATCH/DELETE /admin/flashes/:id`                       | 博主闪念管理                       |

文章公开列表只读取列表所需字段，正文检索仍由后端执行。评论可见性需要同时考虑所属文章、祖先、审核和删除状态；缓存计数与公开聚合遵循相同口径。专栏重命名与引用同步在事务内完成，仍被引用的目录项不能直接删除。

批量任务绑定具体 ID、版本和影响范围，有执行期限及逐项结果；重复执行查询原结果。软删除与发布状态分开，永久删除需确认关联集合。媒体不会因删除文章而直接从磁盘移除。

源码入口：[post](../src/backend/server-main/src/modules/post/)、[comment](../src/backend/server-main/src/modules/comment/)、[flash](../src/backend/server-main/src/modules/flash/)。

## 朋友圈

| 方法与路径                                                       | 作用                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `GET /moments`                                                   | `page/pageSize/q/topic/date`；每页最大 50 条     |
| `GET /moments/overview`                                          | 公开动态、评论、点赞、话题、日期、照片与回顾聚合 |
| `GET /moments/:id`、`GET /moments/:id/navigation`                | 公开详情与按时间排列的前后动态                   |
| `GET/POST /moments/:id/comments`                                 | 分页评论与访客提交；可见自己的待审评论           |
| `PUT /moments/:id/like`                                          | 设置目标点赞状态                                 |
| `GET/POST /admin/moments`、`GET/PATCH/DELETE /admin/moments/:id` | 管理、版本化编辑和创建去重                       |
| `GET /admin/moments/submissions/:requestId`                      | 核查未知创建结果                                 |
| `GET/POST /admin/moments/:id/comments`                           | 管理评论与博主回复                               |
| `PATCH/DELETE /admin/moments/:id/comments/:commentId`            | 审核与删除；审核使用目标和 `expectedStatus` 比较 |

状态为 `draft/published/archived`，公开入口排除非公开和删除项。列表默认按置顶、发布时间、创建时间、ID 倒序；`pinnedFirst=false` 用于纯时间订阅。UTC 日期为 `YYYY-MM-DD`，筛选使用半开区间。

评论按动态、服务端访客身份和 `requestId` 去重，隐藏/删除后的旧提交不能重新公开。编辑可以保留已失效的原文章关系，新关系只允许可选择目标；公开投影不泄露私有文章。源码见[moment](../src/backend/server-main/src/modules/moment/)。

## 留言

| 方法与路径                                                           | 作用                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /guestbook`                                                     | `q/date/pageSize/before`，默认 20、最大 50；公开及当前访客自己的待审内容 |
| `GET /guestbook/metadata`、`GET /guestbook/:id`                      | 真实聚合、规则与经过可见性处理的单条引用                                 |
| `POST /guestbook`                                                    | `requestId/content/author`，可选 `avatar/replyToId`                      |
| `PUT /guestbook/:id/reactions`                                       | 设置目标回应状态                                                         |
| `GET/POST /admin/guestbook`、`GET/PATCH/DELETE /admin/guestbook/:id` | 博主分页、回复、审核、隐藏、置顶与软删除                                 |

正文最多 500 字符，昵称最多 32 字符；状态为 `published/pending/hidden`。公开游标包含创建时间、编号及筛选指纹，翻页期间的新留言不会改变向旧记录翻页的边界。后台使用页码分页。

回复只指向公开留言；父留言后来隐藏或删除时，公开回复保留并返回 `replyUnavailable`，移除引用正文与作者。公开置顶最多一条，切换置顶会更新受影响版本。没有在线、已读或地域推断字段。源码见[guestbook](../src/backend/server-main/src/modules/guestbook/)。

## 图库、项目与友链

三个领域均有公开 `GET /<domain>`、`GET /<domain>/metadata`、`GET /<domain>/:id`，以及管理 `GET/POST /admin/<domain>`、`GET/PATCH/DELETE /admin/<domain>/:id` 和创建提交查询。`domain` 分别为 `gallery`、`projects`、`links`；公开默认每页 12、最大 48，非公开/删除记录不返回管理状态、版本、提交标识或存储键。

| 领域 | 查询与约束                                                                                |
| ---- | ----------------------------------------------------------------------------------------- |
| 图库 | `q/category/page/pageSize`；省略 category 为全部，空值为未分类；`sortOrder DESC, id DESC` |
| 项目 | `q/progress/tag/page/pageSize`；标签忽略大小写，`sortOrder DESC, id DESC`                 |
| 友链 | `q/featured/page/pageSize`；推荐优先，再按排序值和 ID 倒序                                |

图库 `mediaId/externalUrl` 必须恰有一个有效来源，切换时明确将另一字段设为 `null`。外链接受完整 HTTP(S)，但浏览器 CSP/HTTPS 可能阻止 HTTP 显示；外链不产生媒体资产、远端请求或伪造尺寸。可识别的受管媒体地址必须用媒体 UUID 关联。`takenOn` 只接受有效手工日期，未知则为空。`GET /gallery/:id/navigation` 按同一过滤和排序定位所在页及相邻作品，筛选外目标返回 `matched=false`。器材由 `GET/PATCH /admin/gallery/settings` 独立版本化管理。

项目发布状态为 `draft/published/withdrawn`，进展为 `active/dev/archived`，两者独立。技术标签最多 20 项，按名称去空白、小写去重并保留首项写法/颜色；链接最多 4 种 `source/demo/docs/download`，同用途不能重复。技术覆盖率来自使用该标签的公开项目比例，可重叠，不是语言占比。没有外部 Star/Fork 自动同步。

友链普通创建/改址检查全部未删除记录的规范 URL，同址冲突返回 400；内容包允许明确复制同址草稿，但同一 URL 最多有一条公开记录。URL 规范协议、主机与默认端口，保留路径大小写、尾斜杠、查询参数顺序/重复值和片段。Logo 可为空，受管媒体与外部 HTTPS 来源互斥。`GET/PATCH /admin/links/settings` 保存最多 12 条独立规则，每条最多 300 字符。

以上外部地址均拒绝凭据、控制字符、空白、反斜杠和危险协议；服务端只校验和保存，不抓取站点或图片。文本长度遵循 DTO 与浏览器 maxlength 的 UTF-16 计数，超限拒绝，不截断后悄悄保存。源码见[gallery](../src/backend/server-main/src/modules/gallery/)、[project](../src/backend/server-main/src/modules/project/)、[link](../src/backend/server-main/src/modules/link/)。

## 站点、媒体、运营与维护

| 入口                                                                                 | 契约                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `GET /site`                                                                          | 公共站点资料，剔除隐藏关于字段，不缓存；提供内容上下文            |
| `GET/PATCH /admin/site`、`GET /admin/site/revisions`                                 | 完整资料、版本化保存与历史；具体版本/恢复入口见控制器             |
| `GET/POST /admin/media`                                                              | 服务端分页筛选与 multipart `file` 上传，可带 `uploadId/alt`       |
| `PATCH/DELETE /admin/media/:id`、`POST /admin/media/:id/restore`                     | 独立资料更新、回收与恢复                                          |
| `GET /admin/media/:id/references`、`GET /media/:uuid.webp`                           | 管理引用明细与公开 WebP 字节                                      |
| `GET /admin/content-relations`                                                       | 管理端选择有向关联目标，最终关系随来源内容版本保存                |
| `GET /admin/overview`                                                                | 服务端真实草稿、互动待办与最近编辑聚合                            |
| `GET /admin/notifications`、`GET /admin/notifications/summary`                       | 通知分页与未读统计；详情实时解析业务状态                          |
| `POST /admin/notifications/:id/read`                                                 | 仅改变已读，不完成审核或回复                                      |
| `GET /admin/operations`、`GET /admin/operations/tasks/:id`                           | 脱敏运行摘要与指定任务                                            |
| `POST /admin/operations/tasks/:id/retry`                                             | 核对当前状态后的显式人工重试                                      |
| `GET /admin/maintenance/diagnostics`、`POST /admin/maintenance/media-check`          | 数据库/结构就绪与登记媒体完整性                                   |
| `POST /admin/backup/export`                                                          | 内容包下载，可选择是否包含媒体                                    |
| `POST /admin/backup/imports/preview`                                                 | multipart `file/requestId/strategy/includeSettings`，生成预览票据 |
| `GET /admin/backup/imports`、`GET /admin/backup/imports/:id`                         | 当前管理员的票据与原结果                                          |
| `POST /admin/backup/imports/:id/repreview`、`POST /admin/backup/imports/:id/execute` | 重新预览或绑定摘要执行；执行需契约要求的确认文本与 confirmation   |

媒体搜索参数为 `search/orientation/usage/deleted`，说明与替代文本独立保存；被当前或历史内容引用的资源拒绝回收。内容包票据绑定管理员、内容代次、目标版本和预览摘要，重复执行返回原结果。接口层约束不能替代[备份恢复](backup-and-recovery.md)与[运行任务](operations.md)中的完整操作流程。
