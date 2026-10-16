/**
 * @file interaction-cursors.spec.ts
 * @description 隔离环境验证三主题、后台及原生控件的光标、命中区域和状态恢复。
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
}

async function cursor(target: Locator, expected: string) {
  await target.scrollIntoViewIfNeeded()
  await target.hover()
  // 测量真正位于鼠标下方的元素，覆盖按钮图标、文字及组件内部节点的继承。
  await expect
    .poll(() =>
      target.evaluate((node) => {
        const box = node.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return hit && (hit === node || node.contains(hit)) ? getComputedStyle(hit).cursor : '被遮挡'
      }),
    )
    .toBe(expected)
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

for (const theme of ['nexus', 'aurora', 'dock']) {
  test(`${theme} 导航、搜索入口及弹层保留正确交互`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'blog-layout-theme', value: theme, url: baseURL! }])
    await page.goto('/')
    await ready(page)
    await cursor(page.getByRole('link', { name: '主页', exact: true }).filter({ visible: true }).first(), 'pointer')
    const search = page.getByRole('button', { name: '搜索站内文章、标签...', exact: true })
    await expect(search).toBeEnabled()
    await cursor(search, 'pointer')
    await search.click()
    const dialog = page.getByRole('dialog', { name: '站内搜索', exact: true })
    await expect(dialog).toBeVisible()
    const input = dialog.locator('input').first()
    await cursor(input, 'text')
    await input.fill('Vue')
    await expect(input).toHaveValue('Vue')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(search).toBeFocused()
  })
}

test('原生控件、禁用 fieldset、只读文本与角色控件遵循状态边界', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  // 不增加产品测试页面；仅在隔离浏览器挂载代表性控件，使用应用的真实全局样式。
  await page.evaluate(() => {
    const section = document.createElement('section')
    section.id = 'cursor-contract'
    section.style.cssText = 'position:fixed;inset:20px;overflow:auto;z-index:100000;background:var(--bg);padding:20px'
    section.innerHTML = `
      <div tabindex="0" data-kind="focus-only">可聚焦但不执行操作</div>
      <a href="#cursor-contract" data-kind="link"><span>链接文字</span></a>
      <button class="btn-primary" data-kind="action"><svg width="20" height="20"><circle cx="10" cy="10" r="8" /></svg><span>操作文字</span></button>
      <p><input data-kind="text" aria-label="普通输入" /></p>
      <p><input type="password" data-kind="password" /></p>
      <p><input type="number" data-kind="number" /></p>
      <p><textarea data-kind="readonly" readonly>可以选择复制的正文</textarea></p>
      <p contenteditable="plaintext-only" data-kind="editable">可编辑正文</p>
      <p><label data-kind="check-label"><input type="checkbox" data-kind="check" />选择项目</label></p>
      <p><label data-kind="select-label">分类<select data-kind="select"><option value="one">一</option><option value="two">二</option></select></label></p>
      <p><input type="color" data-kind="color" /><input type="range" data-kind="range" /></p>
      <p><input type="file" data-kind="file" /></p>
      <div role="button" tabindex="0" aria-disabled="true" data-kind="role-disabled"><span>不可操作的角色控件</span></div>
      <div aria-busy="true" data-kind="busy-container"><input data-kind="nested-input" /><button data-kind="nested-button">仍可操作</button></div>
      <fieldset disabled><legend><label data-kind="legend-label"><input type="checkbox" data-kind="legend-check" />例外控件</label></legend><button data-kind="fieldset-button"><span>禁用操作</span></button><input data-kind="fieldset-input" /><label data-kind="fieldset-label"><input type="checkbox" />禁用选项</label><select data-kind="fieldset-select"><option>禁用选择器</option></select></fieldset>
      <details><summary data-kind="summary">查看差异</summary><p>差异正文</p></details>
    `
    section.querySelector<HTMLButtonElement>('[data-kind="action"]')!.onclick = () => {
      section.dataset.clicked = 'true'
    }
    document.body.append(section)
  })
  const root = page.locator('#cursor-contract')
  const control = (kind: string) => root.locator(`[data-kind="${kind}"]`)
  for (const kind of [
    'link',
    'action',
    'check',
    'check-label',
    'select',
    'select-label',
    'color',
    'range',
    'summary',
    'nested-button',
    'legend-check',
    'legend-label',
  ]) {
    await cursor(control(kind), 'pointer')
  }
  for (const kind of ['text', 'password', 'number', 'readonly', 'editable', 'nested-input']) {
    await cursor(control(kind), 'text')
  }
  for (const kind of ['role-disabled', 'fieldset-button', 'fieldset-input', 'fieldset-label', 'fieldset-select']) {
    await cursor(control(kind), 'not-allowed')
  }
  await cursor(control('focus-only'), 'auto')
  expect(['auto', 'default']).toContain(await control('file').evaluate((node) => getComputedStyle(node).cursor))
  expect(await control('file').evaluate((node) => getComputedStyle(node, '::file-selector-button').cursor)).toBe(
    'pointer',
  )
  await control('file').evaluate((node) => {
    ;(node as HTMLInputElement).disabled = true
  })
  expect(await control('file').evaluate((node) => getComputedStyle(node, '::file-selector-button').cursor)).toBe(
    'not-allowed',
  )
  const action = control('action')
  await action.evaluate((node) => {
    ;(node as HTMLButtonElement).disabled = true
  })
  await cursor(action.locator('svg'), 'not-allowed')
  await cursor(action.locator('span'), 'not-allowed')
  await action.evaluate((node) => node.setAttribute('aria-busy', 'true'))
  await cursor(action.locator('svg'), 'progress')
  await cursor(action.locator('span'), 'progress')
  await action.evaluate((node) => {
    ;(node as HTMLButtonElement).disabled = false
    node.removeAttribute('aria-busy')
  })
  await cursor(action, 'pointer')
  await action.click()
  await expect(root).toHaveAttribute('data-clicked', 'true')
  await control('text').fill('正常输入')
  await expect(control('text')).toHaveValue('正常输入')
  await control('check').check()
  await expect(control('check')).toBeChecked()
  await control('select').selectOption('two')
  await expect(control('select')).toHaveValue('two')
  await control('readonly').focus()
  await control('readonly').press('ControlOrMeta+A')
  expect(
    await control('readonly').evaluate((node) => {
      const input = node as HTMLTextAreaElement
      return input.value.slice(input.selectionStart, input.selectionEnd)
    }),
  ).toBe('可以选择复制的正文')
})

test('真实登录表单处理中只标记提交按钮，结束后恢复输入与操作', async ({ page }) => {
  await page.goto('/admin/login')
  const username = page.getByRole('textbox', { name: '用户名', exact: true })
  const password = page.getByRole('textbox', { name: '密码', exact: true })
  const submit = page.locator('.auth-submit')
  await username.fill(process.env.E2E_USERNAME!)
  await password.fill(process.env.E2E_PASSWORD!)
  await cursor(username, 'text')
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/login', async (route) => {
    await held
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '暂时无法登录' }),
    })
  })
  try {
    await submit.click()
    await expect(submit).toHaveAttribute('aria-busy', 'true')
    await cursor(submit, 'progress')
    await cursor(username, 'not-allowed')
    await cursor(page.getByRole('button', { name: '登录帮助', exact: true }), 'pointer')
  } finally {
    release()
  }
  await expect(submit).toBeEnabled()
  await cursor(submit, 'pointer')
  await cursor(username, 'text')
  await expect(username).toHaveValue(process.env.E2E_USERNAME!)
})

test('后台编辑器输入、选择、标签与保存过程保持一致且保留正文', async ({ page, browserName }, testInfo) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true }).uncheck()
  const title = page.getByRole('textbox', { name: '标题', exact: true })
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await title.fill('光标交互验收')
  await body.fill('# 正文\n\n保存失败仍保留输入。')
  await cursor(title, 'text')
  await cursor(body, 'text')
  await cursor(page.locator('.post-editor__fields select'), 'pointer')
  const pin = page.getByLabel('置顶', { exact: true })
  await cursor(pin, 'pointer')
  await cursor(pin.locator('..'), 'pointer')
  await pin.check()
  const save = page.locator('.post-editor__actions button[type="submit"]')
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/admin/posts', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await held
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '暂时无法保存' }),
    })
  })
  try {
    await save.click()
    await expect(save).toHaveAttribute('aria-busy', 'true')
    await cursor(save, 'progress')
    await cursor(title, 'not-allowed')
    await cursor(pin.locator('..'), 'not-allowed')
    await cursor(page.getByRole('button', { name: '从正文生成摘要', exact: true }), 'not-allowed')
  } finally {
    release()
  }
  await expect(save).toBeEnabled()
  await cursor(save, 'pointer')
  await cursor(body, 'text')
  await expect(body).toHaveValue('# 正文\n\n保存失败仍保留输入。')
  await expect(page.getByRole('region', { name: '文章保存状态' })).toContainText('本机恢复副本：已保存')
  await page.reload()
  await page.getByRole('button', { name: '比较恢复副本', exact: true }).click()
  const readonly = page.locator('.post-conflict textarea').first()
  await expect(readonly).toHaveAttribute('readonly', '')
  await cursor(readonly, 'text')
  await readonly.focus()
  await readonly.press('ControlOrMeta+A')
  expect(
    await readonly.evaluate((node) => {
      const input = node as HTMLTextAreaElement
      return input.value.slice(input.selectionStart, input.selectionEnd)
    }),
  ).toBe('# 正文\n\n保存失败仍保留输入。')
  // 视觉凭证由 Chromium 生成；三浏览器均执行相同的光标、选区和功能断言。
  if (browserName === 'chromium') await captureMotion(page, testInfo, 'readonly-editor.png', { animations: 'disabled' })
})

test('图片放大和留言尺寸手柄使用专用光标，未加载的图片不可操作', async ({ page }) => {
  await page.goto('/gallery')
  await ready(page)
  const item = page.locator('.gallery-item').first()
  await expect(item).toHaveAttribute('aria-disabled', 'false')
  await cursor(item, 'zoom-in')
  await item.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await item.evaluate((node) => node.setAttribute('aria-disabled', 'true'))
  await cursor(item, 'not-allowed')
  await login(page)
  await page.goto('/guestbook')
  await ready(page)
  await expect(page.locator('.message-input textarea')).toBeEnabled()
  const handle = page.locator('.message-input__resize-handle')
  await cursor(handle, 'ns-resize')
  const textarea = page.locator('.message-input textarea')
  const box = await handle.boundingBox()
  const before = await textarea.evaluate((node) => node.getBoundingClientRect().height)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 60)
  await page.mouse.up()
  await expect.poll(() => textarea.evaluate((node) => node.getBoundingClientRect().height)).not.toBe(before)
})

test('滚动条拖拽使用抓取光标且真实滚动，释放后恢复', async ({ page }) => {
  await page.goto('/guestbook')
  await ready(page)
  const viewport = page.locator('.guestbook-center__messages .custom-scrollbar__viewport')
  await expect(viewport).toBeVisible()
  await expect.poll(() => viewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
  await viewport.hover()
  const thumb = page.locator('.guestbook-center__messages .custom-scrollbar__thumb')
  await expect(thumb).toBeVisible()
  await cursor(thumb, 'grab')
  const box = await thumb.boundingBox()
  const before = await viewport.evaluate((node) => node.scrollTop)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  try {
    await expect(thumb).toHaveClass(/is-dragging/)
    await expect(thumb).toHaveCSS('cursor', 'grabbing')
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + (before > 20 ? -20 : 20), { steps: 3 })
    await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).not.toBe(before)
  } finally {
    await page.mouse.up()
  }
  await expect(thumb).not.toHaveClass(/is-dragging/)
  await cursor(thumb, 'grab')
})
