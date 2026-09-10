/** @file http-test-port.test.mjs @description 核对真实 HTTP 端口、bad port 精确重选、释放顺序和非目标错误保留 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { getHttpTestPort } from './http-test-port.mjs'

test('真实随机端口已经释放，可再次监听并由 Fetch 访问', async () => {
  const port = await getHttpTestPort()
  const server = createServer((_request, response) => {
    response.writeHead(204)
    response.end()
  })
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) })
    assert.equal(response.status, 204)
  } finally {
    if (server.listening)
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})

test('只有明确 bad port 才在关闭前一次监听后重新选择', async () => {
  const actions = []
  let attempt = 0
  const port = await getHttpTestPort({
    listen: async () => {
      const current = ++attempt
      actions.push(`listen-${current}`)
      return { port: current, close: async () => actions.push(`close-${current}`) }
    },
    probe: async (current) => {
      actions.push(`probe-${current}`)
      if (current === 1) throw new TypeError('fetch failed', { cause: new Error('bad port') })
    },
  })
  assert.equal(port, 2)
  assert.deepEqual(actions, ['listen-1', 'probe-1', 'close-1', 'listen-2', 'probe-2', 'close-2'])
})

test('连接或超时等其他错误关闭监听后原样抛出，不重试', async () => {
  const failure = new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') })
  let listens = 0,
    closes = 0
  await assert.rejects(
    getHttpTestPort({
      listen: async () => {
        listens++
        return {
          port: 1,
          close: async () => {
            closes++
          },
        }
      },
      probe: async () => {
        throw failure
      },
    }),
    (error) => error === failure,
  )
  assert.equal(listens, 1)
  assert.equal(closes, 1)
})

test('普通错误文本恰好为 bad port 也不能触发重试', async () => {
  const failure = new Error('bad port')
  let listens = 0
  await assert.rejects(
    getHttpTestPort({
      listen: async () => {
        listens++
        return { port: 1, close: async () => {} }
      },
      probe: async () => {
        throw failure
      },
    }),
    (error) => error === failure,
  )
  assert.equal(listens, 1)
})

test('连续禁止端口有明确上限，每次监听都已释放', async () => {
  let closes = 0
  await assert.rejects(
    getHttpTestPort({
      listen: async () => ({
        port: 1,
        close: async () => {
          closes++
        },
      }),
      probe: async () => {
        throw new TypeError('fetch failed', { cause: new Error('bad port') })
      },
    }),
    /连续 32 个/,
  )
  assert.equal(closes, 32)
})
