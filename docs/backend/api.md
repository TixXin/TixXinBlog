# TixXinBlog 后端 API 文档

本文记录 TixXinBlog 后端服务对外暴露的全部 HTTP 与 WebSocket 接口契约。所有响应字段严格与 `src/frontend/web-blog/app/features/<domain>/types.ts` 对齐，实现 **"前端组件零改动，仅切换数据源"** 的迁移目标。

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

### 7.8 Gallery（画廊）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/gallery/photos` | 无 | 照片列表 |
| GET | `/gallery/categories` | 无 | 分类列表 |
| GET | `/gallery/stats` | 无 | 画廊统计 |
| GET | `/gallery/gears` | 无 | 器材列表 |
| POST | `/admin/gallery/photos` | [Admin] | 新增照片 |
| PATCH | `/admin/gallery/photos/:id` | [Admin] | 更新照片 |
| DELETE | `/admin/gallery/photos/:id` | [Admin] | 删除照片 |

`GET /gallery/photos` 查询参数：`category`（可为 `all`）、`page`、`pageSize`、`search`。

响应 `data.items[]` 对齐 `PhotoItem`：

```json
{
  "id": 1,
  "title": "贡嘎日出",
  "description": "...",
  "src": "https://.../thumb-800.webp",
  "srcLarge": "https://.../large-1920.webp",
  "category": "landscape",
  "date": "2024-03-01T00:00:00.000Z",
  "location": "贡嘎山"
}
```

`GET /gallery/categories` 响应 `data.items[]` 对齐 `GalleryCategory`。

`GET /gallery/stats` 响应 `data.items[]` 对齐 `GalleryStat`。

`GET /gallery/gears` 响应 `data.items[]` 对齐 `GearItem`。

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

### 7.10 Project（项目）

| Method | Path | 鉴权 | 摘要 |
|--------|------|------|------|
| GET | `/projects` | 无 | 项目列表 |
| GET | `/projects/stats` | 无 | 项目统计 |
| GET | `/projects/tech-stack` | 无 | 技术栈占比 |
| POST | `/admin/projects` | [Admin] | 创建项目 |
| PATCH | `/admin/projects/:id` | [Admin] | 更新项目 |
| DELETE | `/admin/projects/:id` | [Admin] | 删除项目 |
| POST | `/admin/projects/:id/sync-stars` | [Admin] | 触发 GitHub 同步 |

`GET /projects` 响应 `data.items[]` 对齐 `ProjectItem`：

```json
{
  "title": "VueDash",
  "description": "基于 Vue3 的管理后台模板",
  "cover": "https://...",
  "status": "active",
  "stars": "1.2k",
  "tags": [{ "label": "Vue3", "color": "emerald" }],
  "links": [{ "icon": "lucide:github", "label": "源代码", "href": "..." }]
}
```

`GET /projects/stats` 响应 `data.items[]` 对齐 `ProjectStats`。

`GET /projects/tech-stack` 响应 `data.items[]` 对齐 `TechStackItem`。

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
