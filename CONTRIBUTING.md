# 贡献指南

开发环境与首次管理员初始化见[根 README](README.md)。下列命令均从仓库根目录执行；使用 Node 24.x 和 pnpm 9.15.0，保留锁文件与 `patches/` 中的必要补丁。

## 修改范围与代码职责

- `src/frontend/web-blog/app/pages` 组织页面，展示组件接收 props 并发出事件。
- `app/features/<domain>` 保存领域类型、查询和编辑工具；`app/composables` 处理复用状态与请求流程。
- `themes/` 和 `theme-contracts/` 管理布局差异，避免为不同主题复制业务数据。
- `src/backend/server-main/src/modules` 实现业务规则，`entities` 与 `migrations` 维护持久结构。

详细边界见[架构](docs/architecture.md)。保持单博主定位；不要把各模块不同的发布、删除和恢复规则强行合并。接口和持久字段变化同时检查权限、版本冲突、公开过滤、内容包编号映射及备份兼容。

代码文件需有文件头，注释使用中文，换行使用 LF。格式采用单引号、无分号、120 列和尾随逗号，由 Prettier 统一处理。图标使用 Lucide，例如 `<Icon name="lucide:file-text" />`。框架和主题约定见[开发指南](docs/development.md)与[主题指南](docs/themes.md)。

## 开发数据与配置

开发启动不自动迁移、seed 或清空。先检查目标和样本状态：

```sh
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev seed-data --dataset all
```

最后一条仅预览。增量写入需要本机非生产目标、备份和精确数据库确认；参数与维护步骤见[开发指南](docs/development.md)。

功能改动应配套可重复使用的代表样本，覆盖常用状态、分页及边界。保留用户编辑与删除归属；开发样本不直接迁入生产，也不写成用户真实经历或作品。自动化写入、故障模拟、恢复和投递测试使用隔离数据库、媒体、账号及本地捕获服务。

不要提交 `.env`、密码、访问令牌、数据库连接串或运行数据。配置变化更新相应 `.env.example` 或部署模板，说明新增字段和默认行为。

## 选择与改动相符的验证

| 改动                     | 建议验证                                                                         |
| ------------------------ | -------------------------------------------------------------------------------- |
| 文档、链接               | 检查命令和路径，执行格式与差异检查                                               |
| 前端逻辑或组件           | 前端 lint、类型检查、相关 Vitest；影响构建时执行生产构建                         |
| UI、交互或主题           | 相关浏览器用例，桌面及 320px/390px、实际断点两侧、三主题、键盘焦点和减少动态效果 |
| 后端业务或权限           | 后端 lint、类型检查、相关 Jest 和隔离 HTTP 回归                                  |
| 持久字段、维护或运行任务 | 正式迁移回放、结构检查、导入/恢复及对应专项                                      |

```sh
corepack pnpm lint
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm --filter server-main test:integration
```

浏览器测试通过根目录 runner 创建隔离环境，不直接对日常服务运行写入用例：

```sh
corepack pnpm test:e2e sustainable-admin.spec.ts --browser=all
```

该命令先构建前后端；还需准备 PostgreSQL 和对应 Playwright 浏览器。更多专项、依赖及运行方式见[开发指南](docs/development.md)、[备份与恢复](docs/backup-and-recovery.md)和[运行维护](docs/operations.md)。

截图、trace、日志、性能原始数据放在已忽略的 `.artifacts/` 或 `.playwright-mcp/`，保留测试源码和必要的长期文档。不要放宽超时、减少样本或删除业务断言来换取通过。没有实际测量依据时，不把配置调整写成性能提升。

## 提交与 PR

按关联功能分批提交。使用中文 Conventional Commits 标题，并在空行后用正文说明原因：

```text
fix(web-blog): 修复筛选返回后的页码恢复

保留列表查询状态，避免从详情页返回时丢失原页码。
```

提交前检查差异和暂存范围；Husky 会运行 lint-staged。不要加入自动生成署名或无关文件。

PR 说明应包含问题及预期行为、主要改动、验证命令和结果。涉及迁移、配置、数据兼容或新增依赖时，说明其影响与维护方式；UI 修改提供能帮助审阅的截图。已知限制或未覆盖的环境明确列出，不用历史验收数字代替当前结果。缺陷报告应提供版本、环境、复现步骤与预期/实际行为，日志先去除凭据和个人信息。

贡献遵循仓库 [LICENSE](LICENSE)。引用第三方代码或素材时保留其来源与许可。
