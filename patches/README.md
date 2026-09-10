# Nuxt 4.5.2 生命周期修正

`nuxt@4.5.2.patch`使用pnpm固定版本补丁机制登记在根清单和锁文件中。安装时应用相同差异，两个Docker安装层及隔离开发副本均包含此目录。工作流参考[pnpm patch](https://pnpm.io/cli/patch)及[patch-commit](https://pnpm.io/cli/patch-commit)；本项目实际命令以固定的pnpm9.15.0为准。

## 范围与原因

- `dist/pages/runtime/plugins/router.js`：同一路径比较只使用SSR pathname，查询与锚点继续来自真实浏览器位置；启动和SSG延后恢复期间短期记录原生历史目标，防止旧SSR地址强制回放覆盖刚返回的历史条目。保留正常SSR重定向、插件导航优先级与middleware。
- `dist/app/plugins/payload.client.js`：保存可取消的清单预取定时器，在页面卸载时及时停止旧文档调度，页面恢复后按需重排。清单数据层的校验、失败清缓存及诊断保持原样。

`beforeunload`仅在客户端尚未就绪或存在待执行预取时监听，开始预取或暂停后移除，避免无必要的常驻监听影响Firefox的前进后退缓存；背景参见[MDN beforeunload说明](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)。页面隐藏/恢复的监听与该短期保护分开管理。

本补丁保留清单功能、同源访问控制和所有浏览器错误断言。当前页面的真实清单失败仍按Nuxt原有逻辑清除失败缓存；恢复资源后正常刷新可成功读取，业务列表不伪造结果。

## 维护与验证

```sh
corepack pnpm patch nuxt@4.5.2 --edit-dir .artifacts/nuxt-patch-next
corepack pnpm patch-commit .artifacts/nuxt-patch-next
corepack pnpm test:nuxt-patches
corepack pnpm --filter web-blog test
```

不要直接编辑已安装的`node_modules`，也不要设置允许未应用补丁来绕过版本不匹配。升级Nuxt时需对照新源码，删除已经被上游修复的部分或重新生成补丁及锁文件。

测试直接执行安装版本的路由插件与启动钩子，覆盖正常SSR、原生查询/锚点、插件导航、SSG恢复与middleware拒绝。前端单测执行实际payload插件并核对定时器、短期监听和恢复；浏览器测试包含快速刷新后原历史条目仍能返回，以及跨过预取期限的真实卸载和503后刷新恢复。

原始诊断仅保留在本机`.artifacts/link-stage/`：`native-history-writer-conclusion.json`、`native-history-writer-attempt-*.json`、`manifest-lifecycle-conclusion.json`及关联trace。原版负对照已明确复现，两处补丁均应在重新构建后验证，不能用增加等待或过滤错误替代。
