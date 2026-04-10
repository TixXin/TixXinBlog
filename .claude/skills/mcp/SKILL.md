---
name: mcp
description: 本项目 MCP 服务器的使用规范和工具速查，涵盖 Git、Playwright、Context7 四个 MCP 服务器
user-invocable: false
---

# MCP 工具使用规范

本项目配置了 4 个 MCP 服务器（见 `.mcp.json`），以下是使用规则和常用工具速查。

## 1. Git MCP Server (`mcp__git-mcp-server__*`)

**强制要求：所有 git 操作必须使用 Git MCP 工具，禁止用 Bash 执行 git 命令。**

常用工具：

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| `git_status` | 查看工作区状态 | `repo_path` |
| `git_diff` | 查看差异 | `repo_path`, `target`（如 `HEAD`） |
| `git_diff_staged` | 查看暂存区差异 | `repo_path` |
| `git_diff_unstaged` | 查看未暂存差异 | `repo_path` |
| `git_log` | 查看提交历史 | `repo_path`, `max_count` |
| `git_add` | 暂存文件 | `repo_path`, `files`（数组） |
| `git_commit` | 提交 | `repo_path`, `message` |
| `git_show` | 查看某次提交详情 | `repo_path`, `revision` |
| `git_branch` | 查看分支 | `repo_path` |
| `git_create_branch` | 创建分支 | `repo_path`, `branch_name` |
| `git_checkout` | 切换分支 | `repo_path`, `branch_name` |
| `git_reset` | 重置 | `repo_path` |

注意事项：
- `repo_path` 固定填 `E:\Projects\TixXinBlog`
- 提交消息格式：`<type>(<scope>): <中文描述>`，末尾加 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- 提交前先 `git_status` + `git_diff` 确认改动范围
- 验证通过后询问用户再提交，不自动 commit

## 2. Playwright MCP (`mcp__playwright__*`)

**UI 改动后必须用 Playwright 实际验证效果。**

截图输出目录：`.playwright-mcp/`（已在 `.mcp.json` 中通过 `--output-dir` 配置）

常用工具：

| 工具 | 用途 |
|------|------|
| `browser_navigate` | 导航到 URL |
| `browser_snapshot` | 获取无障碍快照（优于截图，结构化数据） |
| `browser_take_screenshot` | 截图保存为文件 |
| `browser_click` | 点击元素（需先 snapshot 获取 ref） |
| `browser_evaluate` | 在页面执行 JS（DOM 检查、状态验证） |
| `browser_console_messages` | 查看控制台消息 |
| `browser_hover` | 悬停元素 |
| `browser_fill_form` | 填写表单 |
| `browser_press_key` | 按键操作 |
| `browser_wait_for` | 等待元素/条件 |
| `browser_network_requests` | 查看网络请求 |
| `browser_close` | 关闭浏览器 |

验证流程：
1. 确保 dev server 已运行（`pnpm dev`，端口 3456）
2. `browser_navigate` 到 `http://localhost:3456/<目标页面>`
3. `browser_snapshot` 获取页面结构，或 `browser_evaluate` 检查 DOM 状态
4. 需要视觉验证时用 `browser_take_screenshot`
5. 检查控制台有无报错

交互测试技巧：
- 先 `browser_snapshot` 获取元素 `ref`，再用 `ref` 进行 `browser_click`
- 切换主题：通过 `browser_evaluate` 设置 cookie `tixxin-blog-layout-theme=aurora|nexus|dock`，然后刷新
- 验证组件状态：`browser_evaluate` 执行 DOM 查询

## 3. Context7 MCP (`mcp__context7__*`)

查询第三方库/框架的最新文档，避免使用过时 API。

| 工具 | 用途 |
|------|------|
| `resolve-library-id` | 搜索库名获取 Context7 ID |
| `query-docs` | 根据 ID 查询文档内容 |

使用场景：
- 使用 Vue/Nuxt/Vite 等框架 API 时查文档确认
- 不确定某个库的配置选项时
- 版本迁移或 API 变更时

用法：先 `resolve-library-id` 获取 ID，再 `query-docs` 查询具体内容。

## 4. Memory MCP (`mcp__server-memory__*`)

知识图谱式记忆存储（Cursor 用），Claude Code 有自己的 memory 系统，一般不直接使用此 MCP。
