# 图库、项目与友链交付索引

本轮按图库 → 项目 → 友链完成了真实业务、长期开发样本、内容维护、联合验收、隔离资源清理与本地提交，阶段完成率3/3（100%）。最终文字结论分别记录于[图库](gallery-stage-verification.md)、[项目](project-stage-verification.md)和[友链](link-stage-verification.md)验收文档。

## 日常使用

本机开发站点为`http://localhost:3456`，API为`http://127.0.0.1:3000`，前端通过同源`/api/v1`访问。沿用既有博主账号；本轮未更改密码、环境文件或站点配置。

| 模块 | 公开入口    | 博主管理                                                  | 实际行为                                                                 |
| ---- | ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| 图库 | `/gallery`  | `/admin/gallery`，新增`/new`，编辑`/:id`，器材`/settings` | 作品关联真实媒体；搜索、分类、分页、深链灯箱和统计一致；拍摄资料允许缺省 |
| 项目 | `/projects` | `/admin/projects`，新增`/new`，编辑`/:id`                 | 标题介绍、封面、技术标签、链接、进展与排序可维护；进展独立于发布状态     |
| 友链 | `/links`    | `/admin/links`，新增`/new`，编辑`/:id`，规则`/settings`   | 地址校验与重复反馈、可选Logo、推荐排序和上下架；本站资料复用真实配置     |

从管理列表进入“新建”，填写资料并选择或上传图片。先保存草稿，核对后发布或上架；在列表或编辑页可调整排序、撤回/下架及删除。图库的媒体必选，项目封面和友链Logo可留空。保存失败保留输入；遇版本冲突先读取服务器版本，再明确合并。未知创建结果先查询原提交，不重复创建新记录猜测结果。

规则和器材介绍是独立配置，日常初始为空，本轮未写入假器材或未实现的申请承诺。技术覆盖率、作品分类、友链推荐数和域名数均来自实际公开记录。项目无来源的Star/Fork不展示；友链“推荐”不表示已验证互链。

公开友链整理表单仅在本标签页保存和复制。本站资料复制只使用成功读取的站点设置，地址为部署配置`https://tix.xin/`。服务端不会因保存友链访问用户地址、抓取标题或探活。

## 保留的数据

日常数据库为`127.0.0.1:15433/tixxin_blog`，继续使用原PostgreSQL容器和卷。

| 数据集       | 内容     | 公开场景                                      | 独立媒体 | 归属 |
| ------------ | -------- | --------------------------------------------- | -------- | ---- |
| `gallery-v1` | 18件作品 | 16公开、1草稿、1撤回；12+4两页、分类与横竖图  | 8        | 26   |
| `project-v1` | 18个项目 | 16公开：8维护/4开发/4归档；另1草稿、1撤回     | 3        | 21   |
| `link-v1`    | 18条友链 | 16公开：4推荐、12普通、15域名；另1草稿、1下架 | 3        | 21   |

三个数据集分别重复补种，新增均为0。全库现16个媒体、177条开发归属；原核心71条、留言38条归属以及原文章、互动等内容保留。运行图片位于`src/backend/server-main/var/media/`；必要原素材与来源保存在`src/backend/server-main/src/seeders/gallery-assets/`和`link-assets/`。

补种前均完整备份并确认本机非生产目标。本轮九份日常备份在`.backups/`长期保留，其他历史备份也保持不变：

| 阶段 | 迁移前                          | 补种前                          | 重复补种前                      |
| ---- | ------------------------------- | ------------------------------- | ------------------------------- |
| 图库 | `backup-1789044253574-73e4cf4a` | `backup-1789044578014-89017e90` | `backup-1789045026660-65cdc3e2` |
| 项目 | `backup-1789048696854-d970bdff` | `backup-1789049222150-5a636bff` | `backup-1789049670007-b0e4a554` |
| 友链 | `backup-1789056092620-1fec3f37` | `backup-1789056857879-9ee8929d` | `backup-1789056866749-78bd092f` |

## 启动、检查与维护命令

```sh
corepack pnpm dev:check
corepack pnpm dev:all
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev check-data --domain gallery
corepack pnpm db:dev check-data --domain projects
corepack pnpm db:dev check-data --domain links
```

开发启动不会隐式迁移、补种或清空。数据检查区分服务不可用、错库、缺样本、编辑/删除、文件缺失和普通筛选无结果，不用Mock掩盖故障。

以下先预览。需要增量补齐时，在核对输出目标后加`--apply --confirm tixxin_blog`，工具会先完整备份；被编辑或删除的归属不会覆盖或复活。

```sh
corepack pnpm db:dev seed-data --dataset gallery-v1
corepack pnpm db:dev seed-data --dataset project-v1
corepack pnpm db:dev seed-data --dataset link-v1
corepack pnpm db:dev remove-data --dataset gallery-v1
corepack pnpm db:dev remove-data --dataset project-v1
corepack pnpm db:dev remove-data --dataset link-v1
```

指定清理还要求停止使用目标库的服务和客户端，再明确`--apply --confirm 数据库名`。它保留用户编辑、外部关联与仍被其他业务使用的媒体；不会自动终止别人的连接。本轮从未清空日常数据库。具体范围见[开发数据库](development-database.md)。

内容导出/导入使用后台`/admin/maintenance`：先导出或选择文件，选择跳过/复制及是否迁入配置，生成预览并核对三域和媒体数量，再明确执行。v6包含图库、项目、友链及配置，兼容v1–v5；全部迁入为非公开草稿，同地址友链复制也不自动上架。响应丢失时查询原票据；旧票据需要重新预览时按提示核对，不重造上传猜测结果。

```sh
corepack pnpm --filter server-main run backup:full
corepack pnpm --filter server-main run backup:verify --directory <备份绝对目录>
corepack pnpm --filter server-main run backup:restore --directory <备份绝对目录>
corepack pnpm --filter server-main migration:check
```

完整恢复新建隔离容器与卷，保留原库及媒体，不自动切换应用连接。恢复后撤销旧会话并轮换内容上下文，旧页面不能向同编号内容继续写入。外部Logo仅保留地址，受管媒体才随完整备份复制文件。详见[备份与恢复](backup-and-recovery.md)。

## 验收与剩余边界

| 验收范围           | 实际结果                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 三域接口与字段边界 | 图库90、项目79、友链118请求通过；另95请求覆盖UTF-16上限及v4/v5/v6非BMP文字往返                                              |
| 单测与静态检查     | 前端51文件224项、后端83项；Lint和类型检查通过                                                                               |
| Chromium联合回归   | 13文件267项通过                                                                                                             |
| Firefox联合回归    | 13文件267项通过                                                                                                             |
| WebKit联合回归     | 13文件267项通过；三浏览器合计801项，最新滚动前置另经三主题×三浏览器定向补验                                                 |
| 启动与生产         | Nuxt实际安装插件13项、开发进程10项、隔离冷启动/复用通过；独立生产构建、三个Docker目标和容器联调通过                         |
| 数据与维护         | 幂等补种、保留用户修改/删除、跨域媒体引用、177条归属定向清理、迁移回放与零漂移、v6及旧票据兼容、完整数据库/媒体生产恢复通过 |
| 上传依赖           | Nest依赖路径固定multer2.3.0；独立安装和构建、媒体及三个维护集成、95请求文字往返全部通过，生产依赖审计无已知漏洞             |

三浏览器联合范围包括三主题、320/390px和主要断点两侧、管理持久化与权限、媒体失败重试、未知写入与版本冲突、URL与原生历史、SSR接管、焦点、页面区域、断连恢复和减少动态效果。统计按最终有效用例计数，不把诊断重跑与历史阶段数字重复累加。发现的问题、原失败证据与修正方式见[友链及联合验收](link-stage-verification.md)。

已结束的浏览器与维护验证使用的766个受跟踪业务和测试文件，与正式验收源码副本逐字一致。生产安装同时包含Nuxt固定补丁与上传依赖修正。可重复执行的标准入口包括：

```sh
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main test --runInBand
corepack pnpm --filter server-main test:integration
corepack pnpm --filter server-main test:development-data
corepack pnpm test:nuxt-patches
corepack pnpm test:dev
corepack pnpm test:dev:integration
corepack pnpm test:e2e
corepack pnpm audit --prod --audit-level=high
```

本机原始报告为`.artifacts/link-stage/release-*-queue-summary.json`、`release-source-comparison.json`、`multer-isolated-verification-summary.json`和`docker-patched-1789067203954/result.json`；历史阶段位于`.artifacts/gallery-stage/`和`.artifacts/project-stage/`。这些是本机验收产物，远程仓库不提供对应文件。

自动写入全部使用隔离库、媒体目录和测试账号。2026-09-10T19:29Z最终32项只读审计全部通过：测试库、runner、临时媒体/环境目录、测试备份和恢复容器/卷/网络无残留；日常原启动器、服务管理进程、PostgreSQL容器及数据卷保留，全部95份历史备份清单摘要不变，本轮9份仍对应日常库。日常API已由原Nest监听器加载更新后的依赖，前后端均ready；主内容、公开统计和实际后台18条记录再次核对正常。

日常媒体目录为`D:/Projects/TixXinBlog/src/backend/server-main/var/media/`，没有被验收清理。用户原登录会话、账号、环境文件和站点配置保留，浏览器临时尺寸已恢复，管理入口保留在原标签页。最终审计只写本机报告`final-state-audit-result.json`，不会遇到未知资源就自动删除。

原始日志、截图、时序和trace只在本机`.artifacts/`或`.playwright-mcp/`，未提交到Git。工作区的产品源码、测试和本轮文档均已按批次提交；没有推送或部署。

本轮不包含真机触控、系统移动浏览器、断电恢复或外部部署网络验收。未推送、部署或对外发布内容。友链公开申请/邮件/自动探活、外部项目指标同步及书签云同步继续单独规划；书签目前仍明确使用LocalStorage。

## 本地提交

| 批次                          | 主要提交                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| 图库API、日常样本、v4与前后台 | `e9b8c39`、`4ac846e`、`3b1cf05`、`0b30e0b`、`b0526a3`                       |
| 项目API、日常样本、v5与前后台 | `1fa6d62`、`97fd816`、`0865b2b`、`45db987`、`859a557`                       |
| 友链API、v6、日常样本与前后台 | `18e7cb5`、`4c2b78a`、`05d933d`、`2ef16d2`                                  |
| 字段与共享行为回归            | `9a6cd8d`、`9a67b49`、`82066e9`、`d8e4768`、`9ea44e3`、`a0bc2cc`、`0060457` |
| 上传依赖与使用文档            | `1bd59df`、`488f200`                                                        |

各提交均使用中文说明和变更原因，未添加AI署名。完整顺序可通过`git log --oneline 17d0d16..HEAD`查看；最后一批提交同步本交付索引、阶段验收、能力清单和前后端Todo。
