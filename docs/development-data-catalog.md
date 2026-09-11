# 日常开发数据目录

本目录记录数据来源与场景覆盖。覆盖检查不能代替业务验收，也不会自动修改样本。

## 可持续运营阶段增量（进行中）

`editorial-v1` 独立登记3篇技术文章与1个TixXinBlog项目候选，全部草稿、无新增媒体，事实来自仓库；区别于虚构场景样本，不自动迁入生产。使用 `db:dev seed-data --dataset editorial-v1` 预览，显式补齐/定向清理沿用确认、完整备份、编辑/删除及跨域引用保护。资料来源见 [内容定位](personal-content.md)。

2026-09-11 已在 `127.0.0.1:15433/tixxin_blog` 实际补齐4条归属：文章总数72、项目19，原有媒体16及其他样本保留，归属185。迁移前完整备份 `.backups/backup-1789113275418-cf49888d/`；资料整理前 `.backups/backup-1789113342806-50445aca/`；补种前 `.backups/backup-1789113345125-f8778ef5/`，均为本机长期保留位置。资料整理仅修改未编辑版本0初始资料，产生版本1并保留旧历史；采用已确认称呼tixxin，收起未确认职位、社交地址和肖像，关于页使用本轮内容定位。

隔离 `tests/editorial-fixtures-integration.ts` 已验证默认预览、错误目标拒绝、真实完整备份、其他配置保留、4条全草稿归属、重复无新增、编辑保护与删除不复活、零漂移。日常页面及浏览器验收继续记录于 [阶段跟踪](sustainable-blog-stage.md)，数据结果不代替整项完成。

图库外链扩展：`gallery-external` 域对应独立 `gallery-external-v1` 数据集，提供4条外链作品（2公开、1草稿、1撤回），只保存地址和自然内容，不抓取远程图片。使用 `corepack pnpm db:dev check-data --domain gallery-external` 检查；通过 `seed-data --dataset gallery-external-v1` 预览补齐，核对本机目标后加 `--apply --confirm tixxin_blog`。同名 `remove-data` 仍遵循备份、停服务、编辑保护和删除不复活规则。原图库26条归属保留，全站样本归属现181条；本轮记录见 [图库外链与后台验收](gallery-external-admin-verification.md)。

```sh
corepack pnpm db:dev check-data
corepack pnpm db:dev check-data --domain moments
corepack pnpm db:dev check-data --domain moments --search 不存在的关键词
corepack pnpm db:dev check-data --domain gallery
corepack pnpm db:dev check-data --domain projects
corepack pnpm db:dev check-data --domain links
```

命令复用开发启动器的配置、数据库和服务身份检查，再读取各业务表。退出0表示指定范围的场景和链路满足要求；退出非零会区分数据库断连、迁移缺失、错误服务/数据库、网关不一致和样本不足。筛选匹配数为0但底层有数据时标记 `normal-empty-filter`，不报告“数据库被清空”。筛选计数是维护视角，可能包含私有记录，不代替公开API计数。

| 域        | 前台 / 管理入口                       | 实际数据源                                                             | 最小场景                                                                                   |
| --------- | ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| posts     | `/`、`/articles/:id` / `/admin/posts` | PostgreSQL post等表                                                    | 超过15条公开内容、草稿、归档、近30日、图片                                                 |
| comments  | 文章详情 / `/admin/comments`          | PostgreSQL comment及父子关系                                           | 公开、待审、隐藏、回复、博主                                                               |
| flashes   | `/flash` / `/admin/flashes`           | PostgreSQL flash_note及互动                                            | 超过15条公开内容、草稿、归档、近期、图片                                                   |
| moments   | `/moments` / `/admin/moments`         | PostgreSQL moment及互动                                                | 超过15条公开内容、草稿、归档、近期、图片                                                   |
| media     | 公开资源URL / `/admin/media`          | PostgreSQL media_asset及独立磁盘目录                                   | 有活动媒体；文件完整性继续由媒体核验检查                                                   |
| site      | 公开资料 / `/admin/site`              | PostgreSQL site_settings                                               | 有默认站点名称与作者资料                                                                   |
| guestbook | `/guestbook` / `/admin/guestbook`     | PostgreSQL guestbook_message、guestbook_reaction                       | 超过20条公开内容、待审、隐藏、回复、博主、置顶、近期                                       |
| gallery   | `/gallery` / `/admin/gallery`         | PostgreSQL gallery_photo、media_asset、media_reference，本地媒体文件   | 超过12条公开作品、草稿、撤回、多分类、排序、长短说明、可选缺省、横竖图、近期及历史拍摄日期 |
| projects  | `/projects` / `/admin/projects`       | PostgreSQL project、media_asset、media_reference，本地封面文件         | 超过12条公开项目、独立项目进展、草稿撤回、多标签、排序、长短说明、有无封面、有无链接       |
| links     | `/links` / `/admin/links`             | PostgreSQL friend_link、link_settings、媒体与引用，明确的外部HTTPS标志 | 超过12条公开友链、草稿撤回、推荐排序、长短介绍、无图/受管/外部标志、同域不同路径           |

书签仍在LocalStorage。命令通过 `preservedSources` 准确输出这一边界，不宣称书签已经接入数据库。

原18条朋友圈及18条评论持续保留。`core-v1` 数据集通过内部 `development_fixture` 账本增量管理文章/闪念/朋友圈各18条、评论回复、待审隐藏、本地媒体和真实点赞记录，共71条归属。`guestbook-v1` 提供29条留言（26公开、2待审、1隐藏）、头像和8条回应，共38条归属。日常库七域覆盖、实际页面和维护验收已通过，详见[阶段验收](guestbook-stage-verification.md)。

```sh
corepack pnpm db:dev seed-data --dataset core-v1
corepack pnpm db:dev seed-data --dataset core-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset guestbook-v1
corepack pnpm db:dev seed-data --dataset guestbook-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset gallery-v1
corepack pnpm db:dev seed-data --dataset gallery-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset project-v1
corepack pnpm db:dev seed-data --dataset project-v1 --apply --confirm tixxin_blog
corepack pnpm db:dev seed-data --dataset link-v1
corepack pnpm db:dev seed-data --dataset link-v1 --apply --confirm tixxin_blog
```

账本在业务记录删除后保留，不以重复seed复活被删除内容；人工编辑的记录不覆盖。事务失败时回滚数据，并只清理本次新生成且确认未登记的媒体文件。正文不添加测试标签，身份仅保留在内部账本、脚本和维护记录中。`db:dev remove-data --dataset core-v1|guestbook-v1|gallery-v1|project-v1|link-v1|all` 提供定向清理预览，保留已有编辑、外部互动和媒体引用；实际执行要求服务退出、确认数据库和完整备份，详见 [开发数据库工具](development-database.md)。

`--dataset all` 按依赖顺序检查并补齐核心、留言、图库、项目和友链数据集，不重设站点审核开关、用户已有置顶、图库器材或友链规则配置。留言样本的发送、审核、置顶和回应复用实际服务，不复制演示的浏览器、地区或已读信息。留言补齐前备份为 `.backups/backup-1788955517936-d22b31e0/`（本机保留）。

`gallery-v1` 包含18件作品（16公开、1草稿、1撤回）和8张不同自然照片，共26条归属。公开作品以默认12条分页时有两页，覆盖风景、城市、餐桌、人像及未分类、非零排序、长说明、空说明和缺省拍摄日期。8张照片含5横3竖，媒体服务实际读取尺寸与格式，18件作品复用这些媒体，未虚造统计。来源与许可见 [图库素材说明](../src/backend/server-main/src/seeders/gallery-assets/README.md)。手工拍摄日期仅用于近期/历史场景，不宣称是素材 EXIF；未知的地点和设备保持为空，首次补种后的日期不随重复执行变化。器材配置保持用户原值，初始空配置不会由种子写入虚假器材。

图库数据检查同时返回 `ownership`、`media` 与具体 `repair`：`not-seeded` 表示没有登记此版本；`edited-fixtures` 和 `deleted-fixtures` 分别保留已编辑、已删除归属清单；场景缺口且归属发生变化时标记 `changed-fixtures`，提醒通过后台核对或从完整备份恢复，不用重复seed覆盖或复活。活动作品的关联媒体逐张核对磁盘文件，缺文件时仍保留实际作品数量并列出不可用媒体编号。样本日期超过近期范围时应手工维护作品或追加新版本，不能擅自改写已有拍摄日期。

隔离回归 `corepack pnpm --filter server-main exec tsx tests/gallery-fixtures-integration.ts` 验证26条归属、公开分页/统计、八张实际可访问图片与像素、重复不变、人工编辑保留、删除不复活、缺文件诊断、共用媒体和文章历史引用保护，以及带备份的指定清理。测试先要求后端已构建；日常库补种与页面验收由图库阶段交付记录单独证明，隔离通过不代表日常库已经补齐。

2026-09-10 已在 `127.0.0.1:15433/tixxin_blog` 增量写入图库26条归属；迁移前完整备份 `.backups/backup-1789044253574-73e4cf4a/`、补种前完整备份 `.backups/backup-1789044578014-89017e90/` 均在本机长期保留。12:51 UTC 实际 `check-data --domain gallery` 返回数据库/API/同源网关一致、18件作品（16公开、1草稿、1撤回）、8/8媒体可读、18条作品媒体引用、26条原始归属且无编辑/删除，API `http://127.0.0.1:3000`、前端 `http://localhost:3456` 均就绪。图片通过现有 `MEDIA_DIRECTORY` 保留，种子原图仍在仓库素材目录；后台和页面完整交互验收另外记录，数据检查不代替浏览器验收。

`project-v1` 提供18个项目（16公开、1草稿、1撤回）及3张自有封面，共21条归属。公开项目中8个维护中、4个开发中、4个已归档，项目进展不控制发布状态；另有开发中的草稿和已归档的撤回项目。全组10件带封面、8件无封面，公开部分覆盖11种技术标签、空标签、空链接、空说明、长说明和相同排序值的稳定次级排序；默认12条分页后还有4条公开项目。

项目封面复用仓库已有的 `ridge.webp`、`mist.webp`、`skyline.webp` 素材文件，经正常媒体上传服务重新解码；媒体编号及账本独立属于 `project-v1`，不要求图库已经补种，也不复制或覆盖图库归属。运行图片仍在已配置的 `MEDIA_DIRECTORY`。更换封面和指定清理同时核对直接媒体外键及统一引用，图库、文章或其他数据集仍在使用的项目样本媒体会保留。`check-data --domain projects` 检查项目进展、有无封面、链接、标签、排序、归属编辑/删除、磁盘文件与封面引用数量，正常搜索无结果不会报告数据库清空。

所有非空样本链接使用有效 HTTPS 地址；`TixXinBlog` 的源代码链接与当前 Git origin 及 [公开仓库](https://github.com/TixXin/TixXinBlog) 一致。其他项目仅提供关联技术的文档入口：[Vue](https://vuejs.org/guide/introduction.html)、[TypeScript](https://www.typescriptlang.org/docs/)、[NestJS](https://docs.nestjs.com/)、[MDN Web API](https://developer.mozilla.org/en-US/docs/Web/API)、[PostgreSQL](https://www.postgresql.org/docs/current/)、[Playwright](https://playwright.dev/docs/intro)，不冒充这些技术的作者仓库或项目演示地址。上述来源于2026-09-10访问核对；种子本身不访问外站，不保存 Star/Fork 或其他外部计数。

隔离验证 `corepack pnpm --filter server-main exec tsx tests/project-fixtures-integration.ts` 覆盖独立补种、事务失败补偿、21归属、12+4分页、实际封面解码与SHA、每个技术标签的公开使用计数/覆盖率、大小写筛选、重复不变、编辑保留、删除不复活、缺文件诊断、图库数据集跨业务引用保护、备份与指定清理。浏览器 runner 使用 `project-fixture.mjs` 复用同一版本，仅接受随机隔离数据库和系统临时媒体目录。

2026-09-10 已在日常目标 `127.0.0.1:15433/tixxin_blog` 增量补齐 `project-v1`：18项目（16公开、1草稿、1撤回）、3媒体、21归属，无缺失项。图片长期保留在 `src/backend/server-main/var/media/`，源素材保留在 `src/backend/server-main/src/seeders/gallery-assets/`；归属保留在该库 `development_fixture`。迁移前备份 `.backups/backup-1789048696854-d970bdff/`、补种前备份 `.backups/backup-1789049222150-5a636bff/` 均在本机保留。前台/后台完整交互验收由项目阶段记录提供，数据补齐不代替浏览器验收。

`link-v1` 包含18条友链（16公开、1草稿、1撤回）与3个独立受管标志，共21条归属。公开记录有4条推荐、12条普通，覆盖不同排序和15个实际域名；TypeScript 官网与手册保持同域不同路径，不能按域名误判为重复。16条公开记录中3条使用媒体库标志、1条使用明确外部HTTPS标志、12条无图。公开分页为12+4，另有推荐草稿和普通撤回记录，统计不会混入非公开内容。

受管图片为 Vue.js、TypeScript、Vite 官方标志，来源、署名、许可及实际尺寸见 [友链素材说明](../src/backend/server-main/src/seeders/link-assets/README.md)。源文件位于该目录，运行文件写入现有 `MEDIA_DIRECTORY`，每个媒体编号及归属独立属于 `link-v1`。Vue 中文站使用官方PNG的HTTPS地址；不拿无关人像冒充站长，不生成“已验证互链”或探活标记。18个站点源与图片来源在2026-09-10维护过程中显式访问核对；本机原始核对结果为 `.artifacts/link-stage/link-sources-check.json`，不纳入Git。种子、内容写入和 `check-data` 均不会抓取用户提交的URL；外部标志是否能在浏览器加载由实际页面验收另行确认。

友链检查输出公开/草稿/撤回、推荐/普通、实际域名、受管/外部/无图、排序、长介绍、媒体引用和本地文件状态，并沿用 `ownership` 中的编辑/删除诊断。重复种子保留所有已登记内容，不覆盖人工编辑或复活删除；如果首次补种时同URL已经属于用户内容，报告 `url-already-present`，保留该行及其归属，不接管或覆盖，并继续补齐其他地址。此时需要通过后台核对已有条目及缺少场景，而不是删除用户内容或清空账本。

`development-datasets.ts` 统一登记每个数据集，预期归属数从各域样本定义计算并汇总；当前五组完整 `all` 为177条（71核心+38留言+26图库+21项目+21友链），工具同时输出分组预期及实际创建/保留/不可用清单。`remove-data --dataset link-v1` 仍先预览、核对目标、完整备份并要求其他连接退出，保留用户编辑及图库/项目等业务正在使用的标志；内容清空会删除友链业务记录，但保留友链规则、账号、媒体、账本和审计。

隔离数据测试 `corepack pnpm --filter server-main exec tsx tests/link-fixtures-integration.ts` 与独立进程的 `tests/link-fixtures-existing-url.ts` 覆盖真实分页推荐统计、设置不变、图片解码与SHA、默认端口/域名规范化重复、路径大小写/尾斜杠/查询顺序/fragment差异、无外部抓取、失败回滚、重复幂等、编辑删除保护、用户已有同URL不接管、跨图库项目媒体引用及指定清理。浏览器启动器通过 `link-fixture.mjs` 复用同一版本，仅接受本次随机隔离数据库和临时媒体目录。

2026-09-10 已在日常目标 `127.0.0.1:15433/tixxin_blog` 补齐 `link-v1`：18条友链、3个受管标志、21条归属；重复补种 created=[]、retained=21、unavailable=[]。全库16媒体、177条样本归属，图库和项目各18条继续保留。友链运行图片在 `src/backend/server-main/var/media/`，源标志在 `src/backend/server-main/src/seeders/link-assets/`。迁移前完整备份 `.backups/backup-1789056092620-1fec3f37/`、补种前 `.backups/backup-1789056857879-9ee8929d/`、重复核对前 `.backups/backup-1789056866749-78bd092f/` 均在本机保留。前后台完整交互验收另行记录，数据数量不代替浏览器验收。

数据工具隔离测试现在显式传入每次独立的 `.artifacts/database-fixtures/run-*/` 备份根目录。完整备份与失败半备份都留在此范围内，`fixture.close()` 核对真实绝对父目录后清理；正式数据命令默认仍写入 `.backups/` 并长期保留。测试应用每进程只允许创建一次，第二次会在读取配置和建库前明确拒绝；多个场景应拆成独立测试进程，防止 Nest 模块缓存沿用第一份数据库配置。回归不会因使用隔离目录而跳过备份步骤。

前端新增仅本机开发可用的 `/__dev/data-source`，返回上游服务及数据库指纹，以确认实际运行中的同源网关连接。生产环境返回404，不返回路径、连接串或凭据，也不放宽公共API代理路径。
