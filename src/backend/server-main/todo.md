# server-main 开发 Todo

> 本文档维护 `src/backend/server-main/` 的开发待办与总体进度。开发前先阅读,开发中同步更新。阶段划分与验收标准见 `docs/backend/development.md` §1。

## 总进度

- 总任务数:12
- 已完成:5
- 进行中:0
- 未开始:7
- 完成率:42%

## 维护约定

- `[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[-]` 暂缓
- 任务状态变化时同步更新本文档与总进度

## 当前进行中

(无)

## 待处理(按优先级)

- [ ] 实体建模:按 development.md §4 建 Post / PostTag / Comment 等内容类实体
- [ ] 注册 MikroOrmModule 并生成首批迁移(create_post_table 等)
- [ ] DevSeeder:从前端 `features/post/mock.ts` 读取种子数据,保证前后端同源
- [ ] post 模块最小闭环:列表 / 详情 / 点赞 / 浏览统计,响应字段对齐前端 `types.ts`
- [ ] 前端联调:`useMockRepo=false` 切换验证(development.md §10.3 清单)
- [ ] auth 模块:JWT access/refresh 双 token + argon2id 密码
- [ ] backend-ci workflow:lint → typecheck → test → migration:check → build

## 已完成

- [x] 工程骨架初始化:package.json / tsconfig / nest-cli / ESLint 扁平配置(2026-07-20)
- [x] 入口引导:全局前缀 api/v1、ValidationPipe、CORS、优雅停机(2026-07-20)
- [x] 统一响应与错误码:响应包装拦截器 + 全局异常过滤器 + BusinessException,对齐 api.md 附录 A(2026-07-20)
- [x] 基础设施配置:nestjs-pino 结构化日志、env 启动校验、mikro-orm.config、docker-compose 依赖栈、.env.example(2026-07-20)
- [x] 健康探针 /health /ready + 首个 Jest 单元测试(2026-07-20)

## 暂缓 / 阻塞

(无)
