/** @file http-test-port.mjs @description 随机监听后以真实 Fetch 核对 HTTP 可用性，仅明确 bad port 才重新选端口 */
import { createServer } from 'node:http'

async function listenProbe() {
  const server = createServer((_request, response) => {
    response.writeHead(204)
    response.end()
  })
  await new Promise((resolve, reject) => {
    const failed = (error) => reject(error)
    server.once('error', failed)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', failed)
      resolve()
    })
  })
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}
async function probeHttp(port) {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
  })
  await response.body?.cancel()
  if (response.status !== 204) throw new Error(`测试端口 HTTP 探测返回 ${response.status}，应为 204`)
}
export async function getHttpTestPort({ listen = listenProbe, probe = probeHttp } = {}) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const listener = await listen()
    let rejectedPort = false
    try {
      await probe(listener.port)
    } catch (cause) {
      if (cause?.cause?.message !== 'bad port') throw cause
      rejectedPort = true
    } finally {
      // 成功、禁止端口及普通故障都先关闭本次监听；关闭异常同样会阻止启动。
      await listener.close()
    }
    if (!rejectedPort) return listener.port
  }
  throw new Error('连续 32 个随机测试端口被 Fetch 拒绝，未启动测试服务')
}
