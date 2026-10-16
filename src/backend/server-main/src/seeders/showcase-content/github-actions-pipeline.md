两年前这个博客的部署流程是这样的：本地 `pnpm build`，打开 FileZilla，把 `.output` 目录拖到服务器，然后 ssh 上去 `pm2 restart`。有一次拖到一半网断了，服务器上是半个新版本半个旧版本，首页白屏了二十分钟。那天晚上我把这套流程换成了 GitHub Actions，到现在两年没再碰过 FTP。

这篇把我现在用的流水线完整写一遍。全程只用 GitHub 免费额度和一台自己的小服务器，公开仓库 Actions 不限时长，私有仓库每月 2000 分钟，博客这种一次构建四五分钟的项目，一个月推五十次也用不完。

## 为什么不用托管平台

有朋友问过，为什么不直接把前端丢到 Vercel 或者 Cloudflare Pages，推送就自动部署，什么都不用配。我试过一段时间，主要有两个原因退回来了：一是博客有自己的后端和数据库，前后端拆在两个地方以后，跨域、内网调用、日志都要分别处理，反而更麻烦；二是国内访问托管平台的速度不稳定，有时候首屏要等三四秒。自己的服务器在深圳，延迟是十几毫秒。所以我的目标不是“零运维”，而是“推送之后不用管”，GitHub Actions 加一台自己的机器刚好够用。

## 先把部署这件事拆开

自动化之前先想清楚手动时在做什么。我的博客是 Nuxt 前端加 NestJS 后端，两个目录在一个 monorepo 里，部署分成四步：

1. 安装依赖并跑 lint 和单测，挂了就不往下走。
2. 构建前端和后端，产出两个可以独立运行的目录。
3. 把产物传到服务器指定路径。
4. 在服务器上切换软链接并重启进程。

第三步和第四步是手动时代最容易出问题的，所以流水线的重点是让它们原子化：新版本先完整上传到一个带时间戳的目录，全部就绪后再把 `current` 软链接指过去，重启。失败了软链接不动，线上还是旧版本。

## 工作流文件

仓库里新建 `.github/workflows/deploy.yml`。先看触发条件和检查阶段：

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 25
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm --filter web-blog test
      - run: pnpm --filter server-main test
```

几个细节。`concurrency` 保证同一时间只有一条部署在跑，连续推两次不会出现两个 job 同时往服务器写文件；`cancel-in-progress` 设成 `false` 是因为部署到一半被取消比排队更危险。`setup-node` 的 `cache: pnpm` 要放在 `pnpm/action-setup` 之后，不然它找不到 pnpm 的 store 路径。`workflow_dispatch` 留着是为了能在网页上手动点一次，回滚或者重新部署时很方便。

构建阶段依赖检查阶段，产物通过 `upload-artifact` 传到下一个 job：

```yaml
build:
  needs: check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9.15.0
    - uses: actions/setup-node@v4
      with:
        node-version: 25
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
      env:
        NUXT_PUBLIC_SITE_URL: ${{ vars.SITE_URL }}
    - run: pnpm --filter server-main build
    - run: tar -czf release.tgz src/frontend/web-blog/.output src/backend/server-main/dist
    - uses: actions/upload-artifact@v4
      with:
        name: release
        path: release.tgz
        retention-days: 3
```

把两个产物打成一个压缩包再上传，比分别上传几千个小文件快得多。我测过，直接上传 `.output` 目录要 1 分 40 秒，打包后只要 12 秒。`retention-days` 设短一点，免得占用仓库的存储额度。

## 部署到自己的服务器

部署 job 需要 ssh 到服务器。密钥放在仓库的 Secrets 里，服务器上建一个专门的 `deploy` 用户，只给它目标目录的写权限和重启服务的 sudo 权限，别用 root。

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: release
    - name: 准备 ssh
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.DEPLOY_KEY }}" > ~/.ssh/id_ed25519
        chmod 600 ~/.ssh/id_ed25519
        ssh-keyscan -H ${{ secrets.DEPLOY_HOST }} >> ~/.ssh/known_hosts
    - name: 上传并切换
      run: |
        RELEASE=$(date +%Y%m%d%H%M%S)
        scp release.tgz deploy@${{ secrets.DEPLOY_HOST }}:/srv/blog/releases/$RELEASE.tgz
        ssh deploy@${{ secrets.DEPLOY_HOST }} "bash -s" <<EOS
          set -euo pipefail
          cd /srv/blog/releases
          mkdir $RELEASE && tar -xzf $RELEASE.tgz -C $RELEASE && rm $RELEASE.tgz
          ln -sfn /srv/blog/releases/$RELEASE /srv/blog/current
          sudo systemctl restart blog-web blog-api
          ls -dt /srv/blog/releases/*/ | tail -n +6 | xargs -r rm -rf
        EOS
```

最后一行保留最近 5 个版本，回滚只需要把软链接指回上一个目录再重启，不用重新构建。`set -euo pipefail` 是必须的，不然远端某一步失败了 ssh 还是会返回 0，流水线显示绿色但线上已经坏了。`environment: production` 配合仓库设置里的环境保护规则，可以要求部署前人工批准，我没开，但给团队项目用的时候建议开。

## 几个踩过的坑

- `ssh-keyscan` 那行一开始我没加，Actions 的 runner 每次都是新机器，没有 `known_hosts`，ssh 会卡在指纹确认直到超时。
- 服务器上的 `.env` 不要放进仓库，也不要通过 Actions 上传。它应该是服务器上的固定文件，每个版本目录通过软链接引用它，这样换版本不用重新配置。
- Nuxt 构建时如果用到了 `process.env`，那些值在构建阶段就得给到，所以 `NUXT_PUBLIC_SITE_URL` 放在 build job 而不是 deploy job。
- 构建缓存是双刃剑。`setup-node` 的 pnpm 缓存只缓存 store，`node_modules` 还是要重新链接，这一步大概 20 秒，可以接受。我试过缓存整个 `node_modules`，偶尔会遇到原生依赖和 runner 镜像版本不匹配，最后放弃了。
- 时区。runner 是 UTC，`date` 生成的版本号和我本地时间差 8 小时，一开始对版本目录的时候一直对不上。要么在 job 里设 `TZ: Asia/Shanghai`，要么干脆接受 UTC，别两边混着用。
- 磁盘。`releases` 目录如果不定期清理，几十个版本加起来会有好几个 G，小服务器很快就满了。保留数量写进脚本比靠记忆靠谱。
- 第一次跑通后记得去仓库 Settings 把 Actions 权限改成只允许本仓库和官方的 action，第三方 action 用 commit hash 固定版本，这是今年几次供应链事件之后养成的习惯。

## 回滚和通知

回滚我做成了另一个工作流，只接受 `workflow_dispatch`，输入一个版本目录名，脚本把软链接指过去再重启。因为不需要构建，整个过程不到 20 秒。版本目录名就是部署时的时间戳，在 Actions 的运行日志里能直接看到，也可以 ssh 上去 `ls /srv/blog/releases` 查。我真正用到它只有一次，是一篇文章里的代码高亮插件升级后在旧版 Safari 上报错，回滚之后花了一晚上慢慢排查，比在线上硬修从容得多。

通知这块我没有接任何聊天工具，只是在 deploy job 最后加了一步，失败时用 `if: failure()` 触发，往我自己的 Bark 服务发一条推送。成功的部署不通知，因为成功是常态，常态不需要打扰人。失败的推送里带上 run 的链接，手机上点开就能看日志。

还有一个小技巧是给 PR 开一条只跑 `check` 的工作流，触发条件写 `pull_request`，这样改动在合并前就能看到 lint 和单测结果，合并到 `main` 之后的部署基本不会在第一步挂掉。两条工作流共用同一套安装和缓存步骤，我用 composite action 把重复的几步抽到了 `.github/actions/setup` 里，改 Node 版本只要改一个地方。

## 一些数字

现在从推送到线上生效，整个流水线平均 4 分 30 秒，其中安装依赖 50 秒、检查 1 分 10 秒、构建 1 分 50 秒、部署 30 秒。两年里跑了 300 多次，失败的二十几次全部是 lint 或单测没过，被拦在了第一个 job，没有一次把坏版本推到线上。

更重要的变化是心理上的。以前每次发布都要找个精神好的时候，现在写完文章 `git push` 就去倒水，回来已经上线了。自动化真正省下的不是那五分钟，是每次发布前那种“希望别出事”的紧张感。
