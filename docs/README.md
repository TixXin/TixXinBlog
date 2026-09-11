# 文档导航

先确认当前能力，再选择使用或维护流程。当前实现、后续规划和历史交付在这里分开；旧报告保留当时事实，其中的阶段完成率、测试数量、内容包版本和服务地址不自动代表现在的系统。

## 当前能力与架构

| 文档                                                 | 阅读目的                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| [能力清单](capability-map.md)                        | 页面、真实数据来源、管理能力与仍未开放的边界                 |
| [架构基线](project-architecture.md)                  | 两工作区、业务职责、认证/上下文、媒体、内容包与持久任务契约  |
| [目录与代码入口](directory-structure.md)             | 从功能定位实际页面、组件、composable、实体和服务             |
| [当前长期使用阶段](sustainable-blog-stage.md)        | 本阶段实现、资料确认、验证及启用状态分别记录                 |
| [七项建设最终验收](sustainable-blog-verification.md) | 七项使用入口、日常数据、验证证据、本地提交与外部启用边界     |
| [首批个人内容与定位](personal-content.md)            | 可核实的内容来源、个人事实确认与隐藏/缺省策略                |
| [性能与维护](performance-maintenance.md)             | 已执行字段投影优化的样本、方法、结果与限制；原始证据仅在本机 |

实际代码是事实核对入口：前端 `src/frontend/web-blog/app/`、后端 `src/backend/server-main/src/`；内容包版本/兼容由 `modules/backup/content-package.ts` 明确声明。当前导出 v9、兼容 v1–v8，不能沿用旧阶段 v5/v6/v7 数字替代最新维护契约。

## 使用与日常维护

| 场景                     | 文档                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 初次了解与开发启动       | [根 README](../README.md)、[后端服务 README](../src/backend/server-main/README.md)、[开发运行与服务复用](development-runtime.md) |
| 数据库与开发样本         | [开发数据库](development-database.md)、[开发数据目录](development-data-catalog.md)；先核对和备份，再显式增量处理                 |
| 日常后台处理             | [运营工作台](operations-workbench.md)、[后台工作区](admin-workspace-improvements.md)                                             |
| 写作、章节和继续阅读     | [写作与关联导航](writing-navigation.md)、[素材整理](media-organization.md)                                                       |
| 六域搜索与阅读路径       | [内容发现](content-discovery.md)：类型分页、公开边界、深链和有向关联                                                             |
| 朋友圈与留言             | [朋友圈使用](moment-business.md)、[朋友圈接口](backend/moments.md)、[留言接口与管理](backend/guestbook.md)                       |
| 图库、项目与友链         | [图库](backend/gallery.md)、[项目](backend/projects.md)、[友链](backend/links.md)                                                |
| 内容包与完整恢复         | [备份与恢复](backup-and-recovery.md)、[朋友圈维护关系](backend/moment-maintenance.md)                                            |
| 邮件、运行任务与备份调度 | [运行任务与通知](operations-and-notifications.md)；默认关闭，已读不等于业务已处理                                                |
| 发布、版本切换与部署演练 | [发布操作](release-operations.md)、[本地生产式验收](local-production-validation.md)                                              |
| 主题开发与验收素材       | [主题契约](theme-development-guide.md)、[验收产物管理](verification-artifacts.md)                                                |

开发服务不会自动迁移、seed、reset 或向真实外部目标投递。生产发布、真实收件人通知、真实异地上传与长期任务启用须依据对应授权执行；提供脚本或隔离验收通过不代表已经投产。书签仍使用 LocalStorage，公开友链申请、访客邮件订阅与多用户协作不在当前开放入口中。

## 后续规划与待办

- [前端 Todo](../src/frontend/web-blog/todo.md)、[后端 Todo](../src/backend/server-main/todo.md)：查看尚未完成的具体条目，结合当前阶段记录和代码判断。
- 书签 API/云同步、友链公开申请、访客邮件订阅及其他新交互应作为独立业务需求；不因界面预留或静态配置出现而认定已实现。
- 外部搜索、额外缓存、列表虚拟化等性能建议需先有同条件证据；未实施建议不计入已有优化收益。
- [后端需求设计](backend/requirements.md)、[早期下一阶段建议](next-stage.md)可用于了解设计背景，不能直接当作已经交付的功能列表。

## 历史交付与设计背景

以下文档保留原始阶段事实。阅读其测试数字、版本、目录或“当前/下一阶段”描述时，以本页的当前能力和操作契约链接进行对照，不覆盖历史文字来制造持续完成的印象。

| 历史范围           | 记录入口                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 早期后端设计       | [原后端文档导航](backend/README.md)、[技术选型](backend/tech-stack.md)、[开发设计](backend/development.md)、[原综合 API 设计](backend/api.md)；其中“从零设计”、Mock 缺省和旧目录建议属于当时背景，现服务从[后端 README](../src/backend/server-main/README.md)进入 |
| 早期项目分析与审查 | [项目分析](project-analysis-report.md)、[2026-09-06 审计](project-audit-2026-09-06.md)、[整改进度](remediation-progress.md)                                                                                                                                       |
| 后台早期实现       | [管理阶段](admin-management-progress.md)、[长期维护阶段](admin-long-term-progress.md)、[评论联调](comment-integration-validation.md)                                                                                                                              |
| UI 与动效          | [UI 整改报告](ui-ux-remediation-report.md)、[UI 进度](ui-ux-remediation-progress.md)、[动效审查](motion-audit/report.md)、[动效整改](motion-remediation/report.md)                                                                                                |
| 页面分区与导航     | [页面分区](page-regions/README.md)、[内容导航修复](content-navigation-fix/report.md)                                                                                                                                                                              |
| 服务恢复与朋友圈   | [服务恢复记录](service-recovery.md)、[朋友圈阶段验收](next-stage-verification.md)、[数据修复记录](moment-development-data-repair.md)                                                                                                                              |
| 留言与开发数据阶段 | [阶段说明](guestbook-stage.md)、[留言验收](guestbook-stage-verification.md)、[当时目标](next-goal-development-data-guestbook.md)                                                                                                                                  |
| 图库、项目与友链   | [交付索引](gallery-project-link-delivery.md)、[图库阶段](gallery-stage-verification.md)、[项目阶段](project-stage-verification.md)、[友链阶段](link-stage-verification.md)、[图库外链与后台验收](gallery-external-admin-verification.md)                          |

原始截图、trace、录屏、性能采样和运行日志不复制到此导航或 Git 文档目录；当前产物保存在 `.artifacts/` / `.playwright-mcp/`。历史 `docs/**/evidence/` 只保留本机副本，正式说明可保留文字结论和 `docs/img/` 产品素材。
