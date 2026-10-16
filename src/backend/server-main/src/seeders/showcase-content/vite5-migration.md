Vite 5.0 是去年 11 月发布的，到现在正好一年。我拖到这个月才把公司的主项目从 4.5 迁上去，原因和大多数人一样：4.x 能跑，没人想碰构建工具。但最近一个新同事装环境时发现 Node 16 已经装不上几个依赖了，整个团队要统一升 Node 20，顺带就把 Vite 一起升了。而且 Vite 6 下周就要正式发布，再不迁 5 就要直接跨两个大版本，坑会叠在一起。

这篇把 5.0 真正值得关注的变化和我们迁移时实际碰到的问题记下来。项目规模供参考：Vue 3 单页应用，大约 1100 个模块，SSR 入口一个，自定义插件三个。

## 核心变化：Rollup 4

Vite 5 最大的底层变化是生产构建的打包器从 Rollup 3 换成了 Rollup 4。Rollup 4 把解析器从 Acorn 换成了基于 SWC 的 Rust 实现，解析速度快了很多。我们的项目生产构建从 4.5 的 96 秒降到了 71 秒，什么都没改，纯换版本。

Rollup 4 也带来了几个破坏性变化，会影响到写了自定义插件的人：

- `acornInjectPlugins` 选项没了，因为不再用 Acorn。
- `this.parse` 返回的 AST 结构有细微差别，我们一个检查 `import` 的插件因为依赖了 `node.start` 和 `node.end` 的位置信息，需要改用 `node.range`。
- 构建产物里 `assetFileNames` 的哈希算法变了，所有文件哈希都会变化，第一次部署会让 CDN 缓存全部失效一次，提前跟运维打招呼。

## Node 版本和 CJS 弃用

Vite 5 要求 Node 18 以上，Node 16 直接拒绝启动。同时 Vite 的 Node API 的 CommonJS 构建被标记为废弃，用 `require('vite')` 会在控制台打出警告。我们有个用 CommonJS 写的内部脚本调用 `vite.build()` 做多入口打包，改成了 ESM：

```js
// scripts/build-all.mjs
import { build } from 'vite'

const entries = ['admin', 'portal', 'embed']
for (const name of entries) {
  await build({
    configFile: false,
    build: {
      outDir: `dist/${name}`,
      rollupOptions: { input: `src/entries/${name}.ts` },
    },
  })
}
```

如果 `package.json` 没有 `"type": "module"`，文件后缀改成 `.mjs` 就能用 ESM 语法。CJS 构建在 Vite 6 里会彻底移除，这次顺手改掉省得下次再改。

## 冷启动快了多少

Vite 5 对开发服务器的预构建和模块图做了不少优化，官方说法是冷启动更快。我们项目的实测：`vite` 命令从执行到浏览器能打开首页，4.5 平均 4.8 秒，5.4 平均 3.1 秒。第二次启动（有依赖缓存）从 2.1 秒到 1.4 秒。都是在 M1 MacBook 上测的，Windows 同事反馈的提升比例差不多。

有一点要注意：5.0 开始默认把 `.vite` 缓存目录放在 `node_modules/.vite`，和 4.x 一样，但 `build.manifest` 生成的清单文件从 `dist/manifest.json` 挪到了 `dist/.vite/manifest.json`，SSR 清单同理。我们的部署脚本读这个文件做资源注入，路径不改就是构建成功但页面白屏。

## SSR 相关变化

我们的 SSR 入口很简单，但也有两处需要改。

`ssr.format: 'cjs'` 被移除了，SSR 产物只能是 ESM。对应的服务端入口里 `require` 全换成 `import`，`__dirname` 换成 `import.meta.dirname`（Node 20.11 以上）或者手动从 `import.meta.url` 算。

另外 `server.ssrLoadModule` 在处理循环依赖时的行为变严格了，我们有两个 store 互相引用，4.x 时偶尔会得到 `undefined` 但没报错，5.0 直接在开发时抛出异常。这是好事，逼着我们把循环依赖拆掉了。

## 依赖预构建的变化

开发服务器这边还有一个容易被忽略的调整：Vite 5 对依赖预构建的触发时机做了优化，在启动时会先用上一次的结果尝试响应，发现新依赖再在后台重新预构建，而不是像 4.x 那样一发现就整页刷新。实际体验是新装一个依赖之后第一次打开页面不再有那几秒的“正在优化依赖”白屏。

但这也带来一个新现象：某些依赖的 CJS 和 ESM 版本混用时，4.x 会在启动阶段就报错，5.x 可能要到运行时才在浏览器控制台出现 `does not provide an export named` 这类错误。我们有一个老的图表库就是这样，解决办法是把它加进 `optimizeDeps.include` 让 Vite 强制预构建：

```ts
optimizeDeps: {
  include: ['echarts/core', 'echarts/charts', 'echarts/renderers'],
},
```

另外 `optimizeDeps.disabled` 这个在 4.x 用来跳过预构建的选项在 5.x 被标记废弃，官方不再推荐关掉预构建，我们本来就没用，只是提一下。

## 给插件作者的几句

如果你维护着自己写的 Vite 插件，升级前建议专门把插件的用例跑一遍。除了上面说的 Rollup 4 的 AST 变化，还有两个细节：`transform` 钩子的 `ssr` 参数在 5.x 被统一成 `options.ssr`，直接读第三个参数会得到 `undefined`；`configureServer` 里拿到的 `server.moduleGraph` 对 SSR 和客户端的模块现在是分开维护的，4.x 里一些偷懒的写法（只取 `getModuleById` 的结果不区分环境）会漏掉一半模块。我们那个做文档热更新的插件就是因为后者，改完 SSR 侧的文件浏览器不刷新，查了一下午。

## 其他需要改的配置

把官方迁移指南对照着过了一遍，我们实际触发的有这几条：

| 变化                                  | 旧写法                                      | 新写法                                                                    |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `import.meta.glob` 的 `as` 选项废弃   | `import.meta.glob('./*.md', { as: 'raw' })` | `import.meta.glob('./*.md', { query: '?raw', import: 'default' })`        |
| `resolve.browserField` 移除           | `resolve: { browserField: true }`           | `resolve: { mainFields: ['browser', 'module', 'jsnext:main', 'jsnext'] }` |
| `server.https: true` 不再自动生成证书 | `server: { https: true }`                   | 用 `@vitejs/plugin-basic-ssl` 插件                                        |
| `worker.plugins` 改为函数             | `worker: { plugins: [vue()] }`              | `worker: { plugins: () => [vue()] }`                                      |

`import.meta.glob` 那条是我们改动最多的，全项目搜 `as: 'raw'` 出来 14 处，都是加载 Markdown 文档的地方。

配置文件最终的变化不大，贴一下关键部分：

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-ui': ['element-plus'],
        },
      },
    },
  },
  worker: {
    plugins: () => [vue()],
  },
})
```

## 顺便升到 5.4

既然动了，就直接升到了 5.x 的最新小版本 5.4。5.1 之后的几个小版本有两样东西值得一提：

一是 5.4 对 Sass 新编译 API 的支持，`css.preprocessorOptions.scss.api` 设成 `'modern-compiler'`，我们的 SCSS 编译从 2.8 秒降到 1.1 秒，而且不再有 `@import` 的那堆废弃警告刷屏（警告本身还在，只是新 API 走的路径不同，数量少了很多）。

二是 5.1 引入的实验性 Vite Runtime API，用来在服务端跑 Vite 处理过的模块，替代 `ssrLoadModule`。我们没用，因为它在 6.0 里会被重做成 Environment API，现在改了等于白改。

## 迁移清单

还有一个小提醒：升级 Vite 的同时把 `vitest` 也升到配套的版本，我们一开始只升了 Vite，`vitest` 还停在 0.34，结果单测跑起来一堆 `Cannot find module` 的错误，花了半小时才反应过来两者的 Vite 依赖版本不一致。升到 `vitest` 1.x 之后就正常了。

整个过程两个人花了一天半，大部分时间在跑回归而不是改代码。总结成清单：

1. 先升 Node 到 20，确认所有依赖能装。
2. 升 `vite` 和 `@vitejs/plugin-vue` 到最新，跑 `vite` 看控制台警告，逐条处理。
3. 搜 `import.meta.glob` 的 `as`、`browserField`、`server.https`、`worker.plugins`，按上表改。
4. 自定义插件如果用了 Acorn 相关 API，对照 Rollup 4 的变化改。
5. 检查部署脚本里的 `manifest.json` 路径。
6. SSR 项目确认服务端入口是 ESM。
7. 跑完整构建，对比产物体积和构建时间，有异常就查。

我们迁完的数字：生产构建 96 秒到 71 秒，冷启动 4.8 秒到 3.1 秒，产物总体积几乎不变（Rollup 4 的 tree-shaking 略有改进，少了 6KB）。对一个拖了一年的升级来说，这个回报算相当可以了。下周 Vite 6 发布之后我们不会马上跟，等 Environment API 稳定、生态插件跟上再说，但至少这次不会再拖一年。
