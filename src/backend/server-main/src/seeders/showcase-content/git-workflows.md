上周团队里一个新同事问我：“为什么我们的仓库只有 main 一个长期分支，我上家公司有 develop、release、hotfix 一大堆？”我说因为我们两年前把 GitFlow 废掉了。他接着问为什么，我发现自己讲了二十分钟还没讲清楚。这篇文章就是那二十分钟的整理版。

先说结论：这两种工作流没有谁对谁错，它们是在回答不同的问题。GitFlow 回答的是“怎么同时维护多个版本”，Trunk-Based 回答的是“怎么让代码尽快进主干”。你的团队更需要哪个答案，就该用哪个。

## GitFlow 长什么样

GitFlow 是 2010 年左右被提出来的，核心是两条长期分支加三类临时分支：

- `main`：只放已经发布的版本，每个提交对应一个 tag。
- `develop`：日常开发的集成分支。
- `feature/*`：从 `develop` 切出来，做完合回 `develop`。
- `release/*`：准备发版时从 `develop` 切出来，只修 bug，测完同时合进 `main` 和 `develop`。
- `hotfix/*`：线上出问题时从 `main` 切出来，修完同时合进 `main` 和 `develop`。

我 2021 年在上一家公司就是这么干的。典型的一次发版流程大概是这样：

```bash
# 开始准备 2.3.0 版本
git checkout develop
git checkout -b release/2.3.0

# 测试期间只修 bug，提交若干次……

# 测完了，合进 main 打 tag
git checkout main
git merge --no-ff release/2.3.0
git tag -a v2.3.0 -m "release 2.3.0"

# 把 release 期间的修复同步回 develop
git checkout develop
git merge --no-ff release/2.3.0
git branch -d release/2.3.0
```

这套流程最大的优点是**清晰**：任何时候你看一眼分支名就知道代码处在哪个阶段，`main` 上永远是能跑的版本。对于需要同时维护 2.2 和 2.3 两个版本、给不同客户打不同补丁的产品来说，这是刚需。

但它的代价也很实在。那家公司的 `develop` 和 `main` 经常差几十个提交，`release` 分支一开就是两周，期间 `develop` 上新功能继续合，等 `release` 合回去的时候冲突一堆。更麻烦的是 `hotfix` 要往两边合，我见过不止一次有人只合了 `main` 忘了 `develop`，下个版本发出去 bug 又回来了。

## Trunk-Based 长什么样

Trunk-Based Development 的核心只有一句话：所有人都往同一条主干提交，分支活不过一两天。具体到我们现在的做法：

- 只有 `main` 一条长期分支，随时可发布。
- 功能分支从 `main` 切出来，一般当天或第二天就合回去，PR 不超过 400 行改动。
- 没做完的功能用 Feature Flag 藏起来，代码先合，开关后开。
- 发版就是在 `main` 上打 tag，CI 自动部署。
- 线上有 bug 直接在 `main` 上修，然后再打一个 tag。

“没做完也合”是新同事最难接受的一点。他的直觉是代码没写完就不该进主干。但 Trunk-Based 的逻辑是：代码进主干和功能对用户可见是两件事，前者靠 CI 保证不破坏现有行为，后者靠开关控制。我们的开关实现很朴素，就是一个配置表加一个 composable：

```ts
// composables/useFeatureFlag.ts
const flags: Record<string, boolean> = {
  newEditor: process.env.NUXT_PUBLIC_FLAG_NEW_EDITOR === 'true',
  galleryV2: process.env.NUXT_PUBLIC_FLAG_GALLERY_V2 === 'true',
}

export function useFeatureFlag(name: keyof typeof flags) {
  return flags[name] ?? false
}
```

新编辑器那个功能我们前后合了二十多个 PR 进主干，用户一直看不到，直到最后一个 PR 把开关打开。中间任何一个 PR 出问题都能单独回滚，不会牵连别的改动。

CI 这边要求比 GitFlow 时期严格得多，因为 `main` 必须随时可发布。我们的流水线大致是这样：

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build

  deploy:
    needs: check
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

PR 必须过 `check` 才能合，打 tag 才触发 `deploy`。这两条规则加上分支保护，基本就是 Trunk-Based 的全部基础设施。

## 两者的真正区别

很多对比文章会列一张优缺点表，我觉得那种表格容易让人以为是在选工具，其实是在选**团队的工作方式**。核心差异有三个：

| 维度           | GitFlow                  | Trunk-Based          |
| -------------- | ------------------------ | -------------------- |
| 集成频率       | 按版本，几天到几周       | 按 PR，每天多次      |
| 分支寿命       | release 分支常活一到两周 | 一般不超过两天       |
| 质量保障靠什么 | 发版前的集中测试         | 每个 PR 的自动化测试 |
| 适合的发布节奏 | 固定版本号，多版本并存   | 持续发布，只维护最新 |
| 对 CI 的依赖   | 低，没 CI 也能跑         | 高，CI 不稳就玩不转  |

第三行是关键。GitFlow 的质量来自 `release` 分支那段集中测试期，Trunk-Based 的质量来自每个 PR 都被自动化测试检查过。如果你的团队没有像样的自动化测试，硬上 Trunk-Based 的结果就是 `main` 天天坏。我们切换前花了两个月把单测覆盖率从不到 20% 补到了 60% 以上，这才敢动。

## 我们为什么换

2023 年初换的时候，直接原因是一次发版事故：`release` 分支测了十天，合进 `main` 的时候和 `develop` 冲突了三十多个文件，解决冲突的人改错了一处，线上出了问题。复盘的时候大家发现，`develop` 和 `main` 之间的差距才是风险本身，分支活得越久，合并越可怕。

换完之后最直观的变化是发版从一件大事变成了一件小事。以前发版要拉群、定时间、写公告，现在打个 tag 的事，一周发四五次很正常。PR 变小之后 review 也认真了，以前一个 PR 两千行没人看得完，现在三百行以内，review 意见反而多了。

切换过程中也踩了几个坑。第一个是回滚的习惯要重新建立：GitFlow 时期出问题是切 `hotfix` 分支慢慢修，Trunk-Based 下我们定的规矩是先 `git revert` 出问题的 PR 让主干恢复，再另开 PR 修，因为主干多坏一小时就多一小时没人能发版。第二个是提交信息，分支寿命短了之后，提交历史就是唯一的上下文，我们开始强制 Conventional Commits，并且要求 PR 描述里写清楚为什么改而不只是改了什么。第三个是心理上的，头两周大家合代码都小心翼翼，生怕弄坏主干，后来发现 CI 真的能拦住绝大多数问题，才慢慢放开手脚。

还有一件事我们没做好：数据库迁移。代码可以用开关藏起来，但迁移脚本一合进主干就会在下次部署时执行，没法藏。后来我们定了“先加后删”的原则，新字段先加上并兼容旧逻辑，等旧代码全部下线再删旧字段，一次迁移拆成两到三个 PR 分开上。这比 GitFlow 时期一次 `release` 带一大包迁移要麻烦一点，但出事的概率小了很多。

但我也要说，Trunk-Based 不是对所有团队都合适。如果你做的是需要给客户锁定版本的企业软件，或者团队里有大量外包、没法保证 CI 质量，GitFlow 那种“慢但稳”的节奏可能更合适。我们是做一个持续更新的 Web 产品，用户永远用最新版，这才是 Trunk-Based 能落地的前提。

回到那位新同事的问题。我最后给他的答案是：分支策略是团队能力的一面镜子，GitFlow 用流程弥补测试不足，Trunk-Based 用测试换掉流程。我们现在有能力选后者，但这个能力是花了两个月补出来的，不是切个分支模型就自动有的。
