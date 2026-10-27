# 固定版本框架生命周期修正

`nuxt@4.5.2.patch`、`@vue__runtime-core@3.5.42.patch`和`@vue__server-renderer@3.5.42.patch`使用pnpm固定版本补丁机制登记在根清单和锁文件中。安装时应用相同差异，两个Docker安装层及隔离开发副本均包含此目录。工作流参考[pnpm patch](https://pnpm.io/cli/patch)及[patch-commit](https://pnpm.io/cli/patch-commit)；本项目实际命令以固定的pnpm9.15.0为准。

## 范围与原因

- `dist/pages/runtime/plugins/router.js`：同一路径比较只使用SSR pathname，查询与锚点继续来自真实浏览器位置；启动和SSG延后恢复期间短期记录原生历史目标，防止旧SSR地址强制回放覆盖刚返回的历史条目。保留正常SSR重定向、插件导航优先级与middleware。
- `dist/app/plugins/payload.client.js`：保存可取消的清单预取定时器，在页面卸载时及时停止旧文档调度，页面恢复后按需重排。清单数据层的校验、失败清缓存及诊断保持原样。

`beforeunload`仅在客户端尚未就绪或存在待执行预取时监听，开始预取或暂停后移除，避免无必要的常驻监听影响Firefox的前进后退缓存；背景参见[MDN beforeunload说明](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)。页面隐藏/恢复的监听与该短期保护分开管理。

本补丁保留清单功能、同源访问控制和所有浏览器错误断言。当前页面的真实清单失败仍按Nuxt原有逻辑清除失败缓存；恢复资源后正常刷新可成功读取，业务列表不伪造结果。

## Vue 异步页面的辅助更新等待

Vue 3.5.42 在异步子树尚未就绪、父节点又发生更新时，为 `asyncDep` 附加一个只处理成功的 `then`。即使原始拒绝已由 Suspense 和应用错误边界处理，这个派生 Promise 仍会成为未处理拒绝；快速取消页面时也会发生。

补丁只为该辅助 `then` 增加第二参数：存在 Suspense 时沿用 `registerDep` 的唯一错误处理链，没有 Suspense 时仍交给 `handleError`。它不在整个链末尾使用 `catch`，因此不会吞掉成功回调自身的异常。ESM、CommonJS 开发和生产产物使用同一修正，不修改取消识别协议，也不在浏览器全局过滤拒绝事件。

`pageRequestBoundary.test.ts` 使用实际安装的 Vue，覆盖未完成子树的父属性更新、卸载后的有标记取消、普通错误、同文案但无标记错误，以及成功解析后保留最新父属性。未应用补丁的负对照会产生额外未处理拒绝；浏览器快速导航仍必须满足零页面错误。

## Vue SSR 插槽中的 Teleport 标记

`@vue/server-renderer` 的 `ssrRenderSlotInner` 会把输出里只有注释的插槽当作空插槽丢弃。`<Teleport>` 在原位只留下 `<!--teleport start--><!--teleport end-->` 两条标记，内容已经进入目标缓冲，因此"插槽里只有一个 Teleport"会被整体丢掉：目标里有内容、原位却没有标记，客户端水合时找不到 Teleport 锚点，表现为 `Hydration completed but contains mismatches`。本项目的页面右侧栏正是通过 `CommonPageFrame` 的 `overlays` 插槽 Teleport 到布局挂载点并由 `sidebar-teleport.server.ts` 注入 SSR 内容。

补丁只在判空循环里把 Teleport 标记视为非空；普通注释插槽仍走后备内容。CommonJS 与 ESM 的开发、生产产物使用同一修正；`esm-browser.prod.js` 为压缩产物且本项目不使用浏览器端 SSR，未修改。`ssrTeleportSlot.test.ts` 使用实际安装的渲染器覆盖这两种情况。

## 维护与验证

```sh
corepack pnpm patch nuxt@4.5.2 --edit-dir .artifacts/nuxt-patch-next
corepack pnpm patch-commit .artifacts/nuxt-patch-next
corepack pnpm test:nuxt-patches
corepack pnpm --filter web-blog exec vitest run tests/unit/pageRequestBoundary.test.ts
corepack pnpm --filter web-blog test
```

Vue 补丁同样使用 `corepack pnpm patch @vue/runtime-core@3.5.42 --edit-dir .artifacts/vue-runtime-patch-next`（服务端渲染器为 `@vue/server-renderer@3.5.42`）和 `patch-commit` 维护。不要直接编辑已安装的`node_modules`，也不要设置允许未应用补丁来绕过版本不匹配。升级Nuxt或Vue时需对照新源码，删除已经被上游修复的部分或重新生成补丁及锁文件。

测试直接执行安装版本的路由插件与启动钩子，覆盖正常SSR、原生查询/锚点、插件导航、SSG恢复与middleware拒绝。前端单测执行实际payload插件并核对定时器、短期监听和恢复；浏览器测试包含快速刷新后原历史条目仍能返回，以及跨过预取期限的真实卸载和503后刷新恢复。

原始诊断仅保留在本机`.artifacts/link-stage/`：`native-history-writer-conclusion.json`、`native-history-writer-attempt-*.json`、`manifest-lifecycle-conclusion.json`及关联trace。原版负对照已明确复现，两处补丁均应在重新构建后验证，不能用增加等待或过滤错误替代。

## Nuxt DevTools 的 simple-git 导入

`@nuxt__devtools@3.4.2.patch` 只改 `dist/chunks/module-main.mjs` 的一行导入：`import Git from 'simple-git'` 改为 `import { simpleGit as Git } from 'simple-git'`。根清单为修复安全公告把 `simple-git` 覆盖到 4.x，4.x 只提供具名导出 `simpleGit`，原默认导入在加载 DevTools 模块时直接抛出 `SyntaxError`。

日常开发与 CI 主机因 `nuxt.config.ts` 默认关闭 DevTools 不受影响，但前端 Docker 安装层只复制清单、在没有项目配置时执行 `nuxt prepare`，会按默认值加载 DevTools 并使镜像构建失败；本地设置 `NUXT_DEVTOOLS_ENABLED=true` 时同样会失败。补丁不改变 DevTools 行为，升级 DevTools 到原生兼容 simple-git 4 的版本后应删除。

## Nuxt SSR 地址的二次编码

`@nuxt__nitro-server@4.5.2.patch` 只改 `dist/runtime/utils/renderer/app.mjs` 的 `encodeEventPath`。原实现对 `event.path` 直接调用 ufo 的 `encodePath`，而 h3 1.x 的 `event.path` 已是百分号编码，`%E7` 会被再编码成 `%25E7`。服务端 vue-router 只解码一次，`route.params` 因此仍是 `%E7%94%9F…`：中文标签与专栏直接打开返回 404，朋友圈话题标题显示编码串，站内跳转不受影响。上游讨论见 [nuxt/nuxt#26071](https://github.com/nuxt/nuxt/issues/26071)。

补丁先用 ufo 的 `decodePath` 解码路径部分再编码，查询串保持原样；`decodePath` 不还原编码斜杠，字面量 `%25` 仍编码为 `%25`。`scripts/nuxt/ssr-event-path.test.mjs` 执行实际安装的函数覆盖这些情况。维护命令为 `corepack pnpm patch @nuxt/nitro-server@4.5.2 --edit-dir .artifacts/nitro-server-patch` 与 `patch-commit`；升级 Nuxt 时若上游已不再二次编码，应删除此补丁。
