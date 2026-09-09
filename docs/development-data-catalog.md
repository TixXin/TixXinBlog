# 日常开发数据目录

本目录记录数据来源与场景覆盖。覆盖检查不能代替业务验收，也不会自动修改样本。

```sh
corepack pnpm db:dev check-data
corepack pnpm db:dev check-data --domain moments
corepack pnpm db:dev check-data --domain moments --search 不存在的关键词
```

命令复用开发启动器的配置、数据库和服务身份检查，再读取各业务表。退出0表示指定范围的场景和链路满足要求；退出非零会区分数据库断连、迁移缺失、错误服务/数据库、网关不一致和样本不足。筛选匹配数为0但底层有数据时标记 `normal-empty-filter`，不报告“数据库被清空”。筛选计数是维护视角，可能包含私有记录，不代替公开API计数。

| 域        | 前台 / 管理入口                       | 实际数据源                                       | 最小场景                                             |
| --------- | ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| posts     | `/`、`/articles/:id` / `/admin/posts` | PostgreSQL post等表                              | 超过15条公开内容、草稿、归档、近30日、图片           |
| comments  | 文章详情 / `/admin/comments`          | PostgreSQL comment及父子关系                     | 公开、待审、隐藏、回复、博主                         |
| flashes   | `/flash` / `/admin/flashes`           | PostgreSQL flash_note及互动                      | 超过15条公开内容、草稿、归档、近期、图片             |
| moments   | `/moments` / `/admin/moments`         | PostgreSQL moment及互动                          | 超过15条公开内容、草稿、归档、近期、图片             |
| media     | 公开资源URL / `/admin/media`          | PostgreSQL media_asset及独立磁盘目录             | 有活动媒体；文件完整性继续由媒体核验检查             |
| site      | 公开资料 / `/admin/site`              | PostgreSQL site_settings                         | 有默认站点名称与作者资料                             |
| guestbook | `/guestbook` / `/admin/guestbook`     | PostgreSQL guestbook_message、guestbook_reaction | 超过20条公开内容、待审、隐藏、回复、博主、置顶、近期 |

项目、图库、友链保留各域mock展示数据；书签仍在LocalStorage。命令将这些边界作为 `preservedSources` 输出，不宣称它们已经接入数据库。

原18条朋友圈及18条评论持续保留。`core-v1` 数据集通过内部 `development_fixture` 账本增量管理文章/闪念/朋友圈各18条、评论回复、待审隐藏、本地媒体和真实点赞记录，共71条归属。`guestbook-v1` 提供29条留言（26公开、2待审、1隐藏）、头像和8条回应，共38条归属。日常库七域覆盖、实际页面和维护验收已通过，详见[阶段验收](guestbook-stage-verification.md)。

```sh
corepack pnpm db:dev seed-data --dataset core-v1
corepack pnpm db:dev seed-data --dataset core-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset guestbook-v1
corepack pnpm db:dev seed-data --dataset guestbook-v1 --apply --confirm tixxin_blog
```

账本在业务记录删除后保留，不以重复seed复活被删除内容；人工编辑的记录不覆盖。事务失败时回滚数据，并只清理本次新生成且确认未登记的媒体文件。正文不添加测试标签，身份仅保留在内部账本、脚本和维护记录中。`db:dev remove-data --dataset core-v1|guestbook-v1|all` 提供定向清理预览，保留已有编辑、外部互动和媒体引用；实际执行要求服务退出、确认数据库和完整备份，详见 [开发数据库工具](development-database.md)。

`--dataset all` 按依赖顺序检查并补齐核心和留言数据集，不重设站点审核开关或用户已有置顶。留言样本的发送、审核、置顶和回应复用实际服务，不复制演示的浏览器、地区或已读信息。留言补齐前备份为 `.backups/backup-1788955517936-d22b31e0/`（本机保留）。

前端新增仅本机开发可用的 `/__dev/data-source`，返回上游服务及数据库指纹，以确认实际运行中的同源网关连接。生产环境返回404，不返回路径、连接串或凭据，也不放宽公共API代理路径。
