/**
 * @file setup-wizard.spec.ts
 * @description 浏览器初始化向导：不预置管理员的隔离库中，从登录页引导、凭令牌创建账号、登录，到向导永久关闭与不被索引
 *              由 browser-runner 以 E2E_SETUP_WIZARD=true 的独立隔离库运行，不与其他测试文件共用数据库
 */
import { expect, test } from '@playwright/test'

test.skip(process.env.E2E_SETUP_WIZARD !== 'true', '需要 browser-runner 的初始化向导隔离模式')

const owner = {
  username: 'wizard-owner',
  password: 'wizard-password-2026',
  siteName: '夜读札记',
  title: '写字的人',
  email: 'owner@example.com',
  github: 'https://github.com/wizard-owner',
}

// 按声明顺序运行：英文用例在初始化完成之前，验证英文文案与后端错误随界面语言返回。
test('英文界面：向导文案、密码要求与令牌错误均为英文', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  await context.addCookies([{ name: 'blog-locale', value: 'en', url: baseURL! }])
  const page = await context.newPage()
  try {
    await page.goto(`/setup?token=${'0'.repeat(64)}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to TixXinBlog' })).toBeVisible()
    await expect(page).toHaveURL(/\/setup$/)
    await page.getByRole('textbox', { name: 'Username' }).fill('english-owner')
    await page.getByLabel('Password', { exact: true }).fill('english-password-2026')
    await page.getByLabel('Confirm password').fill('english-password-2026')
    await expect(page.locator('#setup-password-rules li').nth(0)).toContainText('6–128 characters')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your profile' })).toBeVisible()
    await page.getByRole('button', { name: 'Create owner account' }).click()
    // 令牌在最终提交时才校验：被拒后回到第一步。
    await expect(page.getByRole('alert')).toHaveText(
      'The setup token is invalid. Check the link printed when installation finished.',
    )
    // 令牌被拒后展开令牌输入框并聚焦，便于手动更正。
    await expect(page.getByRole('textbox', { name: 'Setup token' })).toBeFocused()
    await expect(page.getByRole('textbox', { name: 'Setup token' })).toHaveAttribute('aria-invalid', 'true')
    // 令牌错误不创建账号，向导仍开放。
    expect((await (await page.request.get('/api/v1/setup/status')).json()).data).toEqual({ needsSetup: true })
  } finally {
    await context.close()
  }
})

test('向导完整流程：首页与登录页引导、令牌移出地址栏、创建账号并自动登录，完成后向导不可再用', async ({
  page,
  request,
}) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const token = process.env.E2E_SETUP_TOKEN!
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))

  // 默认允许收录：robots 只屏蔽向导等私有路径，sitemap 不收录 /setup。
  const indexableRobots = await (await request.get('/robots.txt')).text()
  expect(indexableRobots).toMatch(/^Disallow: \/setup$/m)
  expect(indexableRobots).not.toMatch(/^Disallow: \/$/m)
  const indexableSitemap = await request.get('/sitemap.xml')
  expect(indexableSitemap.ok()).toBe(true)
  expect(await indexableSitemap.text()).not.toContain('/setup')

  // 尚未初始化：状态接口为 true，后台登录页给出前往向导的入口。
  expect((await (await request.get('/api/v1/setup/status')).json()).data).toEqual({ needsSetup: true })
  // 首页在浏览器端提示尚未初始化，服务端直出的 HTML 不含该提示，不会进入页面缓存。
  expect(await (await request.get('/')).text()).not.toContain('站点尚未完成初始化')
  await page.goto('/')
  // 提示以全屏半透明水印呈现，不拦截页面点击。
  const pending = page.getByRole('status').filter({ hasText: '站点尚未完成初始化' })
  await expect(pending).toBeVisible()
  await expect(pending).toHaveCSS('pointer-events', 'none')
  await page.goto('/admin/login')
  await expect(page.getByText('站点还没有博主账号。')).toBeVisible()
  await page.getByRole('link', { name: '前往初始化向导' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('heading', { level: 1, name: '欢迎使用 TixXinBlog' })).toBeVisible()

  // 服务端直出的 HTML 不回显地址里的令牌（规范地址、分享元数据与水合数据都不含查询串）。
  const html = await (await request.get(`/setup?token=${token}`)).text()
  expect(html).not.toContain(token)

  // 安装链接带令牌：页面不缓存、不索引、不外传来源；令牌预填后从地址栏移除。
  const response = await page.goto(`/setup?token=${token}`)
  const headers = response!.headers()
  expect(headers['cache-control']).toBe('private, no-store')
  expect(headers['x-robots-tag']).toContain('noindex')
  expect(headers['referrer-policy']).toBe('no-referrer')
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
  await expect(page).toHaveURL(/\/setup$/)
  expect(page.url()).not.toContain(token)
  // 令牌随链接带入时不显示令牌字段，焦点直接落在登录名。
  await expect(page.getByRole('textbox', { name: '初始化令牌' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '登录名' })).toBeFocused()

  // 密码要求实时提示，前端先拦截不一致的确认密码。
  await page.getByRole('textbox', { name: '登录名' }).fill(owner.username)
  await page.getByLabel('密码', { exact: true }).fill(owner.password)
  await page.getByLabel('确认密码').fill('wizard-password-other')
  const rules = page.locator('#setup-password-rules li')
  await expect(rules.nth(0)).toContainText('已满足')
  await expect(rules.nth(1)).toContainText('未满足')
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByRole('alert')).toHaveText('两次输入的密码不一致')

  await page.getByLabel('确认密码').fill(owner.password)
  await expect(rules.nth(1)).toContainText('已满足')
  await page.getByRole('radio', { name: '中文' }).check()
  await page.getByRole('button', { name: '下一步' }).click()

  // 第二步：博主资料。博主名沿用登录名，默认字母头像在浏览器绘制后随提交登记为站内媒体。
  await expect(page.getByRole('heading', { level: 1, name: '完善博主资料' })).toBeVisible()
  await expect(page.getByText(`与登录名「${owner.username}」相同`)).toBeVisible()
  await page.getByRole('textbox', { name: '博主头衔（可选）' }).fill(owner.title)
  await page.getByRole('textbox', { name: '联系邮箱（可选）' }).fill(owner.email)
  await page.getByRole('textbox', { name: '站点名称（可选）' }).fill(owner.siteName)
  await page.getByRole('button', { name: '添加链接' }).click()
  await page.getByRole('textbox', { name: '第 1 个链接的地址' }).fill(owner.github)
  // 关闭搜索引擎收录：提交经网关后立即生效，不等开关缓存过期。
  await page.getByRole('switch', { name: /允许搜索引擎收录本站/ }).uncheck()
  await page.getByRole('button', { name: '创建博主账号' }).click()
  // 创建成功后用同一凭据自动登录，直接进入后台，不再停在登录页。
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('博主账号已创建，已自动登录后台')).toBeVisible()
  // 向导写入的站点名称在后台立即生效，不沿用创建前读到的旧资料。
  await expect(page.getByText(owner.siteName).first()).toBeVisible()
  // 公开站点资料包含博主名、头衔、字母头像（站内 WebP 媒体）、联系邮箱与社交链接。
  const site = (await (await request.get('/api/v1/site')).json()).data
  expect(site).toMatchObject({
    name: owner.siteName,
    ownerName: owner.username,
    ownerTitle: owner.title,
    searchIndexing: false,
  })
  expect(site.avatar).toMatch(/^\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/)
  expect(site.socials).toEqual([
    { label: '邮箱', href: `mailto:${owner.email}`, icon: 'lucide:mail' },
    { label: 'GitHub', href: owner.github, icon: 'lucide:github' },
  ])
  const avatar = await request.get(site.avatar)
  expect(avatar.status()).toBe(200)
  expect(avatar.headers()['content-type']).toBe('image/webp')

  // 站点名称已写入，经网关的提交清空了公开页面缓存，首页直接显示新名称。
  // 等首页读完初始化状态再断言提示不存在，避免在请求返回前误判。
  const statusRead = page.waitForResponse((response) => response.url().endsWith('/api/v1/setup/status'))
  await page.goto('/')
  await expect(page).toHaveTitle(new RegExp(owner.siteName))
  expect((await (await statusRead).json()).data).toEqual({ needsSetup: false })
  await expect(page.getByText('站点尚未完成初始化')).toHaveCount(0)

  // 完成后：状态为 false，任何提交都与不存在的路由一样返回 404，向导页不再显示表单。
  expect((await (await request.get('/api/v1/setup/status')).json()).data).toEqual({ needsSetup: false })
  for (const data of [{ token, username: 'another-owner', password: owner.password }, { nonsense: true }]) {
    const closed = await request.post('/api/v1/setup', { data, headers: { 'X-Blog-Locale': 'en' } })
    expect(closed.status()).toBe(404)
    expect((await closed.json()).message).toBe('Cannot POST /api/v1/setup')
  }
  await page.goto(`/setup?token=${token}`)
  await expect(page.getByText('此站点已完成初始化')).toBeVisible()
  await expect(page.getByRole('button', { name: '创建博主账号' })).toHaveCount(0)
  expect(page.url()).not.toContain(token)

  // 开发预览参数只在开发模式生效：生产构建中既不能重新打开表单，也不能让首页显示未初始化提示。
  await page.goto('/setup?preview=form')
  await expect(page.getByText('此站点已完成初始化')).toBeVisible()
  await expect(page.getByRole('button', { name: '创建博主账号' })).toHaveCount(0)
  await expect(page.getByRole('note')).toHaveCount(0)
  const previewStatus = page.waitForResponse((response) => response.url().endsWith('/api/v1/setup/status'))
  await page.goto('/?preview=setup-pending')
  expect((await (await previewStatus).json()).data).toEqual({ needsSetup: false })
  await expect(page.getByText('站点尚未完成初始化')).toHaveCount(0)

  // 向导关闭了收录：robots.txt 禁止抓取全站，公开页面带 noindex 响应头与 meta，站点地图清空。
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toMatch(/^Disallow: \/$/m)
  expect(robots).not.toMatch(/^Sitemap:/m)
  const home = await request.get('/')
  expect(home.headers()['x-robots-tag']).toContain('noindex')
  expect(await home.text()).toMatch(/<meta name="robots" content="noindex/)
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(await sitemap.text()).not.toContain('<loc>')
  expect(issues).toEqual([])
})
