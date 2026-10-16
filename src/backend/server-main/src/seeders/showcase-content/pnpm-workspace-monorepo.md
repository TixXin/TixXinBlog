这个博客的仓库从去年开始就是一个 monorepo：`src/frontend/web-blog` 是 Nuxt 站点，`src/backend/server-main` 是 NestJS 服务，另外还有几个共享的工具包。之前两个项目各自一个仓库，每次改接口类型都要在两边各提一次 PR，再手动对齐版本，烦得很。合并成 monorepo 之后用了 pnpm workspace，这一年多下来总体很顺，但也踩了不少坑。趁最近把 pnpm 升到 10 系列，把配置和经验整理一下。

## 为什么是 pnpm

候选其实就三个：npm workspaces、yarn berry、pnpm。npm 的 workspace 功能够用但 hoisting 机制太松，经常出现“A 包没声明依赖 B 却能 import B”的幽灵依赖问题，等某天 B 从别的包里消失了才炸。yarn berry 的 PnP 模式太激进，跟不少工具链不兼容，关掉 PnP 之后又跟 npm 差不多。

pnpm 的 `node_modules` 是用符号链接组织的，每个包只能访问自己 `package.json` 里声明的依赖，幽灵依赖在安装阶段就会暴露。加上内容寻址的全局 store，同一个依赖在磁盘上只存一份，我们 CI 的安装时间从 npm 的 2 分 40 秒降到了 35 秒（有缓存的情况下）。

## 基础配置

根目录三个文件决定了 workspace 的形状：

```yaml
# pnpm-workspace.yaml
packages:
  - 'src/frontend/*'
  - 'src/backend/*'
  - 'packages/*'

catalog:
  typescript: ^5.7.3
  vitest: ^3.0.5
  zod: ^3.24.1
```

`catalog` 是 pnpm 9.5 之后加的功能，解决的是“同一个依赖在多个子包里版本不一致”的问题。子包里写 `"typescript": "catalog:"`，实际版本以根目录为准。升级 TypeScript 的时候改一行就行，不用在六个 `package.json` 里挨个搜。

```jsonc
// 根目录 package.json
{
  "name": "tixxin-blog",
  "private": true,
  "packageManager": "pnpm@10.4.1",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "dev": "pnpm --filter web-blog dev",
    "dev:all": "pnpm -r --parallel --filter './src/**' dev",
    "build": "pnpm -r --filter './src/**' build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r --workspace-concurrency=2 test",
  },
}
```

`packageManager` 字段配合 corepack，保证所有人和 CI 用的是同一个 pnpm 版本。这个字段救过我们一次：有个同事本地装的 pnpm 8，生成的 lockfile 格式跟 9 不一样，提了个几千行的 lockfile diff 上来，加了这个字段之后 corepack 会自动切到指定版本。

`.npmrc` 里几项我觉得必开的：

```ini
# .npmrc
shared-workspace-lockfile=true
link-workspace-packages=true
prefer-workspace-packages=true
strict-peer-dependencies=false
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

`public-hoist-pattern` 是对严格模式的妥协。ESLint 和 Prettier 的各种插件之间会互相 `require`，不提升到根目录 `node_modules` 的话编辑器插件找不到。只放这两个家族，其他一律不提升。

## 子包之间怎么引用

共享的类型和工具放在 `packages/shared`，前后端都通过 `workspace:*` 协议引用：

```json
{
  "dependencies": {
    "@tixxin/shared": "workspace:*"
  }
}
```

安装时 pnpm 会把它链接到本地目录，改了 `packages/shared` 里的代码两边立刻能用，不需要 publish。发布的时候（如果要发布的话）`workspace:*` 会被替换成实际版本号。

但这里有个坑我踩了很久：**共享包要不要先编译**。一开始 `@tixxin/shared` 的 `main` 指向 `dist/index.js`，每次改了源码要先 `pnpm --filter shared build`，不然引用方拿到的是旧代码。后来改成 `exports` 直接指向 `src/index.ts`，让 Vite 和 tsx 这些工具自己处理 TypeScript，开发体验好很多。NestJS 那边因为用的是 tsc 编译，还需要在 `tsconfig.json` 里加 `paths` 映射，并且把 `@tixxin/shared` 加进 `include`。

## filter 的几种用法

`--filter` 是 pnpm 在 monorepo 里最常用的参数，几个我每天都在用的组合：

- `pnpm --filter web-blog dev`：只跑某个包。
- `pnpm --filter "web-blog..." build`：跑 web-blog 和它依赖的所有包，三个点在后面表示“及其依赖”。
- `pnpm --filter "...[origin/main]" test`：只测相对 main 分支有改动的包及其依赖方，CI 里用这个省了一大半时间。
- `pnpm -r --parallel exec rm -rf dist`：在所有包里执行一条 shell 命令。

`-r` 默认是按依赖拓扑顺序串行执行，`--parallel` 则忽略顺序全并行。`build` 必须串行（共享包要先编），`dev` 可以并行。`--workspace-concurrency` 控制并行度，跑 Vitest 的任务我设成 2，不然多个实例同时起来会把内存吃光。

## pnpm 10 的变化

今年年初从 9 升到 10，有两个改动需要注意。

第一，**依赖的 postinstall 脚本默认不再执行**。这是出于供应链安全考虑，但 `esbuild`、`sharp`、`@parcel/watcher` 这类需要下载二进制的包装完直接不能用。解决办法是在根 `package.json` 里显式列出允许的包：

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild", "sharp", "@parcel/watcher"]
  }
}
```

第一次升级的时候我没注意，CI 全绿，部署上去 Nuxt 启动报 esbuild 找不到二进制，查了半小时。

第二，lockfile 版本升到了 9.0 格式，10 系列能读旧格式但会重写。升级那次提交的 lockfile diff 很大，建议单独一个 commit，不要跟业务改动混在一起。

## 部署时只打包需要的东西

Docker 构建时整个 monorepo 的 `node_modules` 有 800 多 MB，而后端运行时真正需要的不到 120MB。`pnpm deploy` 可以把某个包连同它的生产依赖抽取到一个独立目录，里面是真实文件不是符号链接：

```bash
pnpm --filter server-main deploy --prod /app/out
```

Dockerfile 里用多阶段构建，第一阶段完整安装并构建，第二阶段只复制 `/app/out`。镜像从 1.1GB 降到了 310MB。注意 `deploy` 要求 `inject-workspace-packages=true` 或者共享包有 `files` 字段，不然 `workspace:*` 的包会被漏掉。

## 几个零散的坑

除了上面提到的，还有几件事花过我不少时间，记下来省得以后再查。

**CI 缓存要缓存 store 而不是 node_modules。** 一开始我在 GitHub Actions 里缓存的是各个子包的 node_modules 目录，结果缓存体积很大、命中率却不高，因为符号链接在打包缓存时会被展开成真实文件。后来改成只缓存 pnpm store 的目录，再配合 lockfile 的哈希做缓存键，安装阶段基本稳定在半分钟以内。

**重复的 Vue 实例。** 共享包里如果把 vue 声明在 dependencies 而不是 peerDependencies，pnpm 会给它单独装一份，于是页面里同时存在两个 Vue，组件注入全部失效，报错信息还看不出原因。排查了一个下午才想到用 pnpm why vue 看依赖路径。现在所有共享包里的框架类依赖一律放 peerDependencies，并且在根目录统一版本。

**git hooks 的路径问题。** husky 和 lint-staged 装在根目录，但各子包有自己的 ESLint 配置。lint-staged 默认会在文件所在的最近一个 package.json 目录里执行命令，这个行为在 monorepo 里刚好是对的，但前提是每个子包的 scripts 里都要有 lint 命令，少一个就会在提交时报“命令不存在”。

**安装时偶尔报 ERR_PNPM_PEER_DEP_ISSUES。** 这是因为某些上游包的 peer 范围写得太窄，并不是真的不兼容。我把 strict-peer-dependencies 关了，只在升级大版本的时候手动跑一次 pnpm install --strict-peer-dependencies 看看有没有真正的问题。关掉之后安装日志安静了很多，也没出过事。

## 还没解决干净的事

- 子包各自的 `tsconfig.json` 继承根目录的，但 Nuxt 会自动生成一份 `.nuxt/tsconfig.json`，两套配置偶尔打架，目前靠约定不在子包里重复声明 `paths`。
- `pnpm update --interactive --latest` 在有 catalog 的情况下不会更新 catalog 里的版本，得手动改 `pnpm-workspace.yaml`。
- 同一个依赖在不同子包里 peer 版本不同时，pnpm 会装两份，`pnpm why` 能看出来但解决起来还是要人判断。

整体来说，pnpm workspace 对我们这种“两三个应用加几个共享包”的小型 monorepo 已经非常够用，不需要再上 Nx 或 Turborepo。等某天构建时间长到需要远程缓存了再说。
