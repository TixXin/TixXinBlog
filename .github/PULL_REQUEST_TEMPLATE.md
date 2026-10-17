<!--
提交前请阅读 CONTRIBUTING.md。标题使用中文 Conventional Commits，例如：
fix(web-blog): 修复筛选返回后的页码恢复
提交正文在空行后说明原因；不要添加自动生成署名或 emoji trailer。
-->

## 问题与预期行为

<!-- 这个 PR 解决什么问题，改动后应该是什么表现。关联 Issue 请写 Closes #123。 -->

## 主要改动

<!-- 按模块列出关键改动，说明取舍；不要逐文件复述 diff。 -->

## 改动与验证对照

<!-- 对照 CONTRIBUTING.md 的「选择与改动相符的验证」，只填与本次改动相关的行。 -->

| 改动范围 | 执行的验证 | 结果 |
| -------- | ---------- | ---- |
|          |            |      |

## 验证清单

勾选本次实际执行过的命令，未执行的保持未勾选并在下方说明原因。

- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm --filter web-blog exec nuxt typecheck`
- [ ] `corepack pnpm --filter web-blog test`
- [ ] `corepack pnpm --filter server-main lint`
- [ ] `corepack pnpm --filter server-main typecheck`
- [ ] `corepack pnpm --filter server-main test`
- [ ] `corepack pnpm --filter server-main test:integration`
- [ ] `corepack pnpm test:e2e <spec> --browser=all`
- [ ] `corepack pnpm build` / `corepack pnpm --filter server-main build`
- [ ] 文档改动：已核对命令、路径与链接

未执行的命令及原因：

<!-- 例如：仅文档改动，未涉及前后端代码。 -->

## 影响与兼容性

- [ ] 包含数据库迁移，已回放迁移并执行结构检查
- [ ] 改动了持久字段或关系，已同步内容包版本映射、历史保护与完整恢复
- [ ] 新增或升级了依赖，已在说明中写明用途与维护方式
- [ ] 改动了配置项，已更新对应 `.env.example` 或部署模板
- [ ] 以上均不涉及

## UI 与可访问性

仅在改动界面、交互或主题时填写。

- [ ] 已附上有助于审阅的截图或录屏
- [ ] 桌面及 320px / 390px、实际断点两侧均检查
- [ ] Nexus、Aurora、Dock 三套主题均检查
- [ ] 键盘焦点与「减少动态效果」偏好正常

## 已知限制

<!-- 未覆盖的场景、环境或后续计划。没有请写「无」。不要用历史验收结果代替本次结论。 -->

## 自查

- [ ] 标题为中文 Conventional Commits，提交正文在空行后说明原因
- [ ] 没有自动生成署名、emoji trailer 或无关文件
- [ ] 没有提交 `.env`、密钥、令牌、数据库连接串或运行数据
- [ ] 运行产物已放在 `.artifacts/` 或 `.playwright-mcp/`，未进入版本库
- [ ] 没有通过放宽超时、删减断言或缩减样本换取通过
- [ ] 引用的第三方代码或素材已保留来源与许可，贡献遵循仓库 [LICENSE](../LICENSE)（GNU GPL v3）
