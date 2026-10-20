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

async function mountSetup(route = `/setup?token=${TOKEN}&from=install`) {
  const wrapper = await mountSuspended(SetupPage, { route })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  return wrapper
}

describe('/setup 初始化向导', () => {
  it('从地址读取令牌并预填，随后用 replace 去掉 token，保留其他查询参数', async () => {
    const wrapper = await mountSetup()
    expect((wrapper.find('#setup-token').element as HTMLInputElement).value).toBe(TOKEN)
    expect(wrapper.text()).toContain('已从链接读取令牌，并已从地址栏移除。')
    const route = useRouter().currentRoute.value
    expect(route.path).toBe('/setup')
    expect(route.query.token).toBeUndefined()
    expect(route.query.from).toBe('install')
    expect(route.fullPath).not.toContain(TOKEN)
  })

  it('表单字段有可访问名称与说明，密码要求随输入实时更新', async () => {
    const wrapper = await mountSetup()
    for (const id of ['setup-token', 'setup-username', 'setup-password', 'setup-confirm', 'setup-site-name']) {
      const input = wrapper.find(`#${id}`)
      expect(input.exists()).toBe(true)
      expect(wrapper.find(`label[for="${id}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('#setup-password').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.find('#setup-password').attributes('aria-describedby')).toContain('setup-password-rules')
    expect(wrapper.find('#setup-token').attributes('autocomplete')).toBe('off')
    const rules = () => wrapper.findAll('#setup-password-rules li').map((item) => item.text())
    expect(rules()).toEqual(['6–128 个字符未满足', '两次输入一致未满足'])
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    expect(rules()).toEqual(['6–128 个字符已满足', '两次输入一致已满足'])
    expect(wrapper.find('legend').text()).toBe('站点语言')
  })

  it('前端先拦截密码不一致与过短，不发请求', async () => {
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('short')
    await wrapper.find('#setup-confirm').setValue('short')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toBe('密码至少需要 6 个字符')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-other')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toBe('两次输入的密码不一致')
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

  it('后端拒绝时显示接口返回的文案并保留输入', async () => {
    mocks.submitStatus = 403
    mocks.submitMessage = '初始化令牌无效，请核对安装完成时输出的链接'
    const wrapper = await mountSetup()
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('correct-horse-battery')
    await wrapper.find('#setup-confirm').setValue('correct-horse-battery')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[role="alert"]').text()).toBe(mocks.submitMessage)
    expect((wrapper.find('#setup-username').element as HTMLInputElement).value).toBe('owner')
    expect(mocks.navigate).not.toHaveBeenCalled()
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
    expect(wrapper.find('h1').text()).toBe('Set up site')
    expect(wrapper.find('label[for="setup-token"]').text()).toBe('Setup token')
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
    expect((wrapper.find('#setup-token').element as HTMLInputElement).value).toBe('a'.repeat(48))
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

  it('&preview-submit=fail 模拟接口拒绝的错误展示', async () => {
    const wrapper = await mountSetup('/setup?preview=form&preview-submit=fail')
    await wrapper.find('#setup-username').setValue('owner')
    await wrapper.find('#setup-password').setValue('abc123')
    await wrapper.find('#setup-confirm').setValue('abc123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('#setup-error').text()).toBe('（预览）模拟接口拒绝：初始化令牌无效，请核对安装完成时输出的链接')
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
