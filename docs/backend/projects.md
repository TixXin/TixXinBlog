# 项目维护

文本长度与HTML `maxlength`及既有内容包保持相同的UTF-16计数，标题、介绍和标签均可按合法边界原样导出再导入；超限写入拒绝，不截断内容。

前台 `/projects`，后台 `/admin/projects`，新建 `/admin/projects/new`，编辑 `/admin/projects/:id`。项目页与全站项目搜索都读取真实 API；不会在失败时回退演示记录。现有卡片内容直接在列表阅读，不额外增加没有必要的公开详情页。

## 字段、状态与链接

项目使用稳定整数编号，包含标题（160字符）、介绍（5000字符）、可空封面媒体、技术标签、关联链接、排序和日期。没有封面或链接时显示明确缺省，不生成 `#` 跳转。媒体尺寸来自受管文件；封面选择或上传不会自动发布项目。

- `progress` 描述项目进展：`active` 维护中、`dev` 开发中、`archived` 已归档。
- `status` 控制站点展示：`draft` 草稿、`published` 公开、`withdrawn` 撤回。
- 项目已归档仍可公开，开发中也可保留草稿。首次公开时间由服务器记录，创建时间独立保存。
- 标签最多20个，每项名称40字符，颜色限 emerald/blue/amber/sky/rose/slate。同一项目忽略名称大小写去重并保留首项写法与颜色。
- 链接最多4个，`source/demo/docs/download` 每种用途最多一条。服务端接受完整 HTTP(S) 地址，拒绝凭据、空白、控制字符、反斜杠与占位符；规范化后长度也不能超过2048字符。保留路径大小写、必要参数及片段，不发起外站抓取。
- 本轮不采集或显示无来源的 Star/Fork，不做外部仓库自动同步。技术使用情况由博主维护标签即可完整表达。

## API 与统计

同源前缀为 `/api/v1`。`GET /projects` 支持 `q`（标题/介绍）、`progress`、`tag`、`page`、`pageSize`，默认12条、最大48条，排序为 `sortOrder DESC, id DESC`。标签筛选忽略大小写。`GET /projects/:id` 仅返回未删除的公开项目，管理版本、发布状态、请求标识和存储键不出现在公开 DTO 中。

`GET /projects/metadata` 返回公开项目总量、三种进展数量和技术标签明细。技术覆盖率＝使用该标签的公开项目数÷全部公开项目数，四舍五入为整数；同一项目对同一技术仅计一次，各技术可以重叠，总比例不需要为100%。这不表示代码语言占比。总量与标签聚合在同一数据库查询快照中计算。

管理 `GET/POST /admin/projects`、`GET/PATCH/DELETE /admin/projects/:id` 由博主认证和内容上下文保护。创建需要 UUID v4 `requestId`，相同提交与内容返回既有项目；不同内容或已删除提交返回409。`GET /admin/projects/submissions/:requestId` 可核查未知写入结果。修改、发布、撤回、排序和删除需携带当前 `revision`；冲突保留输入，需读取服务器内容后明确合并。

排序范围为±1000000，数值越大越靠前。删除项目保留提交墓碑，避免迟到重试复活。当前封面引用随编辑事务更新；其他项目、图库、文章及历史记录仍使用的文件继续受保护。媒体URL沿用公开文件边界，项目草稿或撤回不等于文件私有。

## 输入保护与主题

管理表单在事件接管与身份读取后开放；保存期间可继续输入，迟到结果不会覆盖新增内容。未保存副本按账号、项目和内容上下文保存，未知创建结果先核查原提交，版本冲突需显式合并。媒体选择器、上传队列与内容包维护共用已完成的账号/代次保护。

公开查询统一在URL中恢复；错误、初始读取、真实空态、筛选无结果分开呈现。Nexus、Aurora与Dock都提供项目概览与技术分布；Nexus右侧栏1440px起显示、Aurora1280px起显示，其他尺寸与Dock使用紧凑统计入口。

## 日常样本与维护

`project-v1` 提供18项目和3个独立封面媒体，共21条归属；16公开项目分为8维护、4开发、4归档，另保留1草稿和1撤回。公开列表12+4两页，含无封面、无链接、长短介绍、不同标签和排序。链接仅使用核对过的当前仓库或官方技术文档，不编造外部指标。素材复用受版本控制的必要图片文件，运行时仍通过媒体服务解码和登记。

```sh
corepack pnpm dev:check
corepack pnpm dev:all
corepack pnpm db:dev check-data --domain projects
corepack pnpm db:dev seed-data --dataset project-v1
corepack pnpm db:dev remove-data --dataset project-v1
```

补种和清理默认只预览，写入需明确本机非生产数据库并加 `--apply --confirm 数据库名`，操作前完整备份。指定清理还要求目标无其他连接，保护用户修改、已删除归属、跨业务引用和仍使用的媒体；不能通过重复种子复活已删除内容。完整 `all` 此阶段为156条归属，日常图片保留在 `src/backend/server-main/var/media/`。

内容包显式演进至v5，包含projects并兼容v1–v4；旧版本不接受夹带新字段。导入项目保持草稿，保留项目进展、标签、链接、排序和日期，正确映射可选封面。预览、跳过/复制、目标变化检测、事务回滚与同票据幂等规则继续有效。完整数据库及媒体恢复保留发布状态、关系、归属和请求标识，恢复后旧页面上下文不能写入同编号内容。命令见 [备份与恢复](../backup-and-recovery.md)。

本阶段接口源码 `tests/project-integration.mjs`、数据 `tests/project-fixtures-integration.ts`、维护 `tests/project-backup-integration.mjs` 和前端 `tests/e2e/project-business.spec.ts` 分别提供证据；最终结论以 [本轮实施记录](../gallery-project-link-stage.md) 为准。
