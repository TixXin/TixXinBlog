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
        authorization: 'Bearer logging-test-secret',
      },
    })
    await response.text()
    requestId = response.headers.get('x-request-id')
    return lines.map(
      (line) => JSON.parse(line) as { level: number; req: { id: string; headers: Record<string, string> } },
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
