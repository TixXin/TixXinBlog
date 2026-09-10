# server-main 开发 Todo

> 本文档维护 `src/backend/server-main/` 的开发待办与总体进度。开发前先阅读,开发中同步更新。阶段划分与验收标准见 `docs/backend/development.md` §1。

## 历史基础建设（已归档）

原工程、文章、认证、评论、闪念与后台维护任务已完成。后续朋友圈、留言及开发数据保障也已交付，见 `docs/next-stage-verification.md` 和 `docs/guestbook-stage-verification.md`；不再保留这些领域“待实现”的遗留状态。

## 当前阶段：图库、项目与友链

- 总任务数：3；已完成：0；进行中：1；未开始：2；完成率：0%。
- 完成率只对应本轮三个模块的完整业务交付，每项包含前后台、日常样本、维护、验证和提交。
- [~] 图库：数据库/API、数据与维护已实现并完成隔离验证，正在前端联合验收。
- [ ] 项目真实业务。
- [ ] 友链真实业务。
- 跟踪见 `docs/gallery-project-link-stage.md`。

## 维护约定

- `[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[-]` 暂缓
- 任务状态变化时同步更新本文档与总进度

## 当前进行中

图库真实业务及联合验收。

## 待处理(按优先级)

- 项目与友链按当前阶段顺序推进；友链公开申请、外部指标自动同步和书签云同步另行规划。

## 已完成

- [x] 后台长期维护能力：创作保护、媒体、批量回收、评论审核、站点设置、会话审计、备份恢复及统一验收（详见 docs/admin-long-term-progress.md）

- [x] 后台日常管理完善（详见 docs/admin-management-progress.md）（2026-09-07 验收通过）
- [x] 闪念前后端身份统一，管理与公开接口权限验证通过。
- [x] admin post CRUD(POST/PATCH/DELETE /admin/posts,AdminAuthGuard 已就绪)
- [x] 文章归档与相关推荐统一真实数据源（/posts/metadata 与 /posts/:id/related）。

- [x] 全项目审计 28 项整改与验收（详见 docs/remediation-progress.md）（2026-09-07，旧密钥撤销验证通过）

- [x] 评论联调：读取访客点赞状态、输入校验、并发计数与接口回归验证（本轮新增）（2026-09-06，见 docs/comment-integration-validation.md）

- [x] 工程骨架初始化:package.json / tsconfig / nest-cli / ESLint 扁平配置(2026-07-20)
- [x] 入口引导:全局前缀 api/v1、ValidationPipe、CORS、优雅停机(2026-07-20)
- [x] 统一响应与错误码:响应包装拦截器 + 全局异常过滤器 + BusinessException,对齐 api.md 附录 A(2026-07-20)
- [x] 基础设施配置:nestjs-pino 结构化日志、env 启动校验、mikro-orm 配置、docker-compose 依赖栈、.env.example(2026-07-20)
- [x] 健康探针 /health /ready + 首个 Jest 单元测试(2026-07-20)
- [x] post 域实体建模:Post / PostTag(M:N)/ PostLike / PostView,显式类型注解适配 tsx 运行(2026-07-20)
- [x] MikroOrmModule 注册 + 首批迁移 20260720125632_create_post_tables(tsx 迁移脚本替代 CLI,免 ts-node)(2026-07-20)
- [x] DevSeeder:跨 workspace 读取前端 features/post/mock.ts,seed 50 篇文章 / 18 个标签,主键序列同步(2026-07-20)
- [x] post 最小闭环 API:GET /posts(分页/过滤/排序)、GET /posts/:id(详情+toc)、POST /posts/:id/like(切换)、POST /posts/:id/view(1h 去重);真实 PostgreSQL 实测全部通过,错误码 11/12/1001 对齐契约(2026-07-20)
- [x] 前端联调:usePostList / useArticleDetail 走 useMockRepo 开关对接 /api/v1,SSR 与客户端导航实测渲染数据库数据,CORS/CSP 放行验证通过(2026-07-20)
- [x] auth 模块:argon2id + access JWT(15min)+ refresh 轮换(7d httpOnly cookie),AdminAuthGuard 错误码 20/21/22,login/refresh/logout/me;DevSeeder 补管理员种子(2026-07-20)
- [x] 评论系统:Comment/CommentLike 实体与迁移,评论树/发表(归档拒评 1002、层级超限 1003)/点赞切换;21 项真实 HTTP 验证通过;前端评论区已接入读取(2026-07-20)
- [x] backend-ci workflow:postgres 服务容器上 lint/typecheck/test/迁移重放+schema 漂移校验/build/docker build,首跑即绿(1m32s);多阶段 Dockerfile 本地构建 + 容器冒烟通过(2026-07-20)

## 暂缓 / 阻塞

(无)

## 备注:与设计文档的已知偏离

- Post 主键为自增整数而非 uuid v7:前端契约 PostItem.id 为 number(api.md §7.2 示例同),uuid 迁移待前端统一 id 类型后再做
- search 参数暂以 ILIKE 兜底,Meilisearch 接入后由 search 模块替换
- 迁移与 Seeder 通过 tsx 脚本(scripts/migrate.ts、seed:dev)执行而非 mikro-orm CLI,避免引入 ts-node;能力等价
- 鉴权未引入 passport/passport-jwt,直接 @nestjs/jwt + 自定义 AdminAuthGuard;能力等价、依赖更少
