# 复验说明

本目录保存本轮实际使用的补测采集脚本，不是产品运行依赖。脚本保留当时的绝对工作路径 `D:/Projects/TixXinBlog/.codex/motion-fixes`，依赖隔离服务生成的 state.json、fixture.json 和 frontend/frontend-dev 副本；这些私有状态文件不进入 Git。

正式可持续运行的业务与动效回归位于 `src/frontend/web-blog/tests/e2e/`，配置为 playwright.config.ts 和 playwright.motion.config.ts；单测位于 tests/unit。后端 tests/browser-runner.mjs 管理一次性的数据库、测试账号与媒体目录。请在独立检出或副本执行构建，避免与日常 Nuxt 开发服务器共用生成目录。

本次核心命令为项目已定义的 `corepack pnpm lint`、前端 `nuxt typecheck`、`corepack pnpm --filter web-blog test`、`corepack pnpm build` 及隔离浏览器运行器。三浏览器使用 Playwright 的项目参数；先指定测试文件，再使用 `--project=firefox --project=webkit`，避免项目参数吞掉文件路径。

补测脚本用途：matrix 采集75组响应式状态；record-motion 保留正常动画视频和rAF记录；validate-runtime 分别运行 faults/hmr；supplement 的 fonts/colors/contexts/slow-navigation/offscreen 分别注入对应情景。运行故障与HMR时应使用独立开发副本，HMR不能与其他开发环境回归并行。

performance 的 before/after 参数分别访问整改前后生产副本。使用相同106篇隔离数据、1440×1000、固定随机数、4秒设置与导航操作，正常和4倍CPU各3轮；禁止与其他繁重验证并行。原始 results.json 保留当时轨迹位置，归档中的同名 cpu-*-run-*.json 即对应轨迹。

整改前快照保存在本机只读诊断目录，并与原审查338个指纹核对；当前Git历史的拆分提交不是该快照的替代品。复现整改前版本需要该快照或逐文件匹配的来源，不能直接把某个中间模块提交当作完整整改前构建。

verify-commit-format 比对提交钩子前后文件、Prettier归一结果和编译结构。它保留了9项格式差异及测试/提交哈希，不改写测试指纹。若源码出现新的功能变化，应重新运行相关回归，不能继续沿用本轮报告。
