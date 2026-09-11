# 运行任务、完整备份与邮件通道

后台运行状态与通知使用 `operation_control`、`background_task`、`owner_notification` 持久表；它们属于运行数据，不进入公开内容包。HTTP 服务启动不创建循环、不自动迁移、不 seed、不发送积压邮件。完整数据库备份仍包含这些运行表，但恢复后会执行下述暂停规则。

## 开关与执行入口

运行脚本依赖已构建的后端 `dist/` 与 `scripts/`。用现有构建命令构建后，在后端目录执行。生产配置可通过 Node 24 的 `--env-file` 显式注入仓库外文件；不需要改日常 `.env`：

```powershell
node --env-file=D:/PrivateConfig/blog-worker.env scripts/operations.mjs status
node --env-file=D:/PrivateConfig/blog-worker.env scripts/operations.mjs enable --kind backup --revision 0
```

`status` 只读，其他动作没有 `--apply` 只输出预览。`enable` / `pause` 需要 `--revision` 匹配当前控制版本，成功后版本加一。先核对具体配置、目标和授权，再在前述命令末尾加 `--apply`。邮件使用 `--kind mail`，备份使用 `--kind backup`。启用只允许新事件与当前代次的新任务，不自动解冻已有 `paused/restored/uncertain` 任务。

```powershell
node scripts/operations.mjs schedule --apply
node scripts/operations.mjs run-once --kind backup --apply
node scripts/operations.mjs run-once --kind mail --apply
```

`schedule` 按当前周期向数据库登记一次备份任务；同周期、同代次的并发调用只有一个任务。`run-once` 最多执行一项已到期任务。两种任务各自互斥，状态通过独立数据库连接提交；同类任务有有效 running 状态时不另起新任务。执行期间有租约心跳，更新结果必须同时匹配任务编号、租约 token 和运行代次。

只有同时设置 `OPERATIONS_WORKER_ENABLED=true` 并明确执行 `node scripts/operations.mjs loop --apply` 才持续检查任务。循环每秒检查已到期事项；仍受各通道环境开关及数据库暂停控制约束。Ctrl+C / SIGTERM 等待当前任务退出后关闭连接。后台任务、操作系统计划任务或长期容器启用需要对应授权；本轮隔离验收不启用用户机器上的长期调度。

## 邮件配置及边界

| 变量                                  | 用途与缺省                                               |
| ------------------------------------- | -------------------------------------------------------- |
| `NOTIFICATION_EMAIL_ENABLED`          | 默认 `false`；HTTP 事件入队和执行器均检查                |
| `NOTIFICATION_SMTP_HOST/PORT`         | 显式 SMTP 目标，端口默认 587                             |
| `NOTIFICATION_SMTP_SECURE`            | 默认 `false`，587 使用必需 STARTTLS；465 通常设置 `true` |
| `NOTIFICATION_SMTP_USER/PASSWORD`     | 成对配置的认证资料，只从环境读取                         |
| `NOTIFICATION_EMAIL_FROM/TO`          | 一个发送地址与一个博主接收地址，不接收访客自填收件目标   |
| `NOTIFICATION_SITE_URL`               | HTTPS origin；隔离测试允许 loopback HTTP origin          |
| `NOTIFICATION_MAIL_INTERVAL_SECONDS`  | 默认 60，最小 1；按尝试持久限频，重启不清零              |
| `NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN` | 默认 `false`；仅显式本机捕获目标可开明文，不允许远端     |

缺配置显示未启用/未配置，不报告成功。邮件仅含事件类型和管理员收件箱链接，不含正文、访客标识、密码或日志。发送前重新解析业务状态，已处理/不可用事件记为 `result.suppressed=true`；这是任务处理完成，**没有发送邮件**。SMTP 明确接受唯一收件目标后才记 `result.accepted=true`。标记通知已读与审核/回复处理状态独立。

同一业务事务通过稳定事件键入队，邮件任务使用稳定 Message-ID。SMTP 450 等明确临时拒绝采用有限退避（30、60、120 秒，最高 1 小时）；默认最多 3 次尝试。550 等永久拒绝直接失败。DATA 后连接中断、未知阶段超时和进程异常退出可能发生在服务器已接受之后，因此转为 `uncertain`，不自动再次发送。实际 Nodemailer 在 DATA 后断线也可能标记 `command=CONN`，不能仅靠此字段认定尚未发送。失效的 mail running 租约同样转不确定，需人工核对。稳定 Message-ID 不是 SMTP 的 exactly-once 保证。

实现参考 [Nodemailer SMTP 配置](https://nodemailer.com/smtp) 与 [错误字段文档](https://nodemailer.com/errors)。强制关闭文件/URL 内容读取，没有附件、任意模板资源下载或访客邮件订阅入口。备份失败可以通过已启用的邮件通道提醒一次，同任务重试不重复生成事件；邮件通道自己的失败只产生站内运行异常通知，避免递归告警。

## 完整备份与生产网络适配

| 变量                        | 用途与缺省                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `BACKUP_SCHEDULE_ENABLED`   | 默认 `false`                                                          |
| `BACKUP_DIRECTORY`          | 专用绝对目录；不与恢复输出或其他用途目录混用                          |
| `BACKUP_OWNER_ID`           | 一次生成并长期保留的 UUID v4，界定本执行器拥有的产物                  |
| `BACKUP_INTERVAL_MINUTES`   | 默认 1440，最小 1；按 UTC 时间槽去重                                  |
| `BACKUP_EXECUTION_MODE`     | `docker` 缺省，只支持已有本机 PG 容器；`native` 显式使用 PG 16 客户端 |
| `BACKUP_POSTGRES_CONTAINER` | Docker 模式缺省 `tixxin-blog-postgres`                                |
| `BACKUP_RETENTION_DAYS`     | 默认 30；仅清理本 owner 的过期产物                                    |
| `BACKUP_TRANSFER_URL/TOKEN` | 可选，必须成对；远端 HTTPS，本机捕获接收器可 HTTP；token 至少 32 字符 |

Docker 模式继续核对 loopback 数据库端口与容器映射。生产网络下显式选择 `native`，worker 容器安装 PostgreSQL 16 `pg_dump`，使用与 API 相同的 `DATABASE_URL`，并只读挂载相同媒体目录。原生客户端可连接 Compose 中的 `postgres` 主机；密码经 `PGPASSWORD` 环境提供，不拼入命令字符串。服务端与客户端都核对主版本 16。原有手动脚本也支持 `full-backup.mjs create --mode native`，默认模式的本机限制保持不变。

备份继续使用单一导出快照：数据库全部 public 表摘要与登记媒体清单来自相同快照；受管媒体逐个复制/摘要验证。图库与友链外部图片只保留数据库中的地址，不读取远端字节。执行器先生成完整备份，再调用独立完整性校验，再传输（如配置），各阶段分别记录。传输失败仍保留已生成并校验的本地备份，并在任务结果标明 `generated/integrityVerified` 与传输未通过。备份完整性校验不等于隔离恢复通过；最近恢复演练见独立恢复报告。

每次尝试使用 `backup-<任务UUID>-<尝试次数>` 新目录，`worker-owner.json` 保存归属、任务和时间。成功完成后，保留策略只处理命名、owner 标记、任务编号、期限和真实路径全部匹配的目录，遇到符号链接或未知目录保留。用户既有 `.backups`、其他 owner、没有标记的失败目录及人工历史备份不会被自动删除。清理不会作用于远端副本；远端保留政策需由该目标操作者单独制定。

## 实际异机传输协议

`scripts/backup-transfer.mjs` 提供流式 PUT 接收器。使用随机共享 token、独立存储根与固定 owner：

```powershell
node --env-file=D:/PrivateConfig/backup-receiver.env scripts/backup-transfer.mjs --serve --apply
```

接收器环境：`BACKUP_RECEIVER_DIRECTORY`、`BACKUP_RECEIVER_OWNER_ID`、`BACKUP_RECEIVER_TOKEN`；`BACKUP_RECEIVER_HOST` 默认 `127.0.0.1`，端口默认 8091。不带 `--serve --apply` 不启动监听。远端部署需在受控 HTTPS 代理后转发 `/backups`；客户端配置 `BACKUP_TRANSFER_URL=https://目标/backups`。token 不出现在 URL 或日志中。真实异机目标、上传及长期接收服务均需对应授权。

发送每个数据库/媒体/清单文件时提供长度与 SHA256。接收器写入自有 staging 目录，逐文件校验后，POST complete 再重新核验整个备份并原子转入最终目录；返回 owner、备份编号、清单 SHA256 与字节总量。发送端校对所有回执字段后才报告传输验证完成。同编号同摘要可重复确认，不覆盖不同字节的既有副本；token 错误、路径不合法、摘要不符或缺文件明确拒绝。传输中断留下自有未完成 staging，既有已完成副本不受影响。

## 恢复后的暂停规则

完整恢复先验证原始全表摘要，再在恢复目标轮换 `operation_control.generation`，同时暂停邮件和自动备份。恢复出的 mail queued/retry/running/paused 转 `restored`，清除租约；backup running 标为中断失败，其他未完成备份转 restored。已成功记录保留历史。随后只在恢复副本新增一条 `result.recoveryVerified=true` 的完成记录，供后台显示真实恢复校验时间；它没有 `integrityVerified` 标记，不计作新备份生成成功。恢复报告的 `counts` 仍是已验证的原始快照计数，`operationSafety.recoveryRecordId` 明确标识此后新增的恢复记录，并记录双暂停和受影响数量。旧版本没有这些表时兼容原恢复流程，新增表由后续正式迁移建立，缺省同样暂停。

切换恢复数据库前停止原 worker/API，检查报告，再使用当前版本代码。启用只影响当前代次的新任务；旧 restored、uncertain 和 failed 邮件需要管理员明确核对，不能通过启用开关批量重投。环境变量仍为 true 也不会绕过数据库恢复暂停。

## 隔离验收

```powershell
corepack pnpm --filter server-main build
node src/backend/server-main/tests/operations-integration.mjs
```

测试创建随机隔离数据库、媒体目录、临时账号、本机 SMTP/TCP 接收器及无网络恢复容器，验证事务事件去重、双 worker 竞争、限频、有限重试、真实接收后断线、不确定状态不重投、失效租约、过时提醒抑制、真实文件传输及回执、错误 token/摘要拒绝、归属清理和恢复双暂停。结束只清理自身资源，脱敏报告保留 `.artifacts/operations/<本次UUID>/verification-report.json`。不会向真实收件人、异地目标发送，也不会启用日常开发库开关。

宿主 Docker 模式验收不能代替最终 worker 镜像内原生 `pg_dump`、生产 HTTPS/SMTP 认证、真实异地网络和真实容量告警验收；这些边界需在最终交付分别记录。
