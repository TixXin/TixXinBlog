博客后台的端到端测试这件事我拖了快一年。原因很实际：以前在公司用 Cypress 写过一套，维护成本高到最后没人敢动，所以对 E2E 这三个字母有心理阴影。这个月终于下决心把博客的后台用 Playwright 搭了一套，从零开始，目前 38 个用例，CI 上跑完四分钟出头。这篇把选型的理由、搭建过程和踩过的坑整理一下。

## 为什么是 Playwright

三个候选我都实际用过一段时间，直接说结论。

Puppeteer 本质上是一个浏览器控制库，不是测试框架。它没有断言、没有测试运行器、没有重试和报告，这些全要自己拼。拿它写爬虫很合适，写测试就要自己造一半轮子。而且它只对 Chromium 是一等公民，Firefox 支持一直是实验性质。

Cypress 的问题是架构。它的测试代码跑在浏览器里面，和被测页面同源，这带来两个绕不开的限制：跨域跳转很麻烦（虽然后来有了 `cy.origin`，但写法很别扭），多标签页基本不支持。另外它的命令链是异步队列而不是真正的 Promise，`cy.get().then()` 和原生 `await` 混用的时候经常出现执行顺序和直觉不一致的情况，这是我上一套测试难以维护的主要原因之一。

Playwright 的测试代码跑在 Node 里，通过协议控制浏览器，所以上面两个限制天然不存在。Chromium、Firefox、WebKit 三个引擎用同一套 API，配置里加一行就能三个都跑。API 设计上全是标准的 `async/await`，没有任何魔法。最让我满意的是定位器（Locator）的设计：`page.getByRole('button', { name: '保存' })` 这种写法既贴近用户视角，又自带等待和重试，不需要像以前那样到处写 `waitFor`。

还有一点是 trace viewer。测试失败的时候它能把整个执行过程录下来，包括每一步的 DOM 快照、网络请求和控制台日志，在本地打开就能逐步回放。这个功能对于 CI 上偶发失败的排查价值极大，我后面会专门说。

## 从零搭建

项目用的是 pnpm，初始化一行命令：

```bash
corepack pnpm create playwright
```

它会问几个问题：测试目录放哪、要不要 GitHub Actions 工作流、要不要装浏览器。装完之后项目里多了 `playwright.config.ts` 和一个 `tests/` 目录。我把测试目录改成了 `tests/e2e/`，和已有的单元测试目录区分开。

配置文件我改动比较大的几处：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.artifacts/e2e/auth.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: '.artifacts/e2e/auth.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'corepack pnpm dev:all',
    url: 'http://localhost:3000/api/ready',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

几个点解释一下。`trace: 'on-first-retry'` 的意思是第一次失败重试时才录 trace，正常跑不录，避免拖慢速度和占磁盘。`locale` 和 `timezoneId` 固定下来是因为后台有日期显示，不固定的话本地和 CI 结果会不一样。`webServer` 让 Playwright 自己负责启动开发服务，`url` 指向后端的就绪探针，没就绪就一直等，这样 CI 上不用再手写启动和等待脚本。

## 登录只做一次

后台所有页面都要登录，如果每个用例都走一遍登录流程，38 个用例就要登 38 次。Playwright 的标准做法是把登录做成一个 `setup` 项目，登录成功后把浏览器状态（主要是 cookie）存到文件里，其他项目通过 `storageState` 直接复用。

```ts
import { test as setup, expect } from '@playwright/test'

const authFile = '.artifacts/e2e/auth.json'

setup('登录后台', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('用户名').fill(process.env.E2E_ADMIN_USER!)
  await page.getByLabel('密码').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible()
  await page.context().storageState({ path: authFile })
})
```

账号用的是一个专门给 E2E 建的管理员，连的是一个独立的 E2E 专用数据库，不碰开发库。这个在配置里通过环境变量区分，CI 上用 secrets 注入。

## 用例怎么写

一个实际的用例，测文章列表的筛选和发布状态切换：

```ts
import { test, expect } from '@playwright/test'

test.describe('文章管理', () => {
  test('按草稿状态筛选并发布', async ({ page }) => {
    await page.goto('/admin/posts')
    await page.getByRole('combobox', { name: '状态' }).selectOption('draft')
    const rows = page.getByRole('row').filter({ hasText: '草稿' })
    await expect(rows.first()).toBeVisible()

    const firstTitle = await rows.first().getByRole('link').textContent()
    await rows.first().getByRole('button', { name: '发布' }).click()
    await expect(page.getByText('已发布')).toBeVisible()

    await page.getByRole('combobox', { name: '状态' }).selectOption('published')
    await expect(page.getByRole('row').filter({ hasText: firstTitle! })).toBeVisible()
  })
})
```

写用例的几条自己定的规矩：

- 优先用 `getByRole`、`getByLabel`、`getByText`，不用 CSS 选择器。这样一来测试和 DOM 结构解耦，二来写不出 `getByRole` 的地方往往就是无障碍做得不好的地方，顺便暴露问题。
- 不写 `page.waitForTimeout`。所有等待都通过 `expect(locator).toBeVisible()` 这类自带重试的断言来表达。
- 每个用例自己准备数据、自己清理，不依赖其他用例的执行顺序。`fullyParallel` 开着的情况下顺序是没有保证的。
- 涉及写入的用例用带时间戳的标题，避免并行时互相撞。

## 本地开发时怎么跑

本地我基本只用两个命令。一个是 `playwright test --ui`，会打开一个带时间轴的图形界面，可以单独跑某个用例、看每一步的截图、边改代码边重跑，比盯着终端输出舒服得多。另一个是 `playwright codegen http://localhost:3000/admin`，它会打开浏览器录制你的操作并实时生成代码。生成的代码我从来不直接用，定位器经常选得不够好，但用它来快速确认某个元素应该用什么 role 和 name 来找，比自己翻 DOM 快。

还有一个习惯是把 HTML 报告和 trace 文件统一输出到 `.artifacts/e2e/` 下面，这个目录在 `.gitignore` 里，CI 上作为构建产物上传，失败的时候下载下来本地打开就能回放，不用再去 CI 日志里翻。

## 踩过的坑

**偶发失败。** 一开始有两个用例在 CI 上大约十次失败一次，本地从来复现不了。打开 trace 之后发现是点击“保存”后页面有一个 200 毫秒的淡出动画，断言在动画中间跑了，元素是半透明的，`toBeVisible` 判定通过但下一步点击落空。解决办法是在测试环境里通过一个环境变量关掉过渡动画。没有 trace 的话这种问题可能要猜一个星期。

**WebKit 的差异。** Safari 内核对 `<input type="date">` 的处理和 Chromium 不一样，`fill('2026-06-01')` 在 WebKit 上不生效。最后改成用 `page.keyboard.type` 逐字输入，两边都通过。这也是跨浏览器跑的价值，不跑永远不知道。

**CI 时间。** 最初三个浏览器全跑，CI 要十一分钟。后来改成 PR 只跑 Chromium，合并到主分支后再跑全部，PR 的反馈时间降到四分钟左右。

**数据库隔离。** 测试用例会创建文章、修改设置，不能跑在开发库上。我给 E2E 单独起了一个数据库，`webServer` 的启动命令里通过环境变量指定，跑完不清库，下次跑之前用一个脚本重置到快照。这部分花的时间比写测试本身还多，但省不掉。

搭完这一套之后，我把后台最常用的十几条操作路径都盖住了，上周改图库上传逻辑的时候 CI 直接拦下了一个我自己没注意到的回归。这大概就是 E2E 该有的样子：平时不吵，出事的时候在。至于当年那套 Cypress，我现在更倾向于认为问题不全在工具，一半在我当时没有把登录复用、数据隔离这些基础打好。这次先把地基做扎实，再往上堆用例。
