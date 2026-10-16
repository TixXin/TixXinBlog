/** @file subscription-editor-conflicts.spec.ts @description 隔离环境验证订阅编辑私密归属、会话失效、版本冲突与未知创建恢复 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { ManagedSubscription } from '../../app/features/subscription/types'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function adminApi(request: APIRequestContext) {
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken as string
  return async function call<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
    const result = await request.fetch(`/api/v1${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(result.status(), `${method} ${path}`).toBeLessThan(300)
    return (await result.json()).data as T
  }
}
async function retainedNotes(page: Page, expected: string) {
  return page.evaluate(
    (value) =>
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('blog-subscription-editor:'))
        .some((key) => {
          try {
            return JSON.parse(sessionStorage.getItem(key)!).form.notes === value
          } catch {
            return false
          }
        }),
    expected,
  )
}
function locked(page: Page) {
  return page.locator('[aria-label="订阅编辑输入已锁定"]')
}

test('保存时会话失效移除私密表单，原地重新登录才显示同一归属的未保存输入', async ({ page, request }, testInfo) => {
  const api = await adminApi(request),
    name = `私密订阅 ${randomUUID()}`,
    secret = `仅当前博主可见 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/subscriptions/new')
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill(name)
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill(secret)
  await page.route('**/api/v1/admin/subscriptions', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 20, message: '登录已失效' }),
        })
      : route.continue(),
  )
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 22, message: '登录已过期' }),
    }),
  )
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('region', { name: '登录状态提示' })).toBeVisible()
  await expect(locked(page)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveCount(0)
  await expect(
    page.locator('[aria-label="订阅恢复副本"], [aria-label="订阅服务器版本"], [aria-label="旧内容库恢复副本"]'),
  ).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain(secret)
  expect(await retainedNotes(page, secret)).toBe(true)
  await captureMotion(page, testInfo, 'subscription-expired-private-input-hidden.png')
  await page.unroute('**/api/v1/admin/subscriptions')
  await page.unroute('**/api/v1/auth/refresh')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(locked(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveValue(secret)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/subscriptions\/\d+$/)
  const result = await api<{ items: ManagedSubscription[]; total: number }>(
    `/admin/subscriptions?q=${encodeURIComponent(name)}`,
  )
  expect(result.total).toBe(1)
  expect(result.items[0]!.notes).toBe(secret)
})

test('退出后取消脏表单导航，留在原路由也无法看到私密字段', async ({ page, request }) => {
  const api = await adminApi(request)
  const item = await api<ManagedSubscription>('/admin/subscriptions', 'POST', {
    requestId: randomUUID(),
    name: `退出保护 ${randomUUID()}`,
    amount: 0,
    currency: 'CNY',
    billingCycle: 'monthly',
    notes: '服务器私密备注',
  })
  const secret = `退出前未保存备注 ${randomUUID()}`
  await login(page)
  await page.goto(`/admin/subscriptions/${item.id}`)
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill(secret)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/subscriptions/${item.id}$`))
  await expect(locked(page)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveCount(0)
  expect(await retainedNotes(page, secret)).toBe(true)
  expect(await page.locator('body').innerText()).not.toContain(secret)
  expect((await api<ManagedSubscription>(`/admin/subscriptions/${item.id}`)).notes).toBe('服务器私密备注')
})

test('内容代次变化立即锁定私密输入，恢复原代次才继续查看且未自动写入', async ({ page, request }) => {
  const api = await adminApi(request)
  const item = await api<ManagedSubscription>('/admin/subscriptions', 'POST', {
    requestId: randomUUID(),
    name: `内容库保护 ${randomUUID()}`,
    amount: 0,
    currency: 'CNY',
    billingCycle: 'monthly',
    notes: '原内容库备注',
  })
  await login(page)
  await page.goto(`/admin/subscriptions/${item.id}`)
  const secret = `尚未写入的私密备注 ${randomUUID()}`
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill(secret)
  // 只在此浏览器注入内容恢复后的代次信号，不切换其他并行测试正在使用的隔离数据库。
  const previous = await page.evaluate((next) => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $nuxt: { payload: { state: Record<string, unknown> } } } } }
    }
    const state = root.__vue_app__.config.globalProperties.$nuxt.payload.state
    const old = String(state['$spage-content-context'])
    state['$spage-content-context'] = next
    return old
  }, `restored-${randomUUID()}`)
  expect(previous).toBeTruthy()
  expect(previous).not.toBe('undefined')
  await expect(locked(page)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveCount(0)
  expect(await retainedNotes(page, secret)).toBe(true)
  expect(await page.locator('body').innerText()).not.toContain(secret)
  await page.evaluate((original) => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $nuxt: { payload: { state: Record<string, unknown> } } } } }
    }
    root.__vue_app__.config.globalProperties.$nuxt.payload.state['$spage-content-context'] = original
  }, previous)
  await expect(locked(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveValue(secret)
  expect((await api<ManagedSubscription>(`/admin/subscriptions/${item.id}`)).notes).toBe('原内容库备注')
})

test('并发 revision 冲突保留双方输入并手动合并，变价历史只追加成功版本', async ({ page, request }) => {
  const api = await adminApi(request)
  const item = await api<ManagedSubscription>('/admin/subscriptions', 'POST', {
    requestId: randomUUID(),
    name: `版本对照 ${randomUUID()}`,
    billingCycle: 'monthly',
    currency: 'USD',
    amount: 1000,
  })
  await login(page)
  await page.goto(`/admin/subscriptions/${item.id}`)
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('20.00')
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill('本页待合并的备注')
  await api(`/admin/subscriptions/${item.id}`, 'PATCH', {
    revision: item.revision,
    amount: 1500,
    notes: '另一窗口最新备注',
    priceChangeReason: '另一窗口变价',
  })
  await page.getByRole('button', { name: '保存订阅', exact: true }).click()
  const conflict = page.getByRole('region', { name: '订阅服务器版本', exact: true })
  await expect(conflict).toContainText('另一窗口最新备注')
  await expect(conflict).toContainText('15.00')
  await expect(page.getByRole('textbox', { name: '订阅金额', exact: true })).toHaveValue('20.00')
  expect((await api<ManagedSubscription>(`/admin/subscriptions/${item.id}`)).priceHistory).toHaveLength(2)
  await conflict.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
  await page.getByRole('button', { name: '保存订阅', exact: true }).click()
  await expect
    .poll(async () => (await api<ManagedSubscription>(`/admin/subscriptions/${item.id}`)).priceHistory.length)
    .toBe(3)
  const result = await api<ManagedSubscription>(`/admin/subscriptions/${item.id}`)
  expect(result.amount).toBe(2000)
  expect(result.notes).toBe('本页待合并的备注')
})

test('创建已落库但响应丢失，刷新恢复副本后核查原请求且不重复创建', async ({ page, request }) => {
  const api = await adminApi(request),
    name = `未知提交恢复 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/subscriptions/new')
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill(name)
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('8.80')
  let intercepted = false,
    requestId = ''
  await page.route('**/api/v1/admin/subscriptions', async (route) => {
    if (!intercepted && route.request().method() === 'POST') {
      intercepted = true
      requestId = route.request().postDataJSON().requestId
      const committed = await route.fetch()
      expect(committed.status()).toBe(201)
      await route.abort('failed')
    } else await route.continue()
  })
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未核清')
  expect(requestId).toBeTruthy()
  expect((await api<{ total: number }>(`/admin/subscriptions?q=${encodeURIComponent(name)}`)).total).toBe(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByRole('region', { name: '订阅恢复副本', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toHaveValue(name)
  const recoveryRequest = page.waitForRequest((request) =>
    request.url().includes(`/subscriptions/submissions/${requestId}`),
  )
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await recoveryRequest
  await expect(page).toHaveURL(/\/admin\/subscriptions\/\d+$/)
  expect((await api<{ total: number }>(`/admin/subscriptions?q=${encodeURIComponent(name)}`)).total).toBe(1)
})

test('服务端内容库409在客户端代次尚未改变时也锁定私密视图，不读取同编号的新版本', async ({ page, request }) => {
  const api = await adminApi(request)
  const item = await api<ManagedSubscription>('/admin/subscriptions', 'POST', {
    requestId: randomUUID(),
    name: `服务端代次保护 ${randomUUID()}`,
    amount: 0,
    currency: 'CNY',
    billingCycle: 'monthly',
    notes: '旧内容库的记录',
  })
  await login(page)
  await page.goto(`/admin/subscriptions/${item.id}`)
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill('旧内容库尚未保存的输入')
  let followupReads = 0
  await page.route(`**/api/v1/admin/subscriptions/${item.id}`, async (route) => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 409, message: '站点数据上下文已变化，请刷新后重试' }),
      })
    else {
      followupReads++
      await route.continue()
    }
  })
  await page.getByRole('button', { name: '保存订阅', exact: true }).click()
  await expect(locked(page)).toBeVisible()
  await expect(locked(page)).toContainText('请刷新整个页面')
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '订阅服务器版本', exact: true })).toHaveCount(0)
  expect(followupReads).toBe(0)
  expect(await retainedNotes(page, '旧内容库尚未保存的输入')).toBe(true)
})
