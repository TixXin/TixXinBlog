/** @file release.test.mjs @description 发布预览、迁移顺序、故障停止及回退边界；使用假的 Docker 与 HTTPS 依赖。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, mkdir, rm, readFile, readdir } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { parseOptions, validateConfiguration, executeRelease, root } from './release.mjs'

const version = 'abc123'
function configuration(project, workerEnabled = false) {
  return {
    name: project,
    volumes: Object.fromEntries(
      ['database', 'media', 'certificates', 'caddy-config', 'backups'].map((name) => [
        name,
        { name: `${project}_${name}` },
      ]),
    ),
    services: {
      frontend: { image: `blog-web:${version}`, environment: { NUXT_PUBLIC_SITE_URL: 'https://blog.example.com' } },
      backend: {
        image: `blog-api:${version}`,
        environment: { CORS_ORIGIN: 'https://blog.example.com', JWT_ACCESS_SECRET: 'a'.repeat(32) },
      },
      migration: { image: `blog-migration:${version}` },
      edge: { image: 'caddy:2-alpine', environment: { SITE_HOST: 'blog.example.com' } },
      postgres: { image: 'postgres:16-alpine', environment: { POSTGRES_PASSWORD: 'a'.repeat(32) } },
      worker: {
        image: `blog-worker:${version}`,
        profiles: ['worker'],
        environment: { OPERATIONS_WORKER_ENABLED: String(workerEnabled) },
      },
    },
  }
}
const input = ['--env-file', 'production.env', '--version', version, '--origin', 'https://blog.example.com']

test('拒绝未指定配置、可变版本、非 HTTPS 和未确认数据库兼容的回退', () => {
  assert.throws(() => parseOptions([]))
  assert.throws(() => parseOptions(input.map((value) => (value === version ? 'latest' : value))))
  assert.throws(() => parseOptions(input.map((value) => (value.startsWith('https:') ? 'http://example.com' : value))))
  assert.throws(() => parseOptions([...input, '--apply']))
  assert.throws(() => parseOptions([...input, '--action', 'rollback']))
  assert.throws(() => parseOptions([...input, '--initialize', '--backup-directory', 'backup']))
  assert.equal(parseOptions([...input, '--action', 'rollback', '--database-compatible']).action, 'rollback')
})

test('配置绑定站点、版本与非占位密钥', () => {
  const options = parseOptions(input)
  const config = configuration('isolated-release')
  assert.equal(validateConfiguration(config, options).project, 'isolated-release')
  config.services.frontend.environment.NUXT_PUBLIC_SITE_URL = 'https://other.example.com'
  assert.throws(() => validateConfiguration(config, options))
  config.services.frontend.environment.NUXT_PUBLIC_SITE_URL = options.origin
  config.services.backend.image = 'blog-api:old'
  assert.throws(() => validateConfiguration(config, options))
})

for (const mode of [
  'preview',
  'deploy',
  'migration-failure',
  'entry-failure',
  'rollback',
  'initialize',
  'initialize-existing',
  'deploy-worker',
  'worker-oneoff',
]) {
  test(`${mode} 的执行顺序与失败保护`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tixxin-release-unit-'))
    const project = `release-unit-${randomUUID()}`
    const artifact = resolve(root, '.artifacts/release', project)
    const calls = []
    const envFile = join(directory, 'production.env')
    const backupDirectory = join(directory, 'backup')
    await writeFile(envFile, 'RELEASE_VERSION=wrong\nPOSTGRES_PASSWORD=secret\n')
    await mkdir(backupDirectory)
    const options = {
      ...parseOptions(input),
      envFile,
      backupDirectory,
      apply: mode !== 'preview',
      action: mode === 'rollback' ? 'rollback' : 'deploy',
      initialize: mode.startsWith('initialize'),
    }
    const runner = async (program, args, env) => {
      calls.push({ program, args })
      assert.equal(env.RELEASE_VERSION, version)
      assert.equal(env.POSTGRES_PASSWORD, undefined)
      if (args.includes('config')) return JSON.stringify(configuration(project, mode === 'deploy-worker'))
      if (['deploy-worker', 'worker-oneoff'].includes(mode) && args.includes('label=com.docker.compose.service=worker'))
        return 'a'.repeat(12)
      if (args.includes('{{json .Config.Labels}}'))
        return JSON.stringify({ 'com.docker.compose.oneoff': mode === 'worker-oneoff' ? 'True' : 'False' })
      if (args.includes('inspect')) return `sha256:${'a'.repeat(64)}`
      if (mode === 'initialize-existing' && args.includes('volume')) return `${project}_database`
      if (mode === 'migration-failure' && args.includes('run')) throw new Error('迁移执行失败')
      return ''
    }
    try {
      const promise = executeRelease(options, {
        command: runner,
        fetch: async () =>
          new Response('{}', {
            status: mode === 'entry-failure' ? 503 : 200,
            headers: { 'X-TixXin-Release': version },
          }),
      })
      if (mode.endsWith('failure') || ['initialize-existing', 'worker-oneoff'].includes(mode))
        await assert.rejects(promise)
      else assert.equal((await promise).status, mode === 'preview' ? 'preview' : 'ready')
      const actions = calls
        .map(({ args }) => args.find((value) => ['verify', 'up', 'stop', 'run'].includes(value)))
        .filter(Boolean)
      assert.deepEqual(
        actions,
        ['preview', 'initialize-existing', 'worker-oneoff'].includes(mode)
          ? []
          : mode === 'initialize'
            ? ['up', 'stop', 'run', 'up']
            : mode === 'migration-failure'
              ? ['verify', 'up', 'stop', 'run']
              : mode === 'rollback'
                ? ['verify', 'up', 'stop', 'up']
                : mode === 'deploy-worker'
                  ? ['verify', 'up', 'stop', 'run', 'up', 'up']
                  : ['verify', 'up', 'stop', 'run', 'up'],
      )
      if (!['preview', 'initialize-existing', 'worker-oneoff'].includes(mode)) {
        const files = await readdir(artifact)
        assert(!files.includes('release.lock'))
        const report = JSON.parse(await readFile(join(artifact, files[0]), 'utf8'))
        assert.equal(report.status, mode.endsWith('failure') ? 'failed' : 'ready')
        assert(!JSON.stringify(report).includes('POSTGRES_PASSWORD'))
        assert.equal(report.workerRestarted, mode === 'deploy-worker')
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
      assert(artifact.startsWith(resolve(root, '.artifacts/release') + sep))
      await rm(artifact, { recursive: true, force: true })
    }
  })
}
