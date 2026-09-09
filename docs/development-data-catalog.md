# 日常开发数据目录

本目录记录数据来源与场景覆盖。覆盖检查不能代替业务验收，也不会自动修改样本。

```sh
corepack pnpm db:dev check-data
corepack pnpm db:dev check-data --domain moments
corepack pnpm db:dev check-data --domain moments --search 不存在的关键词
```

命令复用开发启动器的配置、数据库和服务身份检查，再读取各业务表。退出0表示指定范围的场景和链路满足要求；退出非零会区分数据库断连、迁移缺失、错误服务/数据库、网关不一致和样本不足。筛选匹配数为0但底层有数据时标记 `normal-empty-filter`，不报告“数据库被清空”。筛选计数是维护视角，可能包含私有记录，不代替公开API计数。

| 域 | 前台 / 管理入口 | 实际数据源 | 最小场景 |
| --- | --- | --- | --- |
| posts | `/`、`/articles/:id` / `/admin/posts` | PostgreSQL post等表 | 超过15条公开内容、草稿、归档、近30日、图片 |
| comments | 文章详情 / `/admin/comments` | PostgreSQL comment及父子关系 | 公开、待审、隐藏、回复、博主 |
| flashes | `/flash` / `/admin/flashes` | PostgreSQL flash_note及互动 | 超过15条公开内容、草稿、归档、近期、图片 |
| moments | `/moments` / `/admin/moments` | PostgreSQL moment及互动 | 超过15条公开内容、草稿、归档、近期、图片 |
| media | 公开资源URL / `/admin/media` | PostgreSQL media_asset及独立磁盘目录 | 有活动媒体；文件完整性继续由媒体核验检查 |
| site | 公开资料 / `/admin/site` | PostgreSQL site_settings | 有默认站点名称与作者资料 |
| guestbook | `/guestbook` / `/admin/guestbook` | 本阶段接入，当前仍为演示 | 超过20条公开内容、待审、隐藏、回复、博主、置顶、近期 |

项目、图库、友链保留各域mock展示数据；书签仍在LocalStorage。命令将这些边界作为 `preservedSources` 输出，不宣称它们已经接入数据库。

目前18条朋友圈及18条评论持续保留。已有数据仍缺少若干私有状态、近期文章和本地媒体样本；统一增量补齐与所有权记录正在本阶段实施。现有 `seed-moments`、样本规范化、定向清理及备份流程保持原用途；不因为覆盖不足自动清空数据库或覆盖人工修改。

前端新增仅本机开发可用的 `/__dev/data-source`，返回上游服务及数据库指纹，以确认实际运行中的同源网关连接。生产环境返回404，不返回路径、连接串或凭据，也不放宽公共API代理路径。
