# AGENTS.md

项目代理的开发约定。使用中文交流；使用者入口见 [README](README.md)，贡献流程见 [CONTRIBUTING](CONTRIBUTING.md)，长期文档见 [docs](docs/README.md)。

## 工程边界

- `src/frontend/web-blog/`：Nuxt 4、Vue 3、TypeScript，公开网站与内置 `/admin` 后台。
- `src/backend/server-main/`：NestJS、MikroORM、PostgreSQL，负责持久化、认证、媒体和维护任务。
- 保持单博主博客定位，不默认扩展多租户、访客账号或协作平台。
- 文章和闪念只在显式演示配置下使用 Mock；朋友圈、留言、图库、项目和友链走真实 API，失败不得回退样本。
- 书签当前使用 LocalStorage，未实现云同步；公开友链申请和访客邮件订阅未开放。
- 类型位于 `features/<domain>/types.ts`；页面组织业务，展示组件通过 props 和事件交互。三主题遵循本地主题契约。
- 内容包当前导出 v9、接受 v1–v8；正式持久字段和关系的变更必须同步迁移、历史保护、内容包兼容和完整恢复。
- 图库受管媒体与外链互斥，服务器不主动抓取用户提交的外部图片地址。

## 开发与验证

使用 Node >=24 <25、pnpm 9.15.0，推荐通过 `corepack pnpm` 调用固定版本。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev:check
corepack pnpm dev:all
corepack pnpm lint
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm build
corepack pnpm --filter server-main build
```

- 先核对 Git 改动、运行服务、数据库目标与实际代码；保护用户已有修改、账号、环境配置和数据。
- `dev` 只启动前端，真实接口开发使用 `dev:all`；启动不隐式迁移、seed 或 reset。
- 使用项目 `build/generate` 命令保留开发与生产中间目录隔离，运行方式见 [开发指南](docs/development.md)。
- 多页出现502时检查后端 `/ready` 与同源API，恢复真实链路，不切换Mock掩盖故障。
- 按改动范围验证。纯文档修改检查链接、格式和引用；业务修改运行相应单测、接口及浏览器回归。已有无关检查通过后，不反复全量重跑。
- 自动写入、删除、故障注入、投递和恢复验收使用独立数据库、媒体、账号和本机捕获服务；只清理本次资源。
- 不以删断言、扩大超时、屏蔽真实错误或缩减代表数据制造通过。

## 代码与数据规范

- 代码文件保留文件头，注释使用中文；统一LF、单引号、无分号和Prettier配置。
- 图标只使用 Lucide：`<Icon name="lucide:xxx" />`，不用emoji充当UI图标。
- 单页使用 `xxx.vue`，有子页面时才用 `xxx/index.vue`。
- 新功能提供幂等、带稳定归属的代表样本，覆盖常见状态、分页、关联与边界；需要时在当前授权内备份后增量补齐本机开发库。
- 不覆盖用户编辑、账号或配置，不复活已删样本，不自动清库或向生产写入样本。运行环境文件不因测试而改写。
- 样本展示字段采用自然内容，不添加“测试数据”等标记；图片和来源可核对，统计从实际记录计算，日期场景有适用记录。
- 日常样本长期保留，隔离测试资源用后清理。数据库工具默认预览；写入先核对目标、备份并明确确认。清空或重建前停止目标库使用方，规则见 [开发指南](docs/development.md)。

## 版本控制与文档

- 按关联模块验证并及时本地提交；提交范围遵循当前会话授权，推送、部署和真实外部投递分别需要对应授权。
- 使用中文 Conventional Commits，并在标题后的空行下用正文说明原因；不添加AI署名或emoji trailer。格式及PR说明见 [贡献指南](CONTRIBUTING.md)。
- Git保留运行、复现和维护所需的源码、正式测试、迁移/快照、锁文件、补丁、配置模板、运行素材及许可证。
- `docs/` 只维护当前操作与架构契约，不继续积累任务提示、完成率、阶段报告、执行日志或历史归档。历史变更通过Git追溯。
- 截图、录屏、trace、机器报告、性能采样、临时计划和本机复现档案写入 `.artifacts/` 或 `.playwright-mcp/`，不强制加入版本库。
- 可选编辑器和代理客户端配置保留本机；项目安装、构建和验证不能依赖它们。
- 不批量忽略图片或JSON等扩展名，不把正式测试、fixture素材或许可文件误当运行产物删除。
