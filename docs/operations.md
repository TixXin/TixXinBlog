# 运营、通知与持久任务

`/admin` 汇总真实创作和互动，`/admin/notifications` 管理站内通知，`/admin/operations` 查看任务与备份结果。通知已读、业务已处理和邮件已发送分别维护，不能相互替代。

## 工作台口径

- 草稿来自文章、闪念、朋友圈、图库、项目、友链，排除软删除项；项目进展不决定是否草稿。
- 待办包括文章评论审核、朋友圈评论审核、留言审核、文章评论待回复和留言待回复。
- 待回复只统计可见游客根评论/根留言，且没有可见博主直接回复。没有可靠父回复关系的领域不生成待回复数量，没有审核状态的领域不生成审核待办。
- 最近编辑由各域限量后在数据库合并、稳定排序，直接进入实际编辑页。数量链接使用与服务端统计相同的状态过滤。
- 分区不可用与真实零值分开；其他成功数据保留并提供重试，不把服务错误显示为没有待办。

## 持久状态与执行边界

运行数据保存于 `operation_control`、`background_task` 和 `owner_notification`，不会进入内容包。HTTP 服务启动不创建任务循环、不迁移、不 seed，也不自动发送积压邮件。完整数据库备份保存这些表，但恢复后会轮换代次并暂停副作用。

任务由稳定键去重，状态、尝试次数、租约和结果持久化。邮件与备份各自互斥；有有效 running 任务时不另起同类任务。执行中的结果更新必须同时匹配任务编号、租约 token 和运行代次，旧执行器不能更新新代次。

脚本依赖后端生产构建。以下命令从仓库根执行，示例配置文件位于仓库外：

```sh
corepack pnpm --filter server-main build
node --env-file=../tixxin-private/worker.env src/backend/server-main/scripts/operations.mjs status
```

| 动作                                               | 语义                                              |
| -------------------------------------------------- | ------------------------------------------------- |
| `status`                                           | 始终只读，返回脱敏配置状态与控制版本              |
| `enable --kind mail\|backup --revision <当前版本>` | 预览启用指定通道；执行需追加 `--apply`            |
| `pause --kind mail\|backup --revision <当前版本>`  | 预览暂停指定通道；执行需追加 `--apply`            |
| `schedule`                                         | 预览按当前 UTC 时间槽登记备份；执行需 `--apply`   |
| `run-once --kind mail\|backup`                     | 预览最多执行一项到期任务；执行需 `--apply`        |
| `loop --apply`                                     | 持续执行，还要求 `OPERATIONS_WORKER_ENABLED=true` |

示例中的 `mail|backup` 表示选择其中一种，不作为字面参数传入。修改控制开关必须使用刚读取的 revision，成功后版本递增。配置不完整或环境开关未启用时拒绝 enable。启用只影响当前代次的新任务，不自动解冻原有 paused/restored/uncertain 项。

同时间槽、同代次的重复 schedule 不产生重复任务；run-once 不等于开启长期调度。持续循环仍受邮件/备份环境开关及数据库暂停约束，Ctrl+C / SIGTERM 等待当前任务退出后关闭连接。生产 Compose 的 worker profile 配置见[部署指南](deployment.md)。

## SMTP 配置

| 变量                                  | 用途                                               |
| ------------------------------------- | -------------------------------------------------- |
| `NOTIFICATION_EMAIL_ENABLED`          | 默认 false；HTTP 入队和执行器同时检查              |
| `NOTIFICATION_SMTP_HOST/PORT`         | SMTP 目标，默认端口 587                            |
| `NOTIFICATION_SMTP_SECURE`            | 默认 false，使用必需 STARTTLS；465 通常设为 true   |
| `NOTIFICATION_SMTP_USER/PASSWORD`     | 成对设置的认证资料                                 |
| `NOTIFICATION_EMAIL_FROM/TO`          | 一个发送地址与一个博主收件地址                     |
| `NOTIFICATION_SITE_URL`               | 管理入口的 HTTPS origin                            |
| `NOTIFICATION_MAIL_INTERVAL_SECONDS`  | 按尝试持久限频，默认 60 秒，重启不清零             |
| `NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN` | 默认 false，只允许明确的 loopback 捕获目标使用明文 |

配置同时注入 API 与 worker，避免只有执行器启用而事件入口未入队。收件目标不来自访客输入。邮件只包含事件类型与管理员收件箱链接，不包含正文、访客标识、密码、日志或附件，不读取文件或外部 URL 作为模板资源。

业务事务使用稳定事件键创建通知与邮件任务，Message-ID 稳定。发送前重新解析业务状态，已处理或不可用事件记为 `result.suppressed=true`：任务已处理，但没有发送邮件。只有 SMTP 明确接受指定收件目标时才记 `result.accepted=true`。

### 失败与不确定结果

SMTP 明确临时拒绝时有限退避，默认最多三次尝试；永久拒绝直接失败。以下情况可能发生在服务器已经接受邮件之后，转为 `uncertain`，不自动再次发送：

- DATA 后断线、无法确定阶段的超时或进程异常退出；
- SMTP 已接受但任务成功状态未能写入数据库；
- 邮件 running 租约失效，无法确认原执行器的发送结果。

不能仅凭客户端错误中的 `command=CONN` 判断尚未发送，稳定 Message-ID 也不提供 SMTP exactly-once 保证。管理员应先核对收件方和任务记录，再决定是否人工重试；开启通道不能作为批量重投手段。

备份失败可以通过已启用通道提醒，同一任务的重试不重复生成事件。邮件自身失败只产生站内运行异常，避免递归邮件告警。站内“已读”不会改变业务待办，也不会证明外部投递完成。

## 自动完整备份

| 变量                        | 用途                                               |
| --------------------------- | -------------------------------------------------- |
| `BACKUP_SCHEDULE_ENABLED`   | 默认 false                                         |
| `BACKUP_DIRECTORY`          | 专用绝对目录，不与恢复输出或其他用途混用           |
| `BACKUP_OWNER_ID`           | 一次生成并长期保留的 UUID v4，界定执行器归属       |
| `BACKUP_INTERVAL_MINUTES`   | 默认 1440，最小 1，按 UTC 时间槽去重               |
| `BACKUP_EXECUTION_MODE`     | 默认 docker；生产 worker 使用 native               |
| `BACKUP_POSTGRES_CONTAINER` | docker 模式使用的已核对本机 PostgreSQL 容器        |
| `BACKUP_RETENTION_DAYS`     | 默认 30，仅清理本 owner 的过期产物                 |
| `BACKUP_TRANSFER_URL/TOKEN` | 可选且成对设置；远端使用 HTTPS，token 至少 32 字符 |

docker 模式核对 loopback 数据库与容器映射。native 模式使用 PostgreSQL 16 客户端，与 API 连接同一 `DATABASE_URL`，媒体只读挂载；密码经环境提供，不拼入命令字符串，不需要宿主 Docker socket。

每次尝试创建新的 `backup-<任务UUID>-<尝试次数>` 目录。先生成[完整快照](backup-and-recovery.md)，再独立校验，最后按配置传输，分别记录 `generated`、`integrityVerified` 与传输结果。传输失败仍保留已经生成并校验的本地备份；完整性校验不等于隔离恢复通过。

`worker-owner.json` 保存 owner、任务与创建时间。保留策略只处理名称、归属标记、任务编号、期限和真实路径全部匹配的目录；遇到符号链接、未知目录或其他 owner 时保留。人工历史备份、无标记目录和其他存储根不被自动清理。远端保留策略由远端操作者另外维护。

## 备份接收器

`src/backend/server-main/scripts/backup-transfer.mjs` 提供流式接收器，不依赖外部存储服务。配置专用 `BACKUP_RECEIVER_DIRECTORY`、固定 `BACKUP_RECEIVER_OWNER_ID` 与随机 `BACKUP_RECEIVER_TOKEN`；监听主机默认 `127.0.0.1`，端口默认 8091。

```sh
node --env-file=../tixxin-private/receiver.env src/backend/server-main/scripts/backup-transfer.mjs --serve --apply
```

只有 `--serve --apply` 才启动监听。异机部署放在受控 HTTPS 代理后，将 `/backups` 转发给接收器；客户端 `BACKUP_TRANSFER_URL` 指向该完整入口。token 不放在 URL 或日志里。

发送每个数据库、媒体与清单文件时带长度和 SHA-256。接收器写入自有 staging，逐文件校验；complete 请求再验证整个备份并原子转入最终目录。发送端核对 owner、备份编号、清单摘要和总字节回执后，才报告传输完成。同编号同摘要可以重复确认，不覆盖不同字节的既有副本；错误认证、非法路径、摘要不符或缺文件均拒绝。中断留下未完成 staging，已有完整副本保持不变。

## 恢复后启用

完整恢复先校验原始全表摘要，再轮换 `operation_control.generation` 并双暂停邮件与自动备份。旧 mail queued/retry/running/paused 转 restored；backup running 标记中断失败，其余未完成备份转 restored，全部清除旧租约。

恢复后新增 `result.recoveryVerified=true` 记录显示真实恢复校验时间，它不算新备份生成成功。恢复报告保留原快照计数，并单独标记新增恢复记录。切换前停止原 API/worker，核对恢复报告和连接目标；环境开关仍为 true 也不会绕过恢复暂停。

新启用只作用于当前代次。原 restored、uncertain 或 failed 邮件必须逐项核对，不能通过启用开关自动批量重投。

## 诊断与验证

后台仅向管理员展示数据库连通、迁移/结构状态、存储探测及脱敏任务错误。媒体完整性检查返回登记资源的缺失/损坏编号，不公开磁盘路径或连接凭据。故障时先区分任务未配置、暂停、未到期、执行失败和结果不确定，保留可核查的原状态。

```sh
corepack pnpm --filter server-main test:operations
node --test scripts/release/release.test.mjs scripts/release/production-artifact-cleanup.test.mjs
```

运行回归使用隔离数据库、媒体、临时账号、本机 SMTP/TCP 捕获服务及无网络恢复容器，检查去重、竞争、退避、不确定结果、传输校验、归属保留和恢复暂停。不会使用真实收件人或异地目标。生产镜像中的原生备份、HTTPS、恢复和发布故障由[生产式集成](deployment.md#本地编排与隔离验证)补充。
