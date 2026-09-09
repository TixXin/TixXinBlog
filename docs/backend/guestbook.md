# 留言板数据与接口

留言使用独立 `guestbook_message` 和 `guestbook_reaction`，整数编号沿用前台原模型。消息状态为 `published/pending/hidden`；不存储或返回虚构的已读、在线、地区信息。所有接口位于 `/api/v1` 下。

| 入口 | 行为 |
| --- | --- |
| `GET /guestbook` | 公开和当前访客自己的待审留言；`q`、UTC `date`、`pageSize`（默认20，最大50）、`before` |
| `GET /guestbook/metadata` | 公开留言数、参与者、近期/今日数量、公开置顶、活跃成员及代码配置的交流规则 |
| `GET /guestbook/:id` | 单条可见留言及经过可见性处理的引用 |
| `POST /guestbook` | 访客提交：`requestId`、`content`、`author`，可选 `avatar`、`replyToId` |
| `PUT /guestbook/:id/reactions` | 提交目标 `{emoji, reacted}`；按访客、留言、回应种类去重 |
| `GET /admin/guestbook` | 管理分页：`page/pageSize/q/date/status`，含待审和隐藏 |
| `GET /admin/guestbook/:id` | 管理详情、版本和引用状态 |
| `POST /admin/guestbook` | 博主发送/回复：`requestId/content/replyToId`，身份来自认证和站点配置 |
| `PATCH /admin/guestbook/:id` | 提交最新 `revision`，修改 `status/isPinned` |
| `DELETE /admin/guestbook/:id?revision=N` | 软删除、释放媒体与回应；保留原提交记录防重建 |

正文最多500字符，访客昵称32字符。输入使用现有校验、访客哈希、限流和媒体URL规则；管理入口采用 `AdminAuthGuard`，审计只记录动作、字段和结果，不复制正文或凭据。

创建的唯一约束为访客身份与提交标识。相同正文和标识重试返回原消息，不同正文或已隐藏/删除提交返回冲突。管理修改使用版本比较；一条新留言置顶时，旧置顶被取消并递增版本。数据库部分唯一索引保证只有一条未删除的公开置顶。

公开列表按创建时间、编号倒序分页，游标包含边界和筛选指纹。相同时间戳依靠编号稳定排序；翻页期间新增留言不改变此前游标指向的较旧消息。显示模式由前端决定，后台分页另用页码。

回复只引用已公开留言。父留言后来隐藏或删除时，公开回复本身保留，引用正文及作者移除并返回 `replyUnavailable`，不通过引用泄露私有内容；博主管理详情可核对原引用。回应计数来自实际明细，重复设置同一目标不反复切换。

头像使用已有媒体引用机制，资源管理可定位 `/admin/guestbook?focus=编号`；软删除主动释放引用，物理删除由外键级联保护。交流规则是该域的代码配置，不冒充实时数据；成员数量及活跃列表只计算公开留言，不返回访客哈希。

88请求隔离接口集成验证了权限、恶意字段拒绝、并发提交、隐藏引用、审核、单一置顶与版本、回应、同时间戳游标、新增期间翻页、媒体引用及审计。前台与后台已接入真实数据，日常库保留29条留言及8条回应；具体交付验收仍按 `docs/guestbook-stage.md` 跟踪。

内容包升级为v3并兼容v1/v2，留言导入为待审/隐藏/已删除状态，重建回复编号和有效头像引用；完整备份保留原始审核、互动与去重记录。公开写入和管理写入均检查恢复后的内容上下文。规则与验证见 `docs/backup-and-recovery.md`。
