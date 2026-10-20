/**
 * @file setupWizard.test.ts
 * @description 浏览器初始化向导：地址中的令牌读取后移除、密码要求实时提示、提交与跳转、已关闭状态、英文冒烟，以及登录页引导
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SetupPage from '../../app/pages/setup.vue'
import LoginPage from '../../app/pages/admin/login.vue'

const require = createRequire(import.meta.url)
const h3 = createRequire(require.resolve('nuxt/package.json'))('h3') as {
  readBody: (event: unknown) => Promise<unknown>
}
const TOKEN = 'a'.repeat(64)
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  success: vi.fn(),
  needsSetup: true,
  submitStatus: 201,
  submitMessage: '',
  bodies: [] as unknown[],
  loginStatus: 200,
  logins: [] as unknown[],
}))
mockNuxtImport('navigateTo', () => mocks.navigate)
mockNuxtImport('useToast', () => () => ({ success: mocks.success, error: vi.fn(), info: vi.fn() }))

registerEndpoint('/api/v1/setup/status', () => ({
  code: 0,
  message: 'ok',
  data: { needsSetup: mocks.needsSetup },
  traceId: 'unit',
}))
registerEndpoint('/api/v1/setup', {
  method: 'POST',
  handler: async (event: unknown) => {
    mocks.bodies.push(await h3.readBody(event))
    const response = (event as { node: { res: { statusCode: number } } }).node.res
    response.statusCode = mocks.submitStatus
    return mocks.submitStatus === 201
      ? { code: 0, message: 'ok', data: { username: 'owner' }, traceId: 'unit' }
      : { code: 40, message: mocks.submitMessage, data: null, traceId: 'unit' }
  },
})

registerEndpoint('/api/v1/auth/login', {
  method: 'POST',
  handler: async (event: unknown) => {
    mocks.logins.push(await h3.readBody(event))
    const response = (event as { node: { res: { statusCode: number } } }).node.res
    response.statusCode = mocks.loginStatus
    return mocks.loginStatus === 200
      ? {
          code: 0,
          message: 'ok',
          data: { accessToken: 'unit-access', expiresIn: 900, user: { id: '1', username: 'owner' } },
          traceId: 'unit',
        }
      : { code: 60, message: '操作过于频繁，请稍后重试', data: null, traceId: 'unit' }
  },
})

const i18n = () => useNuxtApp().$i18n

beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.success.mockReset()
  mocks.needsSetup = true
  mocks.submitStatus = 201
  mocks.submitMessage = ''
  mocks.bodies = []
  mocks.loginStatus = 200
  mocks.logins = []
})
afterEach(async () => {
  await i18n().setLocale('zh-CN')
})

// 挂到文档上，焦点断言才能读取 document.activeElement；每个用例结束后卸载
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

async function mountSetup(route = `/setup?token=${TOKEN}&from=install`) {
  const host = document.body.appendChild(document.createElement('div'))
  const wrapper = await mountSuspended(SetupPage, { route, attachTo: host })
  mounted.push({
    unmount: () => {
      wrapper.unmount()
      host.remove()
    },
  })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  return wrapper
}

describe('/setup 初始化向导', () => {
  it('从地址读取令牌后不显示令牌字段，随后用 replace 去掉 token，保留其他查询参数', async () => {
    const wrapper = await mountSetup()
    expect(wrapper.find('#setup-token').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('初始化令牌')
    const route = useRouter().currentRoute.value
    expect(route.path).toBe('/setup')
    expect(route.query.token).toBeUndefined()
    expect(route.query.from).toBe('install')
    expect(route.fullPath).not.toContain(TOKEN)
  })

  it('表单出现后聚焦第一个待填字段：令牌已带入时为登录名，否则为令牌', async () => {
    await mountSetup()
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('setup-username'))
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    await mountSetup('/setup')
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('setup-token'))
  })

  it('没有令牌时显示令牌输入框；显示密码按钮同时切换两个密码框', async () => {
    const wrapper = await mountSetup('/setup')
    expect(wrapper.find('label[for="setup-token"]').text()).toBe('初始化令牌')
    expect(wrapper.find('#setup-token').attributes('autocomplete')).toBe('off')
    const toggle = wrapper.find('.setup-password__toggle')
    expect(toggle.attributes('aria-label')).toBe('显示密码')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('#setup-password').attributes('type')).toBe('text')
    expect(wrapper.find('#setup-confirm').attributes('type')).toBe('text')
  })

  it('表单字段有可访问名称与说明，密码要求随输入实时更新', async () => {
    const wrapper = await mountSetup()
    for (const id of ['setup-username', 'setup-password', 'setup-confirm', 'setup-site-name']) {
      const input = wrapper.find(`#${id}`)
      expect(input.exists()).toBe(true)
      expect(wrapper.find(`label[for="${id}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('#setup-password').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.find('#setup-password').attributes('aria-describedby')).toContain('setup-password-rules')
    expect(wrapper.find('#setup-site-name').attributes('placeholder')).toBe('My Blog')
    expect(wrapper.text()).toContain('留空则沿用「My Blog」')
    const rules = () => wrapper.findAll('#setup-password-rules li').map((item) => item.text())
    expect(rules()).toEqual(['6–128 个字符未满足', '两次输入一致未满足'])
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    expect(rules()).toEqual(['6–128 个字符已满足', '两次输入一致已满足'])
    expect(wrapper.findAll('legend').map((item) => item.text())).toEqual(['博主账号', '站点设置', '站点语言'])
  })

  it('前端先拦截密码不一致与过短，不发请求', async () => {
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('short')
    await wrapper.find('#setup-confirm').setValue('short')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    // 错误显示在对应字段下，字段标为无效并获得焦点
    expect(wrapper.find('[role="alert"]').text()).toBe('密码至少需要 6 个字符')
    expect(wrapper.find('#setup-password-error').exists()).toBe(true)
    expect(wrapper.find('#setup-password').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#setup-password').attributes('aria-describedby')).toContain('setup-password-error')
    expect(document.activeElement?.id).toBe('setup-password')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    expect(wrapper.find('#setup-password').attributes('aria-invalid')).toBeUndefined()
    await wrapper.find('#setup-confirm').setValue('correct-horse-other')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('两次输入的密码不一致')
    expect(wrapper.find('#setup-confirm').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement?.id).toBe('setup-confirm')
    expect(mocks.bodies).toEqual([])
  })

  it('提交令牌、登录名、密码、站点名称与语言，成功后用同一凭据自动登录并进入后台', async () => {
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('  owner ')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    await wrapper.find('#setup-site-name').setValue('夜读札记')
    await wrapper.find('input[type="radio"][value="en"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
    expect(mocks.bodies).toEqual([
      { token: TOKEN, username: 'owner', password: 'correct-horse-battery', locale: 'en', siteName: '夜读札记' },
    ])
    expect(mocks.logins).toEqual([{ username: 'owner', password: 'correct-horse-battery' }])
    expect(mocks.success).toHaveBeenCalledWith('博主账号已创建，已自动登录后台')
    expect(mocks.navigate).toHaveBeenCalledWith('/admin')
  })

  it('账号已创建但自动登录失败时退回登录页并提示，不重复提交初始化', async () => {
    mocks.loginStatus = 429
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
    expect(mocks.bodies).toHaveLength(1)
    expect(mocks.logins).toHaveLength(1)
    expect(mocks.success).toHaveBeenCalledWith('博主账号已创建，请登录后台')
    expect(mocks.navigate).toHaveBeenCalledWith({ path: '/admin/login', query: { setup: 'done' } })
  })

  it('后端拒绝令牌（403）时展开令牌输入框，在框下显示接口文案并保留输入', async () => {
    mocks.submitStatus = 403
    mocks.submitMessage = '初始化令牌无效，请核对安装完成时输出的链接'
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('#setup-token-error').text()).toBe(mocks.submitMessage)
    expect(wrapper.find('#setup-token').attributes('aria-invalid')).toBe('true')
    expect((wrapper.find('#setup-token').element as HTMLInputElement).value).toBe(TOKEN)
    expect(document.activeElement?.id).toBe('setup-token')
    expect((wrapper.find('#setup-username').element as HTMLInputElement).value).toBe('owner')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('其他接口错误显示在提交按钮上方，令牌字段保持隐藏', async () => {
    mocks.submitStatus = 400
    mocks.submitMessage = '登录名不符合要求'
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#setup-error').exists()).toBe(true))
    expect(wrapper.find('#setup-error').text()).toBe(mocks.submitMessage)
    expect(wrapper.find('#setup-token').exists()).toBe(false)
  })

  it('选择站点语言时同步切换本页界面语言', async () => {
    const wrapper = await mountSetup()
    expect(wrapper.find('h1').text()).toBe('欢迎使用 TixXinBlog')
    await wrapper.find('input[type="radio"][value="en"]').setValue(true)
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe('Welcome to TixXinBlog'))
    expect(wrapper.find('button[type="submit"]').text()).toBe('Create owner account')
    await wrapper.find('input[type="radio"][value="zh-CN"]').setValue(true)
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe('欢迎使用 TixXinBlog'))
  })

  it('站点已初始化时不显示表单，引导前往登录', async () => {
    mocks.needsSetup = false
    const wrapper = await mountSuspended(SetupPage, { route: '/setup' })
    await vi.waitFor(() => expect(wrapper.text()).toContain('此站点已完成初始化'))
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('a[href="/admin/login"]').exists()).toBe(true)
  })

  it('英文冒烟：标题、字段、密码要求与按钮均为英文', async () => {
    await i18n().setLocale('en')
    const wrapper = await mountSetup()
    expect(wrapper.find('h1').text()).toBe('Welcome to TixXinBlog')
    expect(wrapper.find('#setup-site-name-help').text()).toBe(
      'Leave empty to keep “My Blog”. You can change it later in the dashboard.',
    )
    expect(wrapper.find('label[for="setup-password"]').text()).toBe('Password')
    expect(wrapper.findAll('#setup-password-rules li').map((item) => item.text())).toEqual([
      '6–128 charactersnot met',
      'Both entries matchnot met',
    ])
    expect(wrapper.find('button[type="submit"]').text()).toBe('Create owner account')
    // 语言选项用各自的自称（中文 / English），其余文案不含中文。
    expect(wrapper.text().replace('中文', '')).not.toMatch(/[一-鿿]/)
  })
})

describe('后台登录页引导', () => {
  it('需要初始化时显示前往 /setup 的链接，完成后显示登录提示', async () => {
    const wrapper = await mountSuspended(LoginPage, { route: '/admin/login' })
    await vi.waitFor(() => expect(wrapper.find('a[href="/setup"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('站点还没有博主账号')
    mocks.needsSetup = false
    const done = await mountSuspended(LoginPage, { route: '/admin/login?setup=done' })
    await flushPromises()
    expect(done.text()).toContain('博主账号已创建，请使用刚设置的登录名和密码登录。')
    expect(done.find('a[href="/setup"]').exists()).toBe(false)
  })
})

describe('/setup 开发预览', () => {
  it('?preview=form 在已初始化站点也显示表单与预览横幅，提交只做前端校验、不请求接口', async () => {
    mocks.needsSetup = false
    const wrapper = await mountSetup('/setup?preview=form')
    expect(wrapper.find('[role="note"]').text()).toBe('开发预览：页面状态由地址参数决定，提交不会创建账号。')
    expect(wrapper.find('#setup-token').exists()).toBe(false)
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('abc123')
    await wrapper.find('#setup-confirm').setValue('abc123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.success).toHaveBeenCalledWith('预览模式：表单校验通过，未创建账号')
    expect(mocks.bodies).toEqual([])
    expect(mocks.logins).toEqual([])
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('&preview-submit=fail 模拟接口拒绝令牌：展开令牌输入框并在框下提示', async () => {
    const wrapper = await mountSetup('/setup?preview=form&preview-submit=fail')
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('abc123')
    await wrapper.find('#setup-confirm').setValue('abc123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('#setup-token-error').text()).toBe(
      '（预览）模拟接口拒绝：初始化令牌无效，请核对安装完成时输出的链接',
    )
    expect(mocks.bodies).toEqual([])
  })

  it.each([
    ['closed', '此站点已完成初始化'],
    ['error', '无法确认'],
  ])('?preview=%s 强制显示对应状态', async (name, text) => {
    mocks.needsSetup = true
    const wrapper = await mountSuspended(SetupPage, { route: `/setup?preview=${name}` })
    await vi.waitFor(() => expect(wrapper.text()).toContain(text))
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
