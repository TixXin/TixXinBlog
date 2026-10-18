/**
 * @file accessibility.spec.ts
 * @description 隔离公开页面的三主题、明暗模式 axe 回归，阻断 critical 与 serious 问题
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

type AxeViolation = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>['violations'][number]
type AxeNode = AxeViolation['nodes'][number]

interface PublicPage {
  name: string
  path: string
  content: string[]
}

interface AllowedViolation {
  /** axe 规则 id，例如 color-contrast */
  id: string
  /** axe 节点 target 中的一条选择器，必须精确匹配；只豁免这个节点 */
  target: string
  /** 对应用例的 path，包含查询字符串；省略则不限页面 */
  path?: string
  theme?: 'nexus' | 'dock' | 'aurora'
  colorMode?: 'light' | 'dark'
  /** 暂时接受的具体原因和后续修复事项，不能为空 */
  reason: string
}

// 复用 browser-runner 准备的真实样本；每个页面单独执行，避免一次测试累积所有扫描的耗时。
const publicPages: PublicPage[] = [
  { name: '文章首页', path: '/', content: ['.articles-page .post-item'] },
  { name: '文章详情', path: '/articles/1', content: ['.article-markdown'] },
  { name: '文章归档', path: '/archive', content: ['.archive-page a[href^="/articles/"]'] },
  { name: '朋友圈', path: '/moments', content: ['.moment-card'] },
  { name: '画廊', path: '/gallery', content: ['button[aria-label^="查看照片："]'] },
  { name: '项目', path: '/projects', content: ['[data-project-id]'] },
  { name: '友链', path: '/links', content: ['[data-link-id]'] },
  { name: '留言板', path: '/guestbook', content: ['[data-guestbook-id]'] },
  { name: '图片提示词', path: '/prompts', content: ['[data-prompt-id]'] },
  {
    name: '平台订阅费',
    path: '/subscriptions?currency=USD',
    content: ['article[aria-label="ChatGPT Plus"]', '[data-subscription-chart][data-chart-ready="true"]'],
  },
  {
    name: '站内搜索结果',
    path: `/search?q=${encodeURIComponent('分页样本')}&type=post`,
    content: ['.search-page__group[data-search-type="post"] li'],
  },
  // 隔离运行器没有注入闪念，明确验证真实空态，不将其视为有内容的闪念详情覆盖。
  { name: '闪念空态', path: '/flash', content: ['.flash-note-list__empty'] },
  { name: '关于我', path: '/about', content: ['.about-body h1'] },
  { name: '书签', path: '/tabs', content: ['.tabs-page__storage-note'] },
]

/**
 * 当前没有经维护者接受的 critical / serious 豁免，所以清单为空。
 * 新增时必须写明规则、精确节点和 reason，并尽量限定页面、主题与明暗模式。
 * 不能用 disableRules、exclude 整块页面或空 target 代替。
 */
const allowedViolations: AllowedViolation[] = []

function applies(entry: AllowedViolation, pagePath: string, theme: string, colorMode: 'light' | 'dark') {
  return (
    (!entry.path || entry.path === pagePath) &&
    (!entry.theme || entry.theme === theme) &&
    (!entry.colorMode || entry.colorMode === colorMode)
  )
}

function exemptNode(node: AxeNode, pagePath: string, theme: string, colorMode: 'light' | 'dark', ruleId: string) {
  return allowedViolations.some(
    (entry) => entry.id === ruleId && applies(entry, pagePath, theme, colorMode) && node.target.includes(entry.target),
  )
}

function blockingNodes(violation: AxeViolation, pagePath: string, theme: string, colorMode: 'light' | 'dark') {
  if (violation.impact !== 'critical' && violation.impact !== 'serious') return []
  return violation.nodes.filter((node) => !exemptNode(node, pagePath, theme, colorMode, violation.id))
}

for (const theme of ['nexus', 'dock', 'aurora'] as const) {
  for (const colorMode of ['light', 'dark'] as const) {
    test.describe(`公开页面可访问性 ${theme}/${colorMode}`, () => {
      test.use({ colorScheme: colorMode, reducedMotion: 'reduce' })

      test.beforeEach(async ({ context, baseURL }) => {
        expect(process.env.E2E_ISOLATED).toBe('true')
        await context.addCookies([{ name: 'blog-layout-theme', value: theme, url: baseURL! }])
        await context.addInitScript((mode) => localStorage.setItem('nuxt-color-mode', mode), colorMode)
      })

      for (const target of publicPages) {
        test(target.name, async ({ page }, testInfo) => {
          const incompleteEntries = allowedViolations.filter(
            (entry) => !entry.id.trim() || !entry.reason.trim() || !entry.target.trim(),
          )
          expect(incompleteEntries, '允许清单的每一项都要写明规则、节点和理由').toEqual([])

          const response = await page.goto(target.path)
          expect(response?.ok(), `${target.path} 应返回成功页面`).toBe(true)
          await expect(page.locator('html')).toHaveClass(/app-client-ready/)
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${colorMode}\\b`))
          await expect(page.locator('html')).toHaveCSS('opacity', '1')
          await expect(page.locator(`.theme-${theme}`)).toBeVisible()
          await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
          await expect(page.locator('[data-page-motion-overlay]')).toHaveCount(0)

          // 标题或布局壳层出现不代表请求完成；防止加载态、错误页或空列表使扫描虚假通过。
          for (const selector of target.content) await expect(page.locator(selector).first()).toBeVisible()
          await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
          await expect(page.locator('.request-feedback [role="alert"], .comment-section__error')).toHaveCount(0)
          await page.evaluate(() => document.fonts.ready.then(() => undefined))

          // 扫描整页，包含主题导航、侧栏和页脚。默认规则全部开启，不排除节点。
          const results = await new AxeBuilder({ page }).analyze()
          await testInfo.attach('axe-results', {
            body: JSON.stringify(results, null, 2),
            contentType: 'application/json',
          })
          const blocking = results.violations
            .map((violation) => ({
              id: violation.id,
              impact: violation.impact,
              help: violation.help,
              nodes: blockingNodes(violation, target.path, theme, colorMode).map((node) => ({
                target: node.target,
                html: node.html,
                failureSummary: node.failureSummary,
              })),
            }))
            .filter((violation) => violation.nodes.length > 0)
          const stale = allowedViolations.filter((entry) => {
            if (!applies(entry, target.path, theme, colorMode)) return false
            return !results.violations.some(
              (violation) =>
                violation.id === entry.id &&
                (violation.impact === 'critical' || violation.impact === 'serious') &&
                violation.nodes.some((node) => node.target.includes(entry.target)),
            )
          })
          expect(stale, `${theme}/${colorMode} ${target.path} 的允许清单条目已不再命中，应删除过期豁免`).toEqual([])
          expect(blocking, `${theme}/${colorMode} ${target.path} 不应存在 critical 或 serious 问题`).toEqual([])
        })
      }
    })
  }
}
