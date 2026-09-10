# TixXinBlog 后端 API 文档

本文保留早期 API 设计和后续维护增量记录，其中部分端点尚未实现或已被正式业务契约替代。当前能力以[实际能力清单](../capability-map.md)及各领域使用文档为准；不能将此处的设计表视为全部已经开放的 HTTP 或 WebSocket 接口。图库正式契约见[图库业务](gallery.md)，留言和朋友圈分别见[留言](guestbook.md)及[朋友圈](moments.md)。

## 1. 总则

- 协议：HTTPS（开发期 HTTP）
- 风格：RESTful，资源名复数
- 全局前缀：`/api/v1`
- 序列化：JSON only（`Content-Type: application/json; charset=utf-8`）
- 时间格式：ISO 8601 UTC（如 `2026-04-16T10:30:00.000Z`）
- 字符编码：UTF-8
- 大小写：所有字段名 **camelCase**，与前端 TypeScript interface 完全一致

## 2. 统一响应格式

所有接口统一响应包装：

```json
{
  "code": 0,
  "message": "ok",
  "data": { },
  "traceId": "4d1a2..."
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 0 表示成功；非 0 见附录 A |
| `message` | string | 人类可读信息 |
| `data` | any | 业务数据（列表接口放在 `data.items`） |
| `traceId` | string | 分布式追踪 ID，日志排查用 |

### 2.1 列表响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [ ],
    "total": 128,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "..."
}
```

## 3. 统一错误响应

```json
{
  "code": 1001,
  "message": "文章不存在",
  "data": null,
  "traceId": "..."
}
```

HTTP 状态码策略：

| HTTP | 场景 |
|------|------|
| 200 | 读取成功 |
| 201 | 创建成功 |
| 204 | 删除成功（响应体为空） |
| 400 | 参数错误（DTO 校验失败） |
| 401 | 未鉴权或 token 失效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 冲突（如重复点赞状态不一致） |
| 422 | 业务规则拒绝（如敏感词） |
| 429 | 限流 |
| 500 | 服务端异常 |

业务错误码见 [附录 A](#附录-a-错误码表)。

## 4. 分页约定

- 查询参数：`?page=1&pageSize=20`
- 默认值：`page=1, pageSize=20`
- 最大 `pageSize = 100`
- 响应中 `total` 为全量总数，`items.length` 为本页数量

## 5. 鉴权约定

### 5.1 访客

所有写接口必须携带：

```http
X-Visitor-Id: <visitor-id>
```

- `visitorId` 由前端生成并持久化到 `localStorage`
- 后端存 SHA-256 哈希，不保存原文
- 缺失或格式错误 → 400

### 5.2 管理员

管理员接口（路径前缀 `/admin/*` 或标注 `[Admin]`）必须携带：

```http
Authorization: Bearer <access-token>
```

- access token 有效期 15 分钟
- refresh token 通过 httpOnly cookie（`tixxin_rt`）传递，有效期 7 天
- 刷新接口 `POST /auth/refresh` 自动轮换，旧 refresh token 立即作废

### 5.3 限流

| 范围 | 限制 | 键 |
|------|------|---|
| 匿名写 | 10 req/min | `ip + visitorIdHash` |
| 匿名读 | 120 req/min | `ip` |
| 管理员 | 600 req/min | `userId` |
| 搜索 | 30 req/min | `ip` |
| AI 语义检索 | 10 req/min | `ip + visitorIdHash` |

超限返回 429 + `Retry-After` 头。

## 6. CORS 与安全响应头

- CORS 白名单由 `CORS_ORIGIN` 环境变量控制，支持逗号分隔多值
- 允许方法：`GET, POST, PATCH, PUT, DELETE, OPTIONS`
- 允许 header：`Authorization, Content-Type, X-Visitor-Id, X-Requested-With, X-Trace-Id`
- 响应头：
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`（生产）
  - 与前端 `nuxt.config.ts` 的 CSP 兼容

## 7. 端点总表

说明：`[Admin]` 表示需要管理员 JWT；其余为匿名可访问（写接口需 `X-Visitor-Id`）。

### 7.1 Auth（鉴权）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| POST | `/auth/login` | 无 | 管理员登录 |
| POST | `/auth/refresh` | refresh cookie | 刷新 access token |
| POST | `/auth/logout` | Bearer | 退出并撤销 refresh |
| GET | `/auth/me` | Bearer | 当前管理员信息 |

`POST /auth/login` 请求：

```json
{ "username": "admin", "password": "xxx" }
```

响应 `data`：

```json
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "uuid", "username": "admin" }
}
```

（refresh token 通过 `Set-Cookie: tixxin_rt=...` 下发）

### 7.2 Post（文章）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/posts` | 无 | 分页列表 |
| GET | `/posts/:id` | 无 | 文章详情（含 sections + TOC） |
| GET | `/posts/:id/related` | 无 | 相关文章 |
| POST | `/posts/:id/like` | 访客 | 点赞切换 |
| POST | `/posts/:id/view` | 访客 | 浏览计数（1h 去重） |
| GET | `/posts/:id/comments` | 无 | 评论树 |
| POST | `/posts/:id/comments` | 访客 | 发表评论 |
| POST | `/comments/:id/like` | 访客 | 评论点赞 |
| POST | `/admin/posts` | [Admin] | 创建文章 |
| PATCH | `/admin/posts/:id` | [Admin] | 更新文章 |
| DELETE | `/admin/posts/:id` | [Admin] | 删除文章 |

`GET /posts` 查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20，最大 100 |
| `category` | `tech | life | all` | 否 | 对齐 `PostItem.category` |
| `tag` | string | 否 | 标签 slug |
| `search` | string | 否 | 模糊搜索（走 Meilisearch） |
| `pinned` | boolean | 否 | 仅置顶 |
| `sort` | `date | views | likes` | 否 | 默认 `date` |
| `order` | `asc | desc` | 否 | 默认 `desc` |

响应 `data.items[]` 每项字段对齐 `PostItem`：

```json
{
  "id": 101,
  "title": "Nuxt 4 主题引擎实战",
  "summary": "...",
  "cover": "https://...",
  "tags": [{ "label": "Nuxt", "color": "emerald" }],
  "category": "tech",
  "readTime": 8,
  "likes": 42,
  "views": 1024,
  "comments": 12,
  "date": "2026-03-18T00:00:00.000Z",
  "folder": "frontend",
  "pinned": true
}
```

`GET /posts/:id` 响应 `data` 字段对齐 `ArticleDetail`：

```json
{
  "id": "b1d2...-uuid",
  "title": "...",
  "cover": "https://...",
  "date": "2026-03-18T00:00:00.000Z",
  "category": "前端开发",
  "readTime": "8 分钟",
  "views": 1024,
  "likes": 42,
  "comments": 12,
  "content": [
    { "type": "heading", "level": 1, "text": "引言", "id": "intro" },
    { "type": "paragraph", "text": "..." },
    { "type": "code", "language": "ts", "text": "const x = 1" },
    { "type": "quote", "text": "..." },
    { "type": "list", "items": ["a", "b"] }
  ],
  "toc": [{ "id": "intro", "text": "引言", "level": 1 }]
}
```

`POST /posts/:id/like` 响应：

```json
{ "liked": true, "likes": 43 }
```

`GET /posts/:id/comments` 返回 `{ items: CommentItem[], total: number }`，`total` 包括所有层级回复。
可选携带 `X-Visitor-Id`，每个评论的 `liked` 表示该访客是否已点赞；不携带时为 `false`。
响应设置 `Cache-Control: private, no-store`，避免个人点赞状态被共享缓存。无效访客头返回 400。

评论发表会对昵称和内容去除首尾空白：昵称 1–32 字符，内容 1–1000 字符，头像地址最多 512 字符。
`parentId` 必须属于同一文章；根评论深度 0，允许回复到深度 2，再深返回 1003。
归档文章拒评 1002，草稿文章按不存在处理。公开写接口始终返回 `isOwner: false`，不接受客户端指定作者权限。
评论创建与点赞切换通过事务和行锁保护计数。`POST /comments/:id/like` 返回 `{ liked, likes }`。
前端禁止请求期间重复提交；当前协议不保证网络中断后的重试幂等，响应丢失时应先读取确认。

`POST /posts/:id/comments` 请求：

```json
{
  "author": "匿名访客",
  "avatar": "https://...",
  "content": "写得不错",
  "parentId": null
}
```

响应 `data` 字段对齐 `CommentItem`：

```json
{
  "id": 231,
  "author": "匿名访客",
  "avatar": "https://...",
  "content": "写得不错",
  "time": "2026-04-16T10:30:00.000Z",
  "likes": 0,
  "liked": false,
  "isOwner": false,
  "replies": []
}
```

`GET /posts/:id/related` 响应 `data.items[]` 对齐 `RelatedPost`：

```json
{ "id": "uuid", "title": "...", "date": "2026-03-01T...", "category": "前端开发" }
```

### 7.3 Archive（归档）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/archive` | 无 | 按年聚合 |
| GET | `/archive/stats` | 无 | 归档统计 |

`GET /archive` 响应 `data.years[]` 对齐 `ArchiveYear`：

```json
{
  "year": 2026,
  "shortYear": "26",
  "count": 12,
  "posts": [
    {
      "date": "2026-03-18",
      "title": "...",
      "category": "前端开发",
      "categoryColor": "sky",
      "href": "/articles/b1d2..."
    }
  ]
}
```

`GET /archive/stats` 响应 `data`：

```json
{
  "stats": [
    { "label": "文章", "value": "32" },
    { "label": "分类", "value": "5" },
    { "label": "标签", "value": "20" }
  ],
  "distribution": [
    { "name": "前端开发", "count": 20, "percent": 62 },
    { "name": "随笔日记", "count": 17, "percent": 53 }
  ]
}
```

对齐 `ArchiveStat` + `CategoryDistribution`。

### 7.4 Stats（站点统计）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/stats/site` | 无 | 站点核心指标 |
| GET | `/stats/tags` | 无 | 标签云 |
| GET | `/stats/categories` | 无 | 分类列表 |

`GET /stats/site` 响应 `data` 对齐 `SiteStats`：

```json
{
  "articles": 32,
  "views": "12.8k",
  "comments": 234,
  "tags": 20,
  "uptimeDays": 1888
}
```

`GET /stats/tags` 响应 `data.items[]` 对齐 `TagItem`。

`GET /stats/categories` 响应 `data.items[]` 对齐 `CategoryItem`。

### 7.5 Moment（朋友圈）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/moments` | 无 | 动态流（分页） |
| GET | `/moments/:id` | 无 | 单条动态 |
| POST | `/moments/:id/like` | 访客 | 点赞切换 |
| GET | `/moments/:id/comments` | 无 | 评论列表 |
| POST | `/moments/:id/comments` | 访客 | 发表评论 |
| GET | `/moments/stats` | 无 | 作者统计 + 心情 + 社交 |
| POST | `/admin/moments` | [Admin] | 创建动态 |
| PATCH | `/admin/moments/:id` | [Admin] | 更新动态 |
| DELETE | `/admin/moments/:id` | [Admin] | 删除动态 |
| PATCH | `/admin/moments/settings` | [Admin] | 更新心情 / 社交链接 |

`GET /moments` 查询参数：`page` / `pageSize` / `topic` / `date`（`YYYY-MM-DD`）/ `authorId`。

响应 `data.items[]` 对齐 `MomentItem`：

```json
{
  "id": "m-uuid",
  "content": "今天阳光正好",
  "images": ["https://.../1.webp", "https://.../2.webp"],
  "date": "2026-04-10T08:12:00.000Z",
  "likes": 28,
  "isLiked": false,
  "location": "深圳 · 南山",
  "device": "iPhone 16 Pro",
  "topics": ["生活日常"],
  "comments": [
    {
      "id": "c-uuid",
      "author": "小明",
      "avatar": "https://...",
      "content": "真好看",
      "time": "2026-04-10T09:00:00.000Z",
      "isOwner": false,
      "profile": { "name": "小明", "avatar": "...", "bio": "...", "link": "..." }
    }
  ],
  "linkedArticle": {
    "id": "uuid",
    "title": "...",
    "summary": "...",
    "cover": "...",
    "url": "/articles/uuid"
  }
}
```

`GET /moments/stats` 响应 `data`：

```json
{
  "totalMoments": 16,
  "totalLikes": 412,
  "totalComments": 23,
  "mood": "今天阳光正好，适合写代码",
  "socials": [{ "icon": "lucide:github", "label": "GitHub", "href": "..." }]
}
```

### 7.6 Flash（闪念）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/flashes` | 无 | 笔记列表 |
| GET | `/flashes/:id` | 无 | 笔记详情 |
| POST | `/flashes/:id/like` | 访客 | 点赞切换 |
| POST | `/flashes/:id/comments` | 访客 | 发表评论 |
| GET | `/flashes/search` | 无 | 全文搜索 |
| POST | `/flashes/ai-search` | 访客 | AI 语义检索 |
| POST | `/admin/flashes` | [Admin] | 创建闪念 |
| PATCH | `/admin/flashes/:id` | [Admin] | 更新闪念 |
| DELETE | `/admin/flashes/:id` | [Admin] | 删除闪念 |

`GET /flashes` 查询参数：`page` / `pageSize` / `tag` / `userId`。

响应 `data.items[]` 对齐 `FlashNote`：

```json
{
  "id": "f-uuid",
  "userId": "tixxin",
  "content": "今天学到了 pgvector...",
  "tags": ["pg", "向量"],
  "createdAt": "2026-04-10T08:00:00.000Z",
  "updatedAt": "2026-04-10T08:00:00.000Z",
  "likes": 12,
  "comments": [
    {
      "id": "fc-uuid",
      "authorId": "v-hash",
      "authorName": "匿名访客",
      "authorAvatar": "https://...",
      "content": "学到了",
      "createdAt": "2026-04-10T09:00:00.000Z"
    }
  ]
}
```

`GET /flashes/search` 查询参数：`q`（必填）、`page`、`pageSize`。响应同上。

`POST /flashes/ai-search` 请求：

```json
{ "query": "最近在学的数据库扩展是什么" }
```

响应 `data` 对齐 `FlashAISearchResult`：

```json
{
  "answer": "根据 3 条相关笔记：你最近在学 pgvector...",
  "citedNoteIds": ["f-uuid-1", "f-uuid-2", "f-uuid-3"],
  "latencyMs": 512
}
```

### 7.7 Guestbook（留言板）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/guestbook/messages` | 无 | 留言列表（按日期分组） |
| POST | `/guestbook/messages` | 访客 | 发送留言 |
| POST | `/guestbook/messages/:id/reactions` | 访客 | 切换 emoji 反应 |
| GET | `/guestbook/pinned` | 无 | 置顶公告 |
| GET | `/guestbook/stats` | 无 | 留言统计 |
| GET | `/guestbook/rules` | 无 | 社区守则 |
| GET | `/guestbook/active-members` | 无 | 活跃成员 |
| DELETE | `/admin/guestbook/messages/:id` | [Admin] | 删除留言 |
| PUT | `/admin/guestbook/pinned` | [Admin] | 设置置顶 |

`GET /guestbook/messages` 响应 `data.groups[]` 对齐 `DateGroup`：

```json
{
  "date": "2026-04-10",
  "messages": [
    {
      "id": 101,
      "author": "匿名访客",
      "avatar": "https://...",
      "content": "博客不错",
      "time": "2026-04-10T08:00:00.000Z",
      "isOwner": false,
      "browser": "Chrome 136 on macOS",
      "region": "深圳",
      "replyTo": { "id": 98, "author": "博主", "content": "欢迎" },
      "reactions": [
        { "emoji": "👍", "count": 3, "reacted": true },
        { "emoji": "❤️", "count": 1, "reacted": false }
      ],
      "status": "sent"
    }
  ]
}
```

`POST /guestbook/messages` 请求：

```json
{
  "author": "匿名访客",
  "avatarColor": "emerald",
  "content": "写得真好",
  "replyToId": 98
}
```

响应 `data` 即新增的 `GuestMessage`（含 `browser`、`region` 由后端解析填充）。

`POST /guestbook/messages/:id/reactions` 请求：

```json
{ "emoji": "👍" }
```

响应：

```json
{ "emoji": "👍", "count": 4, "reacted": true }
```

`GET /guestbook/stats` 响应 `data.items[]` 对齐 `ChatStat`：

```json
[
  { "label": "总留言", "value": "1,234" },
  { "label": "活跃用户", "value": "89" },
  { "label": "今日新增", "value": "12" }
]
```

`GET /guestbook/rules` 响应 `data.items[]` 对齐 `ChatRule`。

`GET /guestbook/active-members` 响应 `data.items[]` 对齐 `ActiveMember`。

`GET /guestbook/pinned` 响应 `data` 对齐 `PinnedMessage`。

### 7.8 Gallery（图库，已实现）

图库以稳定作品编号关联受管媒体，公开与管理 DTO 分离。正式契约、字段边界和维护规则见 [图库业务](gallery.md)。

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/gallery` | 无 | 公开作品分页；q搜索、category分类，省略分类代表全部、空分类代表未分类 |
| GET | `/gallery/metadata` | 无 | 公开分类和统计、博主管理的器材介绍 |
| GET | `/gallery/:id` | 无 | 公开作品、实际媒体尺寸与可缺省拍摄信息 |
| GET | `/gallery/:id/navigation` | 无 | 当前筛选内的所在页及前后作品 |
| GET/POST | `/admin/gallery` | [Admin] | 管理分页/带requestId创建作品 |
| GET/PATCH/DELETE | `/admin/gallery/:id` | [Admin] | 读取/带revision编辑发布撤回排序/带revision删除 |
| GET | `/admin/gallery/submissions/:requestId` | [Admin] | 核查未知创建结果及已删除提交 |
| GET/PATCH | `/admin/gallery/settings` | [Admin] | 读取/带revision维护器材介绍 |

公开列表默认每页12件，按sortOrder与id倒序；只有published且未删除作品可见。管理状态为draft、published、withdrawn。拍摄日期使用可空YYYY-MM-DD，创建和首次发布时间分别维护，宽高和格式直接读取媒体，上传不会自动发布。v4内容包和完整备份均覆盖图库。旧设计的gallery/photos、categories、stats、gears独立端点未开放。
### 7.9 Link（友链）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/links` | 无 | 友链列表 |
| GET | `/links/rules` | 无 | 友链须知 |
| GET | `/links/site` | 无 | 本站信息 |
| POST | `/links/applications` | 访客 | 申请友链 |
| GET | `/admin/links/applications` | [Admin] | 审核队列 |
| POST | `/admin/links/applications/:id/approve` | [Admin] | 通过申请 |
| POST | `/admin/links/applications/:id/reject` | [Admin] | 拒绝申请 |
| DELETE | `/admin/links/:id` | [Admin] | 移除友链 |

`GET /links` 响应 `data.items[]` 对齐 `LinkItem`（额外附带 `id` 以便管理员端）：

```json
{
  "id": "uuid",
  "name": "代码小站",
  "description": "...",
  "url": "https://...",
  "avatar": "https://...",
  "domain": "example.com"
}
```

`POST /links/applications` 请求：

```json
{
  "name": "我的博客",
  "description": "独立开发者日志",
  "url": "https://example.com",
  "avatar": "https://.../logo.png",
  "contactEmail": "me@example.com"
}
```

### 7.10 Project（项目，已实现）

正式字段、统计口径和维护规则见 [项目业务](projects.md)。项目进展progress与站点发布status独立，不采集无来源Star/Fork。

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/projects` | 无 | 公开项目，q/progress/tag/page/pageSize查询；默认12项稳定分页 |
| GET | `/projects/metadata` | 无 | 公开项目及进展数量、技术标签使用覆盖率 |
| GET | `/projects/:id` | 无 | 公开项目投影，不含私有状态和管理版本 |
| GET/POST | `/admin/projects` | [Admin] | 管理列表/带requestId创建 |
| GET/PATCH/DELETE | `/admin/projects/:id` | [Admin] | 读取/带revision编辑、发布、撤回、排序/带revision删除 |
| GET | `/admin/projects/submissions/:requestId` | [Admin] | 查询未知创建结果及删除墓碑 |

技术标签忽略大小写去重和筛选。覆盖率为使用此技术的公开项目数除以全部公开项目数，非代码语言分析。封面使用可空受管媒体，链接经服务端规范化，不创建#占位。v5内容包及完整备份均保留项目；导入以草稿等待复核，进展信息不改变。旧设计的独立stats、tech-stack端点未开放。

### 7.11 About（关于）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/about` | 无 | 一次返回全部 |
| PUT | `/admin/about` | [Admin] | 整体更新 |

`GET /about` 响应 `data`：

```json
{
  "profile": {
    "name": "TixXin",
    "avatar": "https://...",
    "bio": "...",
    "socials": [
      { "icon": "lucide:github", "label": "GitHub", "href": "...", "primary": true }
    ]
  },
  "skills": [{ "name": "TypeScript", "percent": 90 }],
  "experiences": [{ "period": "2020 - 至今", "title": "...", "description": "..." }],
  "contacts": [{ "icon": "lucide:mail", "type": "Email", "value": "...", "href": "..." }],
  "hobbies": [{ "icon": "lucide:camera", "label": "摄影" }],
  "books": [{ "title": "代码整洁之道", "author": "Robert C. Martin" }]
}
```

字段分别对齐 `Profile` / `SkillItem` / `ExperienceItem` / `ContactItem` / `HobbyItem` / `BookItem`。

### 7.12 Site（站点配置）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/site/config` | 无 | 页脚 + 技术栈 |
| GET | `/site/announcements` | 无 | 公告列表 |
| GET | `/site/owner-card` | 无 | 博主卡片 |
| GET | `/site/owner-presence` | 无 | 博主在线状态 |
| GET | `/site/status` | 无 | 系统状态 |
| PUT | `/admin/site/owner-presence` | [Admin] | 更新在线状态 |
| POST | `/admin/site/announcements` | [Admin] | 发布公告 |
| DELETE | `/admin/site/announcements/:id` | [Admin] | 撤下公告 |
| PUT | `/admin/site/config` | [Admin] | 更新站点配置 |

`GET /site/config` 响应 `data`：

```json
{
  "footerLinks": [
    { "label": "关于本站", "href": "/about", "external": false },
    { "label": "RSS 订阅", "href": "/feed/rss.xml", "external": true }
  ],
  "poweredBy": [
    { "label": "Nuxt", "href": "https://nuxt.com" },
    { "label": "Vue", "href": "https://vuejs.org" }
  ]
}
```

对齐 `FooterLink` + `PoweredByItem`。

`GET /site/announcements` 响应 `data.items[]` 对齐 `SiteAnnouncement`。

`GET /site/owner-card` 响应 `data` 对齐 `OwnerCardInfo`。

`GET /site/owner-presence` 响应 `data` 对齐 `OwnerPresenceInfo`。

`GET /site/status` 响应 `data` 对齐 `SiteStatus`：

```json
{ "pingMs": 18, "statusText": "All Systems Operational" }
```

### 7.13 Nav（导航）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/nav/items` | 无 | 导航菜单 |
| PUT | `/admin/nav/items` | [Admin] | 整体替换 |

`GET /nav/items` 响应 `data.items[]` 对齐 `NavItem`：

```json
{ "icon": "lucide:home", "label": "主页", "to": "/", "desktopOnly": false }
```

### 7.14 Search（跨域全文搜索）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/search` | 无 | 跨域全文搜索 |

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 查询词 |
| `type` | string | 否 | 逗号分隔：`post,moment,flash`，默认全部 |
| `page` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20 |

响应 `data`：

```json
{
  "posts": { "items": [], "total": 0 },
  "moments": { "items": [], "total": 0 },
  "flashes": { "items": [], "total": 0 }
}
```

各 `items[]` 字段与各域列表接口一致。

### 7.15 Feed（订阅）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/feed/rss.xml` | 无 | RSS 2.0 |
| GET | `/feed/atom.xml` | 无 | Atom 1.0 |
| GET | `/feed/feed.json` | 无 | JSON Feed 1.1 |
| GET | `/feed/moments.rss.xml` | 无 | 朋友圈 RSS |

Content-Type：

- RSS / Atom → `application/xml; charset=utf-8`
- JSON Feed → `application/feed+json`

响应缓存 10 分钟（`Cache-Control: public, max-age=600`）。

### 7.16 Upload（文件上传）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| POST | `/upload/presign` | 访客 | 获取预签名 URL |
| POST | `/upload/callback` | 访客 | 上传完成回调 |

`POST /upload/presign` 请求：

```json
{
  "type": "moment-image",
  "contentType": "image/webp",
  "size": 1048576
}
```

`type` 白名单：`moment-image` / `guestbook-avatar` / `gallery-photo`（管理员） / `post-cover`（管理员）。

响应 `data`：

```json
{
  "uploadUrl": "https://r2.example.com/signed?...",
  "fileKey": "moments/2026/04/16/abcd.webp",
  "publicUrl": "https://cdn.tixxin.com/moments/2026/04/16/abcd.webp",
  "expiresAt": "2026-04-16T11:00:00.000Z"
}
```

`POST /upload/callback` 请求：

```json
{
  "fileKey": "moments/2026/04/16/abcd.webp",
  "width": 1920,
  "height": 1080
}
```

### 7.17 Notifications（WebSocket）

连接：

- 公共命名空间：`<WS_BASE_URL>/ws/public`
- 管理员命名空间：`<WS_BASE_URL>/ws/admin`（连接时 `auth: { token: '<jwt>' }`）

事件（服务端 → 客户端）：

| 事件名 | payload | 说明 |
|--------|---------|------|
| `comment.created` | `{ scope: 'post' | 'moment' | 'flash', targetId, comment }` | 任一评论新增 |
| `guestbook.created` | `{ message }`（GuestMessage 完整对象） | 新留言 |
| `guestbook.reaction.changed` | `{ messageId, emoji, count }` | emoji 反应变化 |
| `moment.created` | `{ moment }`（MomentItem 完整对象） | 博主新发朋友圈 |
| `owner.presence.changed` | `{ presence }`（OwnerPresenceInfo） | 博主状态切换 |
| `post.like.changed` | `{ postId, likes }` | 文章点赞数 |

事件（客户端 → 服务端）：

| 事件名 | payload | 说明 |
|--------|---------|------|
| `ping` | `{}` | 心跳（客户端每 30s） |
| `subscribe` | `{ topics: string[] }` | 订阅特定 topic（预留） |

心跳缺失 90s 视为离线。

### 7.18 健康检查

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/health` | 无 | 存活探针，永远 200 |
| GET | `/ready` | 无 | 就绪探针，依赖异常时 503 |

不走统一响应包装，返回：

```json
{ "status": "ok", "uptimeSeconds": 1234, "checks": { "db": "ok", "redis": "ok", "meilisearch": "ok" } }
```

## 8. 示例

### 8.1 获取首页文章列表

```bash
curl 'https://api.tixxin.com/api/v1/posts?page=1&pageSize=20&category=tech&sort=date&order=desc'
```

### 8.2 发表朋友圈评论

```bash
curl -X POST 'https://api.tixxin.com/api/v1/moments/m-123/comments' \
  -H 'Content-Type: application/json' \
  -H 'X-Visitor-Id: v-abc' \
  -d '{ "author": "小明", "avatar": "https://...", "content": "写得好" }'
```

### 8.3 AI 语义检索闪念

```bash
curl -X POST 'https://api.tixxin.com/api/v1/flashes/ai-search' \
  -H 'Content-Type: application/json' \
  -H 'X-Visitor-Id: v-abc' \
  -d '{ "query": "最近学的数据库扩展" }'
```

### 8.4 切换留言 emoji 反应

```bash
curl -X POST 'https://api.tixxin.com/api/v1/guestbook/messages/101/reactions' \
  -H 'Content-Type: application/json' \
  -H 'X-Visitor-Id: v-abc' \
  -d '{ "emoji": "👍" }'
```

### 8.5 管理员登录后创建文章

```bash
# 登录
curl -X POST 'https://api.tixxin.com/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -c cookie.txt \
  -d '{ "username": "admin", "password": "xxx" }'

# 创建文章
curl -X POST 'https://api.tixxin.com/api/v1/admin/posts' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -d '{
    "title": "...",
    "summary": "...",
    "cover": "...",
    "tags": ["nuxt", "vue"],
    "category": "tech",
    "contentRaw": "# 标题\n..."
  }'
```

## 9. 前后端类型对齐附录

以下表格列出后端响应字段与前端 `src/frontend/web-blog/app/features/<domain>/types.ts` 的映射关系。标注"派生"的字段由后端在响应阶段计算。

### 9.1 Post

| 前端字段（types.ts） | 后端来源 | 说明 |
|---------------------|---------|------|
| `PostItem.id: number` | `Post.id: uuid` 派生 | uuid 取后 8 字节转 BigInt，再对 Number.MAX_SAFE_INTEGER 取模 |
| `PostItem.title` | 同名 | 直映 |
| `PostItem.summary` | 同名 | 直映 |
| `PostItem.cover` | 同名 | 直映 |
| `PostItem.tags: PostTag[]` | `Post.tags` + `PostTag` 关联 | 响应阶段取 label + color |
| `PostItem.category` | `Post.category` | 枚举值 |
| `PostItem.readTime: number` | `Post.readTimeMinutes` | 数字分钟数 |
| `PostItem.likes` / `views` / `comments` | 各计数列 | 冗余存储 |
| `PostItem.date` | `Post.publishedAt` | ISO 字符串 |
| `PostItem.folder` | `Post.category` 或 `Post.folder`（预留） | 当前取 category 对应中文分类名 |
| `PostItem.pinned` | `Post.pinned` | 直映 |
| `ArticleDetail.id: string` | `Post.id: uuid` | 直映 uuid |
| `ArticleDetail.readTime: string` | `Post.readTimeMinutes` 派生 | 格式化 `"${n} 分钟"` |
| `ArticleDetail.category: string` | `Post.category` 派生 | 中文分类名 |
| `ArticleDetail.content: ArticleSection[]` | `Post.contentSections` | 后端解析 Markdown 后缓存的 JSON |

### 9.2 Comment

| 前端字段 | 后端来源 | 说明 |
|---------|---------|------|
| `CommentItem.id: number` | `Comment.id: uuid` 派生 | 同 PostItem.id |
| `CommentItem.author` | `Comment.authorSnapshot.name` | 冗余快照 |
| `CommentItem.avatar` | `Comment.authorSnapshot.avatar` | 冗余快照 |
| `CommentItem.time` | `Comment.createdAt` | ISO 字符串，前端做相对时间 |
| `CommentItem.isOwner` | `Comment.authorSnapshot.isOwner` | 响应阶段判断 |
| `CommentItem.replies` | 递归 | 后端最多返回 3 层 |

### 9.3 Moment

| 前端字段 | 后端来源 | 说明 |
|---------|---------|------|
| `MomentItem.id: string` | `Moment.id: uuid` | 直映 |
| `MomentItem.isLiked` | 访客相关 | 响应阶段按 `visitorIdHash` 查 `MomentLike` |
| `MomentItem.images` | `Moment.images: string[]` | 公开 URL 数组 |
| `MomentItem.date` | `Moment.createdAt` | ISO |
| `MomentLinkedArticle.url` | `Post.slug` 派生 | 格式 `/articles/${id}` |

### 9.4 Guestbook

| 前端字段 | 后端来源 | 说明 |
|---------|---------|------|
| `GuestMessage.id: number` | `GuestMessage.id: uuid` 派生 | 同上 |
| `GuestMessage.browser` | 从 UA 解析 | 后端用 `ua-parser-js` |
| `GuestMessage.region` | 从 IP 解析 | MaxMind GeoLite2 |
| `GuestMessage.time` | `createdAt` | ISO |
| `MessageReaction.reacted` | 访客相关 | 响应阶段计算 |
| `DateGroup.date` | `YYYY-MM-DD` | 按 Asia/Shanghai 时区分组 |

### 9.5 Flash

| 前端字段 | 后端来源 | 说明 |
|---------|---------|------|
| `FlashNote.id: string` | `FlashNote.id: uuid` | 直映 |
| `FlashNote.tags: string[]` | `FlashNote.tags: jsonb` | 直映 |
| `FlashAISearchResult.answer` | 模板拼接 | 后端拼接命中笔记内容，不走 LLM 生成 |
| `FlashAISearchResult.latencyMs` | 服务端耗时 | 真实耗时 |

### 9.6 Stats

| 前端字段 | 后端来源 | 说明 |
|---------|---------|------|
| `SiteStats.views: string` | 后端格式化 | `"12.8k"` / `"1.2M"` |
| `SiteStats.uptimeDays: number` | `SiteConfig.launchedAt` 派生 | 当日 - 上线日 |

### 9.7 其余域

字段基本一一对齐，无特殊派生。详见各节响应示例。

## 附录 A 错误码表

| 错误码 | HTTP | 含义 |
|--------|------|------|
| 0 | 200 | 成功 |
| 10 | 400 | 参数校验失败 |
| 11 | 400 | 参数缺失 |
| 12 | 400 | 参数格式错误 |
| 20 | 401 | 未鉴权 |
| 21 | 401 | Access token 失效 |
| 22 | 401 | Refresh token 失效 |
| 23 | 403 | 权限不足 |
| 24 | 403 | IP 黑名单 |
| 30 | 404 | 资源不存在（通用） |
| 40 | 409 | 状态冲突 |
| 50 | 422 | 命中敏感词 |
| 51 | 422 | 业务规则拒绝 |
| 60 | 429 | 限流 |
| 90 | 500 | 服务端异常 |
| 91 | 503 | 依赖不可用 |
| 1001 | 404 | 文章不存在 |
| 1002 | 422 | 文章已归档，无法评论 |
| 1003 | 409 | 评论深度超限（≥ 3 层） |
| 2001 | 404 | 动态不存在 |
| 3001 | 404 | 闪念不存在 |
| 3002 | 503 | AI 服务不可用 |
| 3003 | 422 | AI 查询为空 |
| 4001 | 404 | 留言不存在 |
| 4002 | 422 | 留言被置顶，无法删除 |
| 5001 | 404 | 友链不存在 |
| 5002 | 409 | 友链申请已存在 |
| 6001 | 404 | 项目不存在 |
| 6002 | 503 | GitHub API 不可用 |
| 7001 | 422 | 上传文件大小超限 |
| 7002 | 422 | 上传文件类型不支持 |
| 7003 | 404 | 上传预签名已过期 |

错误码分段：

- `0-9`：成功
- `10-19`：参数类
- `20-29`：鉴权与权限
- `30-39`：资源类
- `40-49`：状态冲突
- `50-59`：业务规则
- `60-69`：限流与滥用
- `90-99`：系统类
- `1xxx`：文章
- `2xxx`：朋友圈
- `3xxx`：闪念 / AI
- `4xxx`：留言板
- `5xxx`：友链
- `6xxx`：项目
- `7xxx`：上传
- `8xxx`：站点 / 关于 / 画廊
- `9xxx`：管理员后台

## 10. 变更历史

| 日期 | 接口 | 变更 |
|------|------|------|
| 2026-04-16 | 全部 | 初版契约 |
| 2026-07-20 | GET /flashes | 新增可选查询参数 archived(boolean,默认 false):true 时返回归档列表,服务前端归档箱视图 |

## 管理概览

`GET /api/v1/admin/overview` 需要管理员 Bearer JWT。返回 `counts`（posts、published、drafts、archived、trashed、comments、flashes、flashDrafts、unanswered）及最多 6 条 `recentPosts`（id、title、status、updatedAt）。待回复数量只计算公开文章下没有博主直接回复的游客根评论；评论数包含回复。

### 文章管理筛选与恢复

`GET /admin/posts` 新增 category（tech/life）、folder、tag、sort（updatedAt/publishedAt/title）与 order（asc/desc），与 search/status/page/pageSize 组合使用。列表额外返回 category、folder、tags、pinned、updatedAt。

`GET /admin/posts/filters` 返回包含草稿与归档内容的专栏/标签选项，仅管理员可读。`POST /admin/posts/:id/restore` 只允许恢复已归档或回收的文章，恢复为草稿，不自动公开；重复恢复返回 400。以上路径均位于 `/api/v1` 下。

### 评论管理上下文

`GET /api/v1/admin/comments` 支持 postId、search、unanswered=true 和分页。待回复只统计公开文章下尚无博主直接回复的游客根评论，与管理概览一致。列表返回 postStatus，前端不向未公开文章展示可用回复操作。

`GET /api/v1/admin/comments/articles` 返回存在评论的文章选项。`GET /api/v1/admin/comments/:id/context?page=1` 返回当前评论、祖先链、每页 20 条直接回复、total 和 deleteTotal（当前评论及所有后代）。

`DELETE /api/v1/admin/comments/:id?expectedTotal=N&expectedFingerprint=...` 在文章行锁内重新计算删除范围；与确认时范围不同返回 409，数据保留。expectedFingerprint 为上下文返回的 SHA-256 指纹，现为必传；旧管理客户端需升级，不可仅依赖数量确认。成功返回 deleted。所有上述接口均要求管理员 JWT。

### 后台闪念管理

`GET /api/v1/admin/flashes` 增加 status=all/draft/published/archived。status 未传时保留 archived 布尔筛选的原行为；草稿与已发布均排除归档。`GET /api/v1/admin/flashes/:id` 允许管理员读取草稿、归档及评论，匿名返回 401。

后台 `/admin/flashes` 复用 FlashEditor 和已有创建/更新/删除评论接口；归档恢复使用 `{isArchived:false,isDraft:true}`，恢复后不自动公开。正文支持最多 50000 字，图片最多 9 个 HTTP(S) URL，标签最多 20 个、每个 64 字。

### 专栏与标签维护

`GET /api/v1/admin/taxonomy` 返回 folders/tags（id、label、total、published，标签含 color）及固定内容类型引用统计。`POST /admin/taxonomy/folders|tags` 新增，`PATCH /admin/taxonomy/:kind/:id` 重命名/改色，`DELETE` 删除未被引用的目录项；路径均有 `/api/v1` 前缀且要求管理员 JWT。输入 label 去首尾空白后为 1–64 字，同名返回 409，有引用（含草稿、归档）删除返回 409。

专栏迁移回填现有 post.folder 名称；重命名在事务内同步更新所有文章的 folder。标签维持原多对多 ID，更名同步 label/slug；公开统计始终按已发布文章计算。文章保存与目录写操作共用事务级 advisory lock，保证引用检查与修改原子性。编辑器仍支持手工新增专栏名，保存时自动登记目录。

### 管理员修改密码

`POST /api/v1/auth/password` 需要管理员 Bearer JWT 和同源请求，body 为 currentPassword（1–128 字）、newPassword（12–128 字），新旧不能相同。错误当前密码返回 400，不撤销会话；成功更新密码哈希，递增 admin_user.session_version，撤销该账号全部刷新记录并清除当前 Cookie，返回 `{ok:true}`。

访问 JWT 带 version，守卫与数据库版本比较，因此所有旧访问令牌即时拒绝；登录、刷新及改密按管理员行锁顺序串行化。接口沿用凭据操作限流，新增密码字段全部日志脱敏。后台账号页不保存密码到本机存储，成功清空输入并要求重新登录。

### 内容版本与修订基础（长期维护阶段）

管理文章列表与详情增加 revision；详情增加 savedAt。现有文章迁移为版本 0 并保存初始快照，新文章首次保存为版本 1。版本仅随内容/管理状态及关联目录修改递增，互动计数不推进内容版本。

`PATCH /api/v1/admin/posts/:id` 必须提交读取时的 revision；缺失返回 428，过期返回 409，事务回滚且不覆盖内容。归档与恢复请求必须传 query revision，版本过期同样返回 409。旧管理客户端需先重新读取文章，不可省略版本。

`GET /api/v1/admin/posts/:id/revisions?page=1` 返回每页 20 条版本摘要；`GET /api/v1/admin/posts/:id/revisions/:revision` 返回内容快照。快照保留正文与编辑元信息，不包含阅读、点赞及评论计数。后台提供历史分页、正文差异比较、载入合并与恢复为新草稿。


### 修订恢复与目录历史名

`POST /api/v1/admin/posts/:id/revisions/:historical/restore` 接收 `{revision: 当前内容版本}`。成功生成新版本并将文章设为草稿；过期版本返回 409；评论、阅读和点赞计数不回滚。

目录更名维护 taxonomy_alias（kind/alias/target）。连续更名将旧别名直接指向最新名称；文章创建/保存和历史修订恢复统一解析别名。重新创建历史名称返回 409；别名目标已删除时保存拒绝并提示重新选择。

编辑器自动保存服务器仅用于草稿；已公开/归档内容只自动保留本机副本。副本按账号与文章隔离，不在服务器 API 中读取或传输，用户显式选择恢复后仍需手动保存确认。


### 文章地址、封面和 SEO

管理文章保存支持 slug（最长 120 位，小写字母开头，仅字母/数字/连字符，可留空）、coverAlt（300）、seoTitle（160）、seoDescription（320）、seoNoindex（布尔）。这些字段随内容版本和修订保存。未提供的新字段保留现值，兼容旧修订及旧恢复副本。

`GET /api/v1/posts/by-slug/:slug` 解析当前或历史地址，仅返回已发布文章。地址由 post_address 统一保留，同一地址不可分配给另一文章。旧数字 URL 和旧标识页面会跳转到当前规范地址；RSS 链接使用当前地址，GUID 保持数字身份稳定。

seoNoindex 仅控制搜索引擎收录，不是隐私权限：文章仍公开、可通过站内搜索及 RSS 访问。站点地图排除 noindex 文章；页面输出相应 robots、canonical 和 SEO 元信息。

JSON 正文限制调整为 1MB，以支持 DTO 允许的 20 万字 UTF-8 正文；字段校验继续生效。发布前确认由后台界面展示标题、地址、目录、摘要和收录规则，保存时继续校验版本与地址唯一性。


### 媒体资源

- `POST /api/v1/admin/media`：multipart 单文件字段 file，可传 uploadId（UUID v4）与 alt（最多 300 字）。仅管理员可用。同一 uploadId 和相同规范化图片重试返回原资源，避免重复上传。
- 支持 JPEG/PNG/WebP，单文件最多 8MB，最多 4000 万输入像素；真实解码后自动纠正方向、最长边不超过 4096 并输出 WebP。原始元信息被移除，文件系统键由 UUID 生成，不使用用户文件路径。
- `GET /api/v1/admin/media?page=1&search=...&deleted=false`：分页检索文件名/替代文本。`PATCH /:id` 更新 alt。
- `GET /api/v1/admin/media/:id/references`：每页 20 条引用，覆盖当前文章、历史修订和闪念的全部状态。
- `DELETE /api/v1/admin/media/:id`：有引用返回 409；无引用则移入回收，公共链接返回 404，文件保留。`POST /:id/restore` 验证文件存在后恢复。
- `GET /api/v1/media/:uuid.webp`：返回规范化图片字节；资源链接可公开访问，管理元信息接口仍需鉴权。

内容保存与媒体移除共用事务锁，媒体引用索引随内容及修订原子更新。不存在或已移除的受管图片不能再被文章/闪念保存引用。本文所称引用数量是内容位置数量，历史版本分别计数。

实现依据：[Sharp 输入限制](https://sharp.pixelplumbing.com/api-constructor/)、[Sharp 默认元信息处理](https://sharp.pixelplumbing.com/api-output/)。


### 文章批量管理与回收站

现有 post.status 仍为 draft/published/archived；新增 deleted_at 作为回收标记。默认管理列表和概览文章数量不含回收站；status=trash 单独查询回收内容。列表返回 deleted，详情返回可选 deletedAt。回收时转为不公开草稿，保留正文、评论、修订、历史地址及图片引用，编辑与历史恢复入口拒绝直接保存回收文章；先恢复为草稿后才可编辑。概览增加 trashed，最近更新不显示回收内容。

- `POST /api/v1/admin/posts/batch/preview`：`{action, items:[{id,revision}]}`，1–50 个唯一 ID。action 为 withdraw/archive/trash/restore/delete，不提供批量发布。返回每项标题、版本、可执行状态/原因、影响数量、ticket（UUID）、expiresIn。仅创建预览记录，不修改文章。
- `POST /api/v1/admin/posts/batch/execute`：`{ticket, acknowledgement?}`。预览创建后 5 分钟内有效，绑定操作者和会话版本；delete 必须额外提交 `acknowledgement: "永久删除"`。永久删除仅允许已回收文章。
- 每项在独立事务中重新锁定并检查版本/状态。删除还检查实际关联记录集合，包含评论及其点赞、修订、历史地址、媒体引用、文章点赞与访问去重记录；即使数量不变而评论被替换，旧预览也会拒绝。失败条目回滚并保存原因，其他条目继续。
- 每项结果随内容事务提交到 post_batch_operation；同 ticket 并发或重试不会重复执行。返回 results、successCount、failedCount、pendingCount、completed 和原 preview。部分成功返回正常结果，由客户端逐项展示，不能仅凭 HTTP 成功认定全量成功。
- `GET /api/v1/admin/posts/batch/:ticket`：读取当前账号操作的已提交结果，可在断线后查询。`GET /api/v1/admin/posts/batch`：最近 10 次已开始操作，后台刷新后可重新打开。过期未完成操作只能查询；刷新文章列表并重新预览剩余条目。
- 永久删除级联清理文章关联记录，媒体实体与文件保留。文章回收/归档/恢复会推进内容版本并保存修订；恢复不会自动公开。

后台当前页最多选择 20 篇，切换筛选/分页后清空勾选；执行前使用原生对话框确认。网关和客户端批量执行超时为 60 秒，超时不视为未执行，使用持久化记录查询真实结果。


### 评论审核与可见性

迁移为全部已有评论添加 status=published、revision=0，保持现有数据和公开状态。状态为 published（通过）、pending（待审）、hidden（隐藏）、spam（垃圾）。公开评论必须自身及最多两级祖先均为 published，且文章已发布并未回收；隐藏上级会隐藏回复，恢复上级不会恢复单独隐藏或标记垃圾的回复。

- `GET /api/v1/admin/comments/policy`：requireApproval、revision、updatedAt、notification。notification 固定为 not_configured，未发送任何邮件/消息。
- `PATCH /api/v1/admin/comments/policy`：`{requireApproval:boolean, revision:number}`，版本冲突 409。策略持久化、保存后运行时生效，只控制新的游客评论；默认 false，保持原行为。博主真实管理回复直接通过。
- 新游客评论成功响应增加 moderationStatus=published/pending；待审内容仅返回给本次提交者，公开评论树不含它。前端提示已提交待审核，不增加公开列表和计数。
- `GET /api/v1/admin/comments` 增加 status、from、to（YYYY-MM-DD；UTC 日期含首尾）、visible、revision、postDeleted。status 指自身状态，visible 表示综合祖先/文章状态后的实际公开结果。待回复只计算当前可见且没有可见博主直接回复的根评论。
- 上下文增加 deleteFingerprint、visibleTotal、approvedVisibleTotal、visible；当前、祖先和直接回复均带审核状态/版本。删除/审核确认绑定实际子树、祖先状态、文章版本及评论点赞集合，范围变化返回 409。
- `POST /api/v1/admin/comments/:id/moderation`：`{status, revision, expectedFingerprint}`。只改变当前评论并递增版本，保留子回复自身状态。文章行锁保护审核、评论新增、点赞与删除，公开计数在同一事务重算。
- 评论点赞和新增回复都要求目标实际可见；草稿、回收、待审、隐藏、垃圾及被上级阻挡的评论不能通过互动接口泄露计数。

文章缓存评论数表示审核可见的整棵评论树数量；公开概览/发现还排除未发布文章。管理概览的 comments 为全部已存储评论，publicComments 为当前公开可见数量，pendingComments/spamComments 为按自身状态统计。现有 IP 固定窗口限流继续生效，更换客户端访客 ID 不能突破同 IP 配额；未接入外部垃圾识别或通知服务。


### 站点公开资料与历史

- `GET /api/v1/site` 返回站点公开资料；没有内部连接、账号凭据或部署密钥。管理读写为 `GET/PATCH /api/v1/admin/site`，需要管理员 JWT。
- PATCH 必传 name（1–80）、description（0–300）、ownerName（1–80）、ownerTitle（0–200）、avatar（0–1000）、avatarAlt（0–300）、seoTitle（0–160）、seoDescription（0–320）、announcement（0–1000）、socials（最多 8 个）及 revision。
- social 包含 label（1–40）、href（1–1000）、icon（支持的 Lucide 名称）。链接只允许无内嵌凭据的 HTTP(S) 或 mailto；头像支持 HTTP(S) 或站内路径，拒绝协议相对 URL。受管媒体必须存在且未回收。
- 成功递增 revision，保存历史并返回 updatedAt 和 announcementUpdatedAt。后两者只读，不能在 PATCH 中提交。旧版本 409，失败回滚并保留当前资料。
- `GET /api/v1/admin/site/revisions?page=1` 每页 20 条摘要；`GET /revisions/:revision` 读取历史；`POST /revisions/:revision/restore` body 为 `{revision:当前版本}`，恢复产生新版本。
- 当前头像与所有历史配置均登记媒体引用，清空当前头像后历史引用仍保护原文件。媒体引用列表链接到站点设置。

前端 SSR 首次读取后共享站点资料。应用范围为首页标题/描述、Open Graph 站点名称、文章 JSON-LD 作者/发布者、博主名片/头像/社交链接、版权、各主题公告，以及文章/闪念 RSS 的频道信息和订阅链接名称。专题、朋友圈等既有独立内容源继续保持原契约。部署站点地址、监听端口和存储目录由环境配置，需重启服务；不通过公开资料接口修改。

公开 metadata 新增 activity：按 UTC 自然日统计当前可见文章/评论，包含本周及前 14 周，共 105 格。回收/撤回文章和不可见评论不计入热力图。强度由真实数量映射，界面支持键盘方向键查看每日值。uptimeDays 仅指服务本次进程运行天数；不称作站点稳定运行天数。页脚不生成模拟延迟或“全系统正常”结论。


### 稳定管理会话

访问 JWT 增加 sid，指向 admin_session。刷新轮换保持同一 sid，access 最长 15 分钟、refresh 与会话到期为成功续期后 7 天。守卫每次请求验证会话未撤销/未到期和账号 session_version；数据库故障返回 503，不把基础设施故障伪装为退出。

- `GET /api/v1/auth/sessions?page=1`：当前账号仍有效的会话，每页 20 条，包含粗略设备名称、登录时间、最近续期、到期时间及 current。只保存系统/浏览器类别，不新增完整 User-Agent 或 IP 记录。旧记录迁移时登录时间未知，明确显示未知。
- `DELETE /api/v1/auth/sessions/:id`：仅能撤销自己的会话，同时撤销关联刷新记录。撤销当前会话清除 Cookie，返回 current=true。
- `POST /api/v1/auth/sessions/revoke-others`：保留当前会话，撤销该账号其他有效会话，返回真实 revoked 数量。
- `POST /api/v1/auth/logout`：撤销请求中可验证的 Cookie 会话及当前有效访问令牌会话；两者不同时都处理。后续旧访问令牌和刷新 Cookie 均失效。返回 ok 和 revoked 数量。
- 改密继续递增 session_version，并撤销全部会话与刷新记录。已通过鉴权的在途操作可能完成；批量文章操作在每项开始前也检查会话。

迁移保留有效旧刷新记录，旧 JWT 缺少 sid 时通过原 Cookie 刷新升级；迁移窗口中产生的有效无 sid 刷新记录也可升级。浏览器使用 Web Locks（可用时）串行化同源跨标签页 Cookie 操作。有效会话表示仍可使用的登录授权，不证明设备当前在线。

### 管理操作审计

`GET /api/v1/admin/audit?page=1&action=post.update&state=failure&from=2026-09-01&to=2026-09-07` 仅管理员可读，每页 20 条。action 选项由 `GET /admin/audit/actions` 获取，state 为 pending/success/partial/failure/unknown，日期按 UTC 含首尾。无日志修改或删除接口。

审计记录包括操作者、对象类型/编号、请求开始与处理结束时刻、HTTP 状态、提交字段名称、版本及必要数量。提交字段不表示每个值都改变。密码、访问/刷新令牌、原始正文、完整敏感请求体和原始设备标识均不写入审计。

限流通过后，管理操作开始前先持久化意图；意图写入失败返回 503，核心操作尚未执行。执行后的结果正常写库；结果写入短时失败保留 pending 意图、返回实际核心操作结果及 `X-Audit-Status: pending`，使用有界队列补全。进程中断或队列结果未补全时需核对对象状态，不能把 pending/unknown 视为未执行。审计列表 health 给出待确认/重试数量。

覆盖登录/退出/改密与会话撤销、文章及批量/历史恢复、评论治理、媒体、闪念、分类标签和站点资料。无有效签名的匿名管理探测不会造成审计库写放大；有签名但会话已撤销的管理请求记录拒绝结果，登录尝试记录失败。超过限流的请求由 HTTP 日志记录。

审计中的文章批次可通过 `/admin/posts?operation=UUID` 重新读取持久化结果，评论通过 commentId 打开上下文，媒体支持按 UUID 搜索。对象当前状态可能与历史记录不同。


### 内容包、恢复上下文与运行诊断

`POST /api/v1/admin/backup/export` 接收 `{mediaIncluded:boolean}`，下载 `tixxin-content` v1 JSON。该响应为文件，不使用普通 data 包装；只把导出计数交给审计。内容包用于迁入新草稿，完整数据库/历史/账号及全部登记媒体的备份恢复使用 `scripts/full-backup.mjs`。

`POST /admin/backup/imports/preview` 为 multipart，file 为 JSON，requestId 为 UUID v4，strategy=skip/copy，includeSettings=true/false。返回有期限的 ticket、confirmation、明确清单、冲突/引用错误与统计；预览不包含正文或图片字节。相同上传标识重试返回已有票据。

`POST /admin/backup/imports/:id/repreview` 使用仍有效的已上传内容重新预览。`POST /:id/execute` 接收 `{acknowledgement:"导入为新草稿",confirmation}`，绑定实际预览。目标内容或预览变化返回 409。成功只创建新文章/闪念草稿，并在选择时迁入站点资料及审核设置；已有内容保持。数据库统一提交，已确认的失败回滚，新文件在媒体锁内清理；提交结果不确定时保留文件并查询持久化结果。重复执行已完成票据不会重复创建。

`GET /admin/backup/imports` 返回本人最近 10 条记录，`GET /:id` 查询结果；上传内容 15 分钟有效，完成或过期后清除临时包正文。文件上限 50MB；格式、字段、评论层级、媒体真实 WebP/摘要/尺寸/引用校验由服务器执行。

`GET /site` 的 X-Content-Context 响应头标识当前数据上下文。前端在页面初始化时保存该值，管理请求和上传附带相同头；正常配置保存不改变上下文。完整恢复会轮换 content_context 并要求新的上下文，旧页面即使重新登录也无法继续写入，缺失为 428、失配为 409。

`GET /api/v1/admin/maintenance/diagnostics` 返回数据库、迁移、schema、Node 版本和存储读写探测；`POST /admin/maintenance/media-check` 校验登记媒体，返回资源编号及缺失/损坏情况。仅管理员可读，不返回磁盘目录、数据库连接或密钥。内容包/完整恢复及切换步骤见 docs/backup-and-recovery.md。

媒体引用现在包含文章及闪念评论头像，删除评论时由外键级联释放；上传重试可复用同标识、同摘要的未登记文件，提交结果不确定时不会误删已登记资源。
