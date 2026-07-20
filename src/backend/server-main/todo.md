# server-main 开发 Todo

> 本文档维护 `src/backend/server-main/` 的开发待办与总体进度。开发前先阅读,开发中同步更新。阶段划分与验收标准见 `docs/backend/development.md` §1。

## 总进度

- 总任务数:12
- 已完成:11
- 进行中:0
- 未开始:1
- 完成率:92%

## 维护约定

- `[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[-]` 暂缓
- 任务状态变化时同步更新本文档与总进度

## 当前进行中

(无)

## 待处理(按优先级)

- [ ] backend-ci workflow:lint → typecheck → test → migration 校验 → build

## 已完成

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

## 暂缓 / 阻塞

(无)

## 备注:与设计文档的已知偏离

- Post 主键为自增整数而非 uuid v7:前端契约 PostItem.id 为 number(api.md §7.2 示例同),uuid 迁移待前端统一 id 类型后再做
- search 参数暂以 ILIKE 兜底,Meilisearch 接入后由 search 模块替换
- 迁移与 Seeder 通过 tsx 脚本(scripts/migrate.ts、seed:dev)执行而非 mikro-orm CLI,避免引入 ts-node;能力等价
- 鉴权未引入 passport/passport-jwt,直接 @nestjs/jwt + 自定义 AdminAuthGuard;能力等价、依赖更少
