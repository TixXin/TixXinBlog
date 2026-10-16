/** @file navigation-performance-dev.mjs @description 性能验收专用短期 Nuxt 开发子进程，生成目录与端口全部归属调用者 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const frontend = fileURLToPath(new URL('../../../frontend/web-blog/', import.meta.url))
const output = process.env.NAVIGATION_PERFORMANCE_OUTPUT
const buildDir = process.env.NAVIGATION_PERFORMANCE_BUILD_DIR
assert(output && buildDir && isAbsolute(output) && isAbsolute(buildDir))
assert.equal(dirname(buildDir), output, '开发中间目录必须属于本次性能验收')
assert(!relative(frontend, buildDir).startsWith('.nuxt'), '禁止使用日常开发生成目录')
const frontendRequire = createRequire(new URL('../../../frontend/web-blog/package.json', import.meta.url))
const nuxtRequire = createRequire(frontendRequire.resolve('nuxt/package.json'))
// 沿用安装版本 CLI 自己的开发服务器生命周期，显式覆盖中间目录；不启动第二套服务实现。
const cliEntry = pathToFileURL(nuxtRequire.resolve('@nuxt/cli'))
const { initialize } = await import(new URL('./dev/index.mjs', cliEntry))
let server
let stopping = false
async function close() {
  if (stopping) return
  stopping = true
  await server?.close()
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void close().then(
      () => process.exit(0),
      () => process.exit(1),
    )
  })
}
try {
  server = await initialize(
    { cwd: frontend, args: { clear: false, logLevel: 'silent' } },
    {
      showBanner: false,
      listenOverrides: { port: Number(process.env.PORT), hostname: '127.0.0.1', showURL: false },
      data: {
        overrides: {
          buildDir,
          devtools: { enabled: process.env.NUXT_DEVTOOLS_ENABLED === 'true' },
          vite: { cacheDir: `${buildDir}/vite` },
          nitro: { output: { dir: `${buildDir}/output` } },
        },
      },
    },
  )
  if (stopping) await server.close()
} catch (error) {
  await close()
  throw error
}
