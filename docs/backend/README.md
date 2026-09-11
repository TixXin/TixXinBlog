# 后端接口与维护入口

当前后端位于 `src/backend/server-main/`，使用 NestJS、MikroORM 和 PostgreSQL。启动配置、命令与服务结构见[后端服务 README](../../src/backend/server-main/README.md)，已开放能力以[能力清单](../capability-map.md)为准。

## 分域契约

| 业务       | 文档与边界                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 朋友圈     | [接口](moments.md)、[维护关系](moment-maintenance.md)；公开与管理、评论、媒体及内容包                                     |
| 留言       | [留言契约](guestbook.md)；身份、审核、回复、互动、分页与管理                                                              |
| 图库       | [图库契约](gallery.md)；受管媒体与外链互斥、发布状态和独立器材设置                                                        |
| 项目       | [项目契约](projects.md)；进展与发布状态、管理与维护兼容                                                                   |
| 友链       | [友链契约](links.md)；站点目录、博主管理与规则，公开申请未开放                                                            |
| 内容与站点 | [架构基线](../project-architecture.md)、[代码入口](../directory-structure.md)；文章、评论、认证、闪念、站点版本与跨域约束 |

## 日常维护

| 场景                 | 入口                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| 开发启动与故障定位   | [开发运行](../development-runtime.md)                                                     |
| 数据库与代表性样本   | [开发数据库](../development-database.md)、[开发数据目录](../development-data-catalog.md)  |
| 内容包与完整恢复     | [备份与恢复](../backup-and-recovery.md)                                                   |
| 通知、投递与自动备份 | [运行任务与通知](../operations-and-notifications.md)                                      |
| 发布准备与版本切换   | [发布操作](../release-operations.md)、[首发准备与验收](../first-release-readiness.md)     |
| 测试与维护边界       | [验收产物管理](../verification-artifacts.md)、[性能与维护](../performance-maintenance.md) |

接口、实体或维护行为变化时，更新对应现行分域文档和回归入口。正式迁移、测试源码、开发样本及其素材许可持续跟踪，截图和机器报告写入本机忽略目录。

早期“从零设计”、旧 Mock 默认值和原综合 API 方案已移至[后端设计归档](../archive/backend-design/README.md)，用于解释演进背景。当前开发待办在[后端 Todo](../../src/backend/server-main/todo.md)维护，全部文档从[总导航](../README.md)进入。
