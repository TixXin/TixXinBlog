# Claude Code 项目入口

先读取根目录 [AGENTS.md](AGENTS.md)，以其中的项目约束、当前会话授权、开发数据要求和提交规范为准。使用中文交流；不在此重复维护 Node 版本、业务实现状态或构建流程。

- 当前能力与数据源边界：[能力清单](docs/capability-map.md)。
- 代码职责与目录：[架构基线](docs/project-architecture.md)、[目录说明](docs/directory-structure.md)。
- 服务启动与数据维护：[开发运行](docs/development-runtime.md)、[开发数据库](docs/development-database.md)、[开发数据目录](docs/development-data-catalog.md)。
- 验收材料与其他文档：[验收产物管理](docs/verification-artifacts.md)、[文档导航](docs/README.md)。
- MCP 工具规则：[共享技能](.agents/skills/mcp/SKILL.md)；Claude 入口保留在 `.claude/skills/mcp/SKILL.md`。

本机权限配置与工具记忆留在忽略范围内。整理配置时先备份并保留既有权限语义，不把机器路径、密钥或本机会话白名单加入共享规则。
