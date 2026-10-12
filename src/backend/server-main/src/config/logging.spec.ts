/** @file logging.spec.ts @description 使用真实 HTTP 与 Pino 验证巡检静默、失败可见和请求脱敏 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import pinoHttp from 'pino-http'
import { createLoggingOptions } from './logging'

async function captureRequest({
  development = true,
  path = '/api/v1/posts?pageSize=1',
  probe = true,
  method = 'GET',
  status = 200,
  attachedError = false,
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
      headers: { ...(probe ? { 'x-tixxin-dev-probe': '1' } : {}), authorization: 'Bearer logging-test-secret' },
    })
    await response.text()
    return lines.map((line) => JSON.parse(line) as { level: number; req: { headers: Record<string, string> } })
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
