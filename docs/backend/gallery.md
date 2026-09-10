# 图库作品

文本长度与HTML `maxlength`及既有内容包保持相同的UTF-16计数，避免接口允许保存但导出包无法再导入。合法边界原样保留，超限写入拒绝且不截断内容。

图库保存作品的标题、说明、分类、拍摄日期、地点、设备、排序及发布状态。媒体库继续保存文件与实际像素、格式和引用；上传图片不会自动创建或发布作品。前台 `/gallery`，后台 `/admin/gallery`，新建 `/admin/gallery/new`，编辑 `/admin/gallery/:id`，器材介绍 `/admin/gallery/settings`。

## API 与可见性

同源前缀 `/api/v1`。公开 `GET /gallery` 支持 `page`（默认1）、`pageSize`（默认12，最大48）、`q` 与 `category`，排序为 `sortOrder DESC, id DESC`。省略分类参数表示全部，`category=` 表示未分类。搜索按标题、说明和地点匹配，百分号与下划线按文字处理。`GET /gallery/:id` 仅返回公开作品；`GET /gallery/metadata` 返回公开分类数量、作品/地点/分类统计与可维护器材介绍。

管理 `GET/POST /admin/gallery`、`GET/PATCH/DELETE /admin/gallery/:id` 由博主认证守卫保护。创建须传 UUID v4 `requestId`、标题和媒体编号；相同标识及内容重试返回已有作品，不同内容或已删除提交返回冲突。未知创建结果可用 `GET /admin/gallery/submissions/:requestId` 核查，删除后保留去重墓碑。更新与删除必须携带已读取的 `revision`，版本冲突返回409，不能盲目覆盖。更新只应用明确提供的字段。

状态为 `draft`（草稿）、`published`（公开）、`withdrawn`（撤回）。公开接口不返回私有状态、管理版本、提交标识、内部存储键或创建信息。`takenOn` 为可空的手工日期，仅接受真实有效的 `YYYY-MM-DD`；公开 DTO 的 `date` 缺省为空。`createdAt` 为记录创建时间，`publishedAt` 为首次公开时间，均不能由业务写入接口伪造。宽高和格式取关联媒体的实际信息，不根据上传日期推断拍摄日期，不制造 EXIF。

器材配置独立保存于 `gallery_settings`，默认空数组。管理 `GET/PATCH /admin/gallery/settings` 使用版本保护，最多12项，每项名称80字、说明300字，图标限 `lucide:camera`、`lucide:circle`、`lucide:smartphone`。介绍为博主配置，统计为公开作品聚合，来源分别维护。开发种子不改写器材或站点配置。

媒体文件沿用既有公开 URL 边界：任何持有有效媒体 URL 的访问者均可读取文件，业务草稿或撤回不意味着文件私有。作品所有状态均保留当前媒体引用，替换时只更新该作品的引用；删除作品移除其当前引用，不影响其他作品、文章历史、朋友圈等引用。图库没有独立内容修订历史；审计保留动作与字段摘要，内容恢复使用内容包或完整备份。媒体回收仍拒绝任何存活引用。

直接分享的作品通过 `GET /gallery/:id/navigation` 定位，在当前搜索、分类与分页大小下返回所在页和相邻作品及页码。列表与定位共用相同稳定排序；不在当前筛选中的公开作品仍可查看，但返回 `matched=false`，不会冒充筛选结果或切向无关作品。

## 数据与维护

`gallery-v1` 通过 `development_fixture` 记录26条归属：18件作品（16公开、1草稿、1撤回）、8张本地自然图片。默认公开列表有12+4两页，含横竖比例、多分类、排序、长短说明及可选缺省。手工拍摄日期为样本场景，不声称是素材真实 EXIF；未知地点及设备留空。源素材在 `src/backend/server-main/src/seeders/gallery-assets/`，运行时媒体沿用实际 `MEDIA_DIRECTORY`。

```sh
corepack pnpm dev:check
corepack pnpm dev:all
corepack pnpm db:dev check-data --domain gallery
corepack pnpm db:dev seed-data --dataset gallery-v1
corepack pnpm db:dev remove-data --dataset gallery-v1
```

补种和清理默认预览。实际补种加 `--apply --confirm 数据库名`，只允许本机非生产目标并先完整备份；指定清理还要求目标没有其他服务连接。重复补种不覆盖编辑、不重写日期、不复活删除内容。清理保护编辑、外部引用及其他业务的历史引用，保留归属账本与磁盘文件。不能清空当前开发库作为验证手段。

v4 内容包显式包含图库和独立器材配置，兼容 v1/v2/v3；旧版本不接受夹带新字段。导入复用预览、确认、目标变化检测、跳过/复制和事务回滚，作品以草稿迁入，不自动公开。旧包不会清空新配置；只有显式勾选配置迁入并通过版本检查才应用器材介绍。完整数据库与媒体备份保留原编号、状态、日期、配置、提交标识和样本归属；恢复轮换内容上下文，旧页面写入被拒绝。具体命令见 [备份与恢复](../backup-and-recovery.md)。

## 当前验证记录

已通过图库90请求隔离接口验证、正式迁移回放与零漂移检查，覆盖未授权拒绝、字段边界、公开过滤、真实尺寸、创建去重、并发更新、发布撤回、排序删除、跨业务媒体引用、器材版本、深链分页定位及恢复上下文。后端既有43项单测通过。图库样本、内容包和完整备份恢复另有隔离测试源码；联合验收和完整阶段结论在 [实施记录](../gallery-project-link-stage.md) 持续更新，当前不代表三个模块已经完成。
