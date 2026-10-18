/** @file logging.spec.ts @description 使用真实 HTTP 与 Pino 验证巡检静默、失败可见和请求脱敏 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import pinoHttp from 'pino-http'
import { createLoggingOptions } from './logging'

let requestId: string | null = null

async function captureRequest({
  development = true,
  path = '/api/v1/posts?pageSize=1',
  probe = true,
  method = 'GET',
  status = 200,
  attachedError = false,
  traceId = undefined as string | undefined,
  referer = undefined as string | undefined,
  extraHeaders = {} as Record<string, string>,
} = {}) {
  const lines: string[] = []
  const options = createLoggingOptions('debug', development).pinoHttp
  if (!options || Array.isArray(options)) throw new Error('日志配置不符合预期')
  const logger = pinoHttp({ ...options, transport: undefined }, { write: (line) => lines.push(line) })
  const server = createServer((req, res) => {
    logger(req, res)
    res.statusCode = status
    if (attachedError) res.err = new Error('probe failed')
    res.end('ok')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: {
        ...(probe ? { 'x-tixxin-dev-probe': '1' } : {}),
        ...(traceId ? { 'x-trace-id': traceId } : {}),
        ...(referer ? { referer } : {}),
        authorization: 'Bearer logging-test-secret',
        ...extraHeaders,
      },
    })
    await response.text()
    requestId = response.headers.get('x-request-id')
    return lines.map(
      (line) =>
        JSON.parse(line) as { level: number; req: { id: string; url: string; headers: Record<string, string> } },
    )
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

describe('巡检访问日志', () => {
  it.each(['/api/v1/dev/identity', '/api/v1/posts?pageSize=1', '/health', '/ready'])(
    '%s 成功时不刷屏',
    async (path) => {
      expect(await captureRequest({ path })).toEqual([])
    },
  )

  it.each([{ probe: false }, { development: false }, { method: 'POST' }, { path: '/api/v1/site' }])(
    '保留普通业务、生产和非巡检请求：%j',
    async (options) => {
      const logs = await captureRequest(options)
      expect(logs).toHaveLength(1)
      expect(logs[0]?.level).toBe(30)
      expect(logs[0]?.req.headers.authorization).toBe('[REDACTED]')
    },
  )

  it.each([
    { status: 429, expected: 40 },
    { status: 503, expected: 50 },
    { path: '/ready', status: 503, expected: 50 },
    { path: '/health', status: 404, expected: 40 },
    { attachedError: true, expected: 50 },
  ])('失败探针保持可见：%j', async ({ expected, ...options }) => {
    const logs = await captureRequest(options)
    expect(logs).toHaveLength(1)
    expect(logs[0]?.level).toBe(expected)
  })
})

describe('预览凭据日志脱敏', () => {
  it.each(['token', '%74oken', 'TOKEN'])('成功与失败请求均移除 %s 查询值和来源链接', async (name) => {
    for (const status of [200, 404, 500]) {
      const logs = await captureRequest({
        path: `/api/v1/posts/preview?${name}=private-draft-secret&token=another-secret`,
        referer: 'https://blog.example/posts/preview?token=referer-secret',
        status,
      })
      expect(logs).toHaveLength(1)
      // 日志只保留路径，整段查询字符串（含任意大小写或编码的 token）都不进入日志
      expect(logs[0]?.req.url).toBe('/api/v1/posts/preview')
      expect(logs[0]?.req.headers.referer).toBe('[REDACTED]')
      expect(JSON.stringify(logs)).not.toMatch(/private-draft-secret|another-secret|referer-secret/)
    }
  })
})

describe('客户端错误访问日志', () => {
  it.each([202, 400, 429])('状态 %s 的请求地址与来源请求头均不泄露查询或任意附加信息', async (status) => {
    const logs = await captureRequest({
      development: false,
      probe: false,
      method: 'POST',
      path: '/API/V1/CLIENT-ERRORS/?token=url-secret',
      status,
      extraHeaders: {
        referer: 'https://blog.example.com/admin?token=referer-secret',
        'x-private-context': 'header-secret',
        'content-type': 'application/json',
      },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]?.req.url).toBe('/api/v1/client-errors')
    expect(logs[0]?.req.headers['content-type']).toBe('application/json')
    expect(JSON.stringify(logs)).not.toMatch(/url-secret|referer-secret|header-secret|logging-test-secret/)
  })
})

describe('请求编号', () => {
  it('日志 req.id 与响应 X-Request-Id 一致，默认生成 UUID', async () => {
    const logs = await captureRequest({ probe: false })
    expect(logs[0]?.req.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(requestId).toBe(logs[0]?.req.id)
  })

  it('复用格式安全的上游 x-trace-id，拒绝非法值', async () => {
    const accepted = await captureRequest({ probe: false, traceId: 'edge-trace.01' })
    expect(accepted[0]?.req.id).toBe('edge-trace.01')
    expect(requestId).toBe('edge-trace.01')
    const rejected = await captureRequest({ probe: false, traceId: 'x'.repeat(65) })
    expect(rejected[0]?.req.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(requestId).toBe(rejected[0]?.req.id)
  })
})
