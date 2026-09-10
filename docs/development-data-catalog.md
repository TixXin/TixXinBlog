# 日常开发数据目录

本目录记录数据来源与场景覆盖。覆盖检查不能代替业务验收，也不会自动修改样本。

```sh
corepack pnpm db:dev check-data
corepack pnpm db:dev check-data --domain moments
corepack pnpm db:dev check-data --domain moments --search 不存在的关键词
corepack pnpm db:dev check-data --domain gallery
```

命令复用开发启动器的配置、数据库和服务身份检查，再读取各业务表。退出0表示指定范围的场景和链路满足要求；退出非零会区分数据库断连、迁移缺失、错误服务/数据库、网关不一致和样本不足。筛选匹配数为0但底层有数据时标记 `normal-empty-filter`，不报告“数据库被清空”。筛选计数是维护视角，可能包含私有记录，不代替公开API计数。

| 域        | 前台 / 管理入口                       | 实际数据源                                                           | 最小场景                                                                                   |
| --------- | ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| posts     | `/`、`/articles/:id` / `/admin/posts` | PostgreSQL post等表                                                  | 超过15条公开内容、草稿、归档、近30日、图片                                                 |
| comments  | 文章详情 / `/admin/comments`          | PostgreSQL comment及父子关系                                         | 公开、待审、隐藏、回复、博主                                                               |
| flashes   | `/flash` / `/admin/flashes`           | PostgreSQL flash_note及互动                                          | 超过15条公开内容、草稿、归档、近期、图片                                                   |
| moments   | `/moments` / `/admin/moments`         | PostgreSQL moment及互动                                              | 超过15条公开内容、草稿、归档、近期、图片                                                   |
| media     | 公开资源URL / `/admin/media`          | PostgreSQL media_asset及独立磁盘目录                                 | 有活动媒体；文件完整性继续由媒体核验检查                                                   |
| site      | 公开资料 / `/admin/site`              | PostgreSQL site_settings                                             | 有默认站点名称与作者资料                                                                   |
| guestbook | `/guestbook` / `/admin/guestbook`     | PostgreSQL guestbook_message、guestbook_reaction                     | 超过20条公开内容、待审、隐藏、回复、博主、置顶、近期                                       |
| gallery   | `/gallery` / `/admin/gallery`         | PostgreSQL gallery_photo、media_asset、media_reference，本地媒体文件 | 超过12条公开作品、草稿、撤回、多分类、排序、长短说明、可选缺省、横竖图、近期及历史拍摄日期 |

项目、友链保留各域mock展示数据；书签仍在LocalStorage。命令将这些边界作为 `preservedSources` 输出，不宣称它们已经接入数据库。

原18条朋友圈及18条评论持续保留。`core-v1` 数据集通过内部 `development_fixture` 账本增量管理文章/闪念/朋友圈各18条、评论回复、待审隐藏、本地媒体和真实点赞记录，共71条归属。`guestbook-v1` 提供29条留言（26公开、2待审、1隐藏）、头像和8条回应，共38条归属。日常库七域覆盖、实际页面和维护验收已通过，详见[阶段验收](guestbook-stage-verification.md)。

```sh
corepack pnpm db:dev seed-data --dataset core-v1
corepack pnpm db:dev seed-data --dataset core-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset guestbook-v1
corepack pnpm db:dev seed-data --dataset guestbook-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset gallery-v1
corepack pnpm db:dev seed-data --dataset gallery-v1 --apply --confirm tixxin_blog
```

账本在业务记录删除后保留，不以重复seed复活被删除内容；人工编辑的记录不覆盖。事务失败时回滚数据，并只清理本次新生成且确认未登记的媒体文件。正文不添加测试标签，身份仅保留在内部账本、脚本和维护记录中。`db:dev remove-data --dataset core-v1|guestbook-v1|gallery-v1|all` 提供定向清理预览，保留已有编辑、外部互动和媒体引用；实际执行要求服务退出、确认数据库和完整备份，详见 [开发数据库工具](development-database.md)。

`--dataset all` 按依赖顺序检查并补齐核心、留言和图库数据集，不重设站点审核开关、用户已有置顶或图库器材配置。留言样本的发送、审核、置顶和回应复用实际服务，不复制演示的浏览器、地区或已读信息。留言补齐前备份为 `.backups/backup-1788955517936-d22b31e0/`（本机保留）。

`gallery-v1` 包含18件作品（16公开、1草稿、1撤回）和8张不同自然照片，共26条归属；完整 `all` 合计135条归属。公开作品以默认12条分页时有两页，覆盖风景、城市、餐桌、人像及未分类、非零排序、长说明、空说明和缺省拍摄日期。8张照片含5横3竖，媒体服务实际读取尺寸与格式，18件作品复用这些媒体，未虚造统计。来源与许可见 [图库素材说明](../src/backend/server-main/src/seeders/gallery-assets/README.md)。手工拍摄日期仅用于近期/历史场景，不宣称是素材 EXIF；未知的地点和设备保持为空，首次补种后的日期不随重复执行变化。器材配置保持用户原值，初始空配置不会由种子写入虚假器材。

图库数据检查同时返回 `ownership`、`media` 与具体 `repair`：`not-seeded` 表示没有登记此版本；`edited-fixtures` 和 `deleted-fixtures` 分别保留已编辑、已删除归属清单；场景缺口且归属发生变化时标记 `changed-fixtures`，提醒通过后台核对或从完整备份恢复，不用重复seed覆盖或复活。活动作品的关联媒体逐张核对磁盘文件，缺文件时仍保留实际作品数量并列出不可用媒体编号。样本日期超过近期范围时应手工维护作品或追加新版本，不能擅自改写已有拍摄日期。

隔离回归 `corepack pnpm --filter server-main exec tsx tests/gallery-fixtures-integration.ts` 验证26条归属、公开分页/统计、八张实际可访问图片与像素、重复不变、人工编辑保留、删除不复活、缺文件诊断、共用媒体和文章历史引用保护，以及带备份的指定清理。测试先要求后端已构建；日常库补种与页面验收由图库阶段交付记录单独证明，隔离通过不代表日常库已经补齐。

2026-09-10 已在 `127.0.0.1:15433/tixxin_blog` 增量写入图库26条归属；迁移前完整备份 `.backups/backup-1789044253574-73e4cf4a/`、补种前完整备份 `.backups/backup-1789044578014-89017e90/` 均在本机长期保留。12:51 UTC 实际 `check-data --domain gallery` 返回数据库/API/同源网关一致、18件作品（16公开、1草稿、1撤回）、8/8媒体可读、18条作品媒体引用、26条原始归属且无编辑/删除，API `http://127.0.0.1:3000`、前端 `http://localhost:3456` 均就绪。图片通过现有 `MEDIA_DIRECTORY` 保留，种子原图仍在仓库素材目录；后台和页面完整交互验收另外记录，数据检查不代替浏览器验收。

数据工具隔离测试现在显式传入每次独立的 `.artifacts/database-fixtures/run-*/` 备份根目录。完整备份与失败半备份都留在此范围内，`fixture.close()` 核对真实绝对父目录后清理；正式数据命令默认仍写入 `.backups/` 并长期保留。回归不会因使用隔离目录而跳过备份步骤。

前端新增仅本机开发可用的 `/__dev/data-source`，返回上游服务及数据库指纹，以确认实际运行中的同源网关连接。生产环境返回404，不返回路径、连接串或凭据，也不放宽公共API代理路径。
