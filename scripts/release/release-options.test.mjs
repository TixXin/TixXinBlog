/** @file release-options.test.mjs @description 发布参数和配置校验的纯函数边界，不执行发布或外部命令。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { parseOptions, validateConfiguration } from './release.mjs'

const version = '0.2.0-rc.1'
const origin = 'https://blog.example.com:8443'

function releaseArgs(overrides = {}) {
  const values = { envFile: 'deploy/production.env', version, origin, ...overrides }
  return ['--env-file', values.envFile, '--version', values.version, '--origin', values.origin]
}

function configuration() {
  return {
    name: 'blog-production_1',
    services: {
      frontend: { image: `registry.example.com/blog-web:${version}`, environment: { NUXT_PUBLIC_SITE_URL: origin } },
      backend: {
        image: `registry.example.com/blog-api:${version}`,
        environment: { CORS_ORIGIN: origin, JWT_ACCESS_SECRET: 'fixture-signing-secret-for-release-tests' },
      },
      migration: { image: `registry.example.com/blog-migration:${version}` },
      postgres: { image: 'postgres:16-alpine', environment: { POSTGRES_PASSWORD: 'aB01'.repeat(8) } },
      edge: { image: 'caddy:2-alpine', environment: { SITE_HOST: 'blog.example.com:8443' } },
    },
  }
}

test('发布预览规范化入口与相对路径，保持输入参数不变', () => {
  const args = Object.freeze(releaseArgs({ origin: 'https://BLOG.EXAMPLE.COM:443/' }))
  const before = [...args]

  assert.deepEqual(parseOptions(args), {
    action: 'deploy',
    apply: false,
    databaseCompatible: false,
    initialize: false,
    envFile: resolve('deploy/production.env'),
    version,
    origin: 'https://blog.example.com',
  })
  assert.deepEqual(args, before)
})

test('已有备份的回退保留明确开关、自定义 HTTPS 端口和绝对路径', () => {
  const envFile = resolve('deploy/production.env')
  const args = Object.freeze([
    ...releaseArgs({ envFile }),
    '--backup-directory',
    'backups/completed',
    '--database-compatible',
    '--action',
    'rollback',
    '--apply',
  ])

  assert.deepEqual(parseOptions(args), {
    action: 'rollback',
    apply: true,
    databaseCompatible: true,
    initialize: false,
    envFile,
    version,
    origin,
    backupDirectory: resolve('backups/completed'),
  })
})

test('全新安装允许无备份执行，拒绝与已确认数据库兼容的回退混用', () => {
  assert.deepEqual(parseOptions([...releaseArgs(), '--initialize', '--apply']), {
    action: 'deploy',
    apply: true,
    databaseCompatible: false,
    initialize: true,
    envFile: resolve('deploy/production.env'),
    version,
    origin,
  })
  assert.throws(
    () => parseOptions([...releaseArgs(), '--initialize', '--action', 'rollback', '--database-compatible']),
    { name: 'Error', message: '全新安装不能与回退或已有备份发布混用' },
  )
})

test('版本接受单字符与 128 字符边界，拒绝非法字符、超长和占位版本', () => {
  for (const value of ['a', 'A1_.-release', 'a'.repeat(128)]) {
    assert.equal(parseOptions(releaseArgs({ version: value })).version, value)
  }
  for (const value of ['-release', '_release', '.release', 'release/1', 'release:1', '发布版本', 'a'.repeat(129)]) {
    assert.throws(() => parseOptions(releaseArgs({ version: value })), {
      name: 'Error',
      message: '必须提供 --env-file 和有效的 --version',
    })
  }
  for (const value of ['latest', 'replace-with-git-sha']) {
    assert.throws(() => parseOptions(releaseArgs({ version: value })), {
      name: 'Error',
      message: '必须使用可追溯的固定发布版本',
    })
  }
})

test('必填参数缺失与无效动作返回明确错误', () => {
  for (const args of [releaseArgs().slice(2), ['--env-file', 'production.env', '--origin', origin]]) {
    assert.throws(() => parseOptions(args), { name: 'Error', message: '必须提供 --env-file 和有效的 --version' })
  }
  assert.throws(() => parseOptions(releaseArgs().slice(0, 4)), {
    name: 'Error',
    message: '必须提供 --origin https://站点域名',
  })
  assert.throws(() => parseOptions([...releaseArgs(), '--action', 'restore']), {
    name: 'Error',
    message: 'action 只能为 deploy 或 rollback',
  })
})

test('带值选项不接受空值、缺值、下一个选项或未知参数', () => {
  for (const flag of ['--env-file', '--version', '--origin', '--backup-directory', '--action']) {
    for (const suffix of [[flag], [flag, ''], [flag, '--apply']]) {
      assert.throws(() => parseOptions([...releaseArgs(), ...suffix]), {
        name: 'Error',
        message: '未知参数或缺少参数值',
      })
    }
  }
  for (const suffix of [['--unknown'], ['--version=abc123'], ['unexpected']]) {
    assert.throws(() => parseOptions([...releaseArgs(), ...suffix]), {
      name: 'Error',
      message: '未知参数或缺少参数值',
    })
  }
})

test('对象原型属性不能被当作已声明的命令参数', () => {
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.throws(() => parseOptions([...releaseArgs(), name, 'unexpected']), {
      name: 'Error',
      message: '未知参数或缺少参数值',
    })
  }
})

test('配置、版本、入口和备份目录的重复值不能静默覆盖', () => {
  for (const [flag, value] of [
    ['--env-file', 'other.env'],
    ['--version', 'other-version'],
    ['--origin', 'https://other.example.com'],
  ]) {
    assert.throws(() => parseOptions([...releaseArgs(), flag, value]), { name: 'Error', message: '参数重复' })
  }
  assert.throws(() => parseOptions([...releaseArgs(), '--backup-directory', 'first', '--backup-directory', 'second']), {
    name: 'Error',
    message: '参数重复',
  })
})

test('站点入口拒绝不可解析地址、凭据、非根路径、查询与片段', () => {
  for (const value of ['blog.example.com', 'https://', '/relative']) {
    assert.throws(() => parseOptions(releaseArgs({ origin: value })), {
      name: 'Error',
      message: '必须提供 --origin https://站点域名',
    })
  }
  for (const value of [
    'http://blog.example.com',
    'https://user@blog.example.com',
    'https://:password@blog.example.com',
    'https://blog.example.com/admin',
    'https://blog.example.com/?preview=true',
    'https://blog.example.com/#section',
  ]) {
    assert.throws(() => parseOptions(releaseArgs({ origin: value })), {
      name: 'Error',
      message: '站点入口必须是无凭据、无路径和查询的 HTTPS 地址',
    })
  }
})

test('配置校验只返回项目和五类镜像，保持冻结输入及凭据私有', () => {
  const config = configuration()
  const before = structuredClone(config)
  for (const service of Object.values(config.services)) {
    if (service.environment) Object.freeze(service.environment)
    Object.freeze(service)
  }
  Object.freeze(config.services)
  Object.freeze(config)
  const options = Object.freeze({ version, origin })
  const result = validateConfiguration(config, options)

  assert.deepEqual(result, {
    project: 'blog-production_1',
    images: {
      frontend: `registry.example.com/blog-web:${version}`,
      backend: `registry.example.com/blog-api:${version}`,
      migration: `registry.example.com/blog-migration:${version}`,
      postgres: 'postgres:16-alpine',
      edge: 'caddy:2-alpine',
    },
  })
  assert.deepEqual(config, before)
  assert.deepEqual(options, { version, origin })
  result.images.backend = 'changed-after-validation'
  assert.equal(config.services.backend.image, `registry.example.com/blog-api:${version}`)
})

test('项目名拒绝缺失、大小写混用、路径、空格与非法前缀', () => {
  for (const name of [undefined, null, '', 'Blog', 'blog/name', 'blog name', '-blog', '_blog']) {
    const config = { ...configuration(), name }
    assert.throws(() => validateConfiguration(config, { version, origin }), {
      name: 'Error',
      message: '需要稳定的独立 Compose 项目名称',
    })
  }
})

test('五类生产服务逐个缺失时拒绝继续校验', () => {
  for (const name of ['frontend', 'backend', 'migration', 'postgres', 'edge']) {
    const config = configuration()
    delete config.services[name]
    assert.throws(() => validateConfiguration(config, { version, origin }), {
      name: 'Error',
      message: '生产服务配置不完整',
    })
  }
  assert.throws(() => validateConfiguration({ name: 'blog-production' }, { version, origin }), {
    name: 'Error',
    message: '生产服务配置不完整',
  })
})

test('前后端和边缘入口逐个校验，缺少环境变量或端口不一致时拒绝发布', () => {
  for (const [name, key, other] of [
    ['frontend', 'NUXT_PUBLIC_SITE_URL', 'https://other.example.com:8443'],
    ['backend', 'CORS_ORIGIN', 'https://other.example.com:8443'],
    ['edge', 'SITE_HOST', 'blog.example.com'],
  ]) {
    for (const value of [undefined, other]) {
      const config = configuration()
      config.services[name].environment[key] = value
      assert.throws(() => validateConfiguration(config, { version, origin }), {
        name: 'Error',
        message: 'SITE_HOST、SITE_URL 和 --origin 必须一致',
      })
    }
    const config = configuration()
    delete config.services[name].environment
    assert.throws(() => validateConfiguration(config, { version, origin }), {
      name: 'Error',
      message: 'SITE_HOST、SITE_URL 和 --origin 必须一致',
    })
  }
})

test('数据库密码要求至少 32 位十六进制，接受大小写与更长值', () => {
  for (const password of ['aB09'.repeat(8), 'ABCDEF01'.repeat(8)]) {
    const config = configuration()
    config.services.postgres.environment.POSTGRES_PASSWORD = password
    assert.equal(validateConfiguration(config, { version, origin }).project, config.name)
  }
  for (const password of [undefined, null, '', 'a'.repeat(31), 'g'.repeat(32), `${'a'.repeat(32)} `]) {
    const config = configuration()
    config.services.postgres.environment.POSTGRES_PASSWORD = password
    assert.throws(() => validateConfiguration(config, { version, origin }), {
      name: 'Error',
      message: '数据库密码必须为至少 32 位随机十六进制值',
    })
  }
})

test('签名密钥接受 32 字符边界，拒绝缺失、非字符串、短值与占位符', () => {
  const validConfig = configuration()
  validConfig.services.backend.environment.JWT_ACCESS_SECRET = 'a'.repeat(32)
  assert.equal(validateConfiguration(validConfig, { version, origin }).project, validConfig.name)

  for (const secret of [undefined, null, '', 123, 'a'.repeat(31), `replace-${'a'.repeat(32)}`]) {
    const config = configuration()
    config.services.backend.environment.JWT_ACCESS_SECRET = secret
    assert.throws(() => validateConfiguration(config, { version, origin }), {
      name: 'Error',
      message: '签名密钥尚未正确配置',
    })
  }
})

test('前端、后端和迁移镜像逐个要求完整版本后缀，拒绝空值与近似匹配', () => {
  for (const name of ['frontend', 'backend', 'migration']) {
    for (const image of [undefined, '', 'blog:old-version', `blog:${version}-extra`, `blog:prefix-${version}`]) {
      const config = configuration()
      config.services[name].image = image
      assert.throws(() => validateConfiguration(config, { version, origin }), {
        name: 'Error',
        message: '应用与迁移必须采用同一明确版本',
      })
    }
  }
})
