/**
 * @file environment.spec.ts
 * @description 环境加载与密钥校验：配置优先级、占位符拒绝和必需参数
 */
import 'reflect-metadata'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadLocalEnvironment } from '../environment'
import { validateEnv } from '../env.validation'
import { getAccessSecret, getRefreshCookieOptions } from '../../modules/auth/auth.constants'

describe('环境配置', () => {
  it('进程变量优先于本地文件，本地文件优先于通用文件', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tixxin-config-test-'))
    const keys = ['TIXXIN_TEST_ENV_FIRST', 'TIXXIN_TEST_ENV_SECOND']
    const previous = keys.map((key) => process.env[key])
    try {
      process.env.TIXXIN_TEST_ENV_FIRST = 'process'
      delete process.env.TIXXIN_TEST_ENV_SECOND
      writeFileSync(join(directory, '.env.local'), 'TIXXIN_TEST_ENV_FIRST=local\nTIXXIN_TEST_ENV_SECOND=local\n')
      writeFileSync(join(directory, '.env'), 'TIXXIN_TEST_ENV_FIRST=base\nTIXXIN_TEST_ENV_SECOND=base\n')
      loadLocalEnvironment(directory)
      expect(process.env.TIXXIN_TEST_ENV_FIRST).toBe('process')
      expect(process.env.TIXXIN_TEST_ENV_SECOND).toBe('local')
    } finally {
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key]
        else process.env[key] = previous[index]
      })
      // 仅删除 mkdtemp 创建并保存在本函数中的隔离测试目录。
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('本机API默认3457，容器可显式保留内部3000且不改变数据库目标', () => {
    const base = {
      DATABASE_URL: 'postgres://dev:fixture-only@127.0.0.1:5433/tixxin_fixture',
      JWT_ACCESS_SECRET: 'fixture-secret-with-at-least-32-characters',
    }
    const local = validateEnv({ ...base, NODE_ENV: 'development' })
    expect(local.PORT).toBe(3457)
    expect(local.DATABASE_URL).toBe(base.DATABASE_URL)
    const container = validateEnv({ ...base, NODE_ENV: 'production', PORT: '3000', MEDIA_DIRECTORY: '/app/var/media' })
    expect(container.PORT).toBe(3000)
    expect(container.DATABASE_URL).toBe(base.DATABASE_URL)
  })

  it('缺失、短密钥和占位值无法用作签名密钥', () => {
    for (const value of [undefined, '', 'short', '<required>'.repeat(4)]) {
      expect(() => getAccessSecret(value)).toThrow('JWT_ACCESS_SECRET')
    }
    const secret = 'test-secret-with-at-least-32-characters'
    expect(getAccessSecret(secret)).toBe(secret)
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: secret })).toThrow('DATABASE_URL')
  })

  describe('安全默认值', () => {
    const base = {
      DATABASE_URL: 'postgres://dev:fixture-only@127.0.0.1:5433/tixxin_fixture',
      JWT_ACCESS_SECRET: 'fixture-secret-with-at-least-32-characters',
    }

    it('缺省 NODE_ENV 按生产处理，日志缺省 info，限流开关缺省关闭', () => {
      const validated = validateEnv({ ...base, MEDIA_DIRECTORY: '/srv/media' })
      expect(validated.NODE_ENV).toBe('production')
      expect(validated.LOG_LEVEL).toBe('info')
      expect(validated.RATE_LIMIT_DISABLED).toBe('false')
    })

    it('生产环境 MEDIA_DIRECTORY 必填且为绝对路径，开发与测试允许相对路径', () => {
      expect(() => validateEnv(base)).toThrow('MEDIA_DIRECTORY')
      expect(() => validateEnv({ ...base, NODE_ENV: 'production', MEDIA_DIRECTORY: './var/media' })).toThrow(
        'MEDIA_DIRECTORY',
      )
      expect(validateEnv({ ...base, NODE_ENV: 'production', MEDIA_DIRECTORY: '/app/var/media' }).MEDIA_DIRECTORY).toBe(
        '/app/var/media',
      )
      expect(validateEnv({ ...base, NODE_ENV: 'development', MEDIA_DIRECTORY: './var/media' }).NODE_ENV).toBe(
        'development',
      )
      expect(validateEnv({ ...base, NODE_ENV: 'test' }).NODE_ENV).toBe('test')
    })

    it('RATE_LIMIT_DISABLED 只接受 true/false', () => {
      expect(() => validateEnv({ ...base, NODE_ENV: 'development', RATE_LIMIT_DISABLED: 'yes' })).toThrow(
        'RATE_LIMIT_DISABLED',
      )
    })

    it('SETUP_TOKEN 可选；配置时至少 32 个字符且不含空白，空值视为未配置', () => {
      const test = { ...base, NODE_ENV: 'test' }
      expect(validateEnv(test).SETUP_TOKEN).toBeUndefined()
      expect(validateEnv({ ...test, SETUP_TOKEN: '' }).SETUP_TOKEN).toBe('')
      expect(validateEnv({ ...test, SETUP_TOKEN: 'a'.repeat(32) }).SETUP_TOKEN).toBe('a'.repeat(32))
      expect(() => validateEnv({ ...test, SETUP_TOKEN: 'a'.repeat(31) })).toThrow('SETUP_TOKEN')
      expect(() => validateEnv({ ...test, SETUP_TOKEN: `${'a'.repeat(32)} b` })).toThrow('SETUP_TOKEN')
    })

    it('刷新 Cookie 仅在显式 development/test 下不带 Secure', () => {
      const previous = process.env.NODE_ENV
      try {
        for (const [mode, secure] of [
          ['development', false],
          ['test', false],
          ['production', true],
          [undefined, true],
          ['staging', true],
        ] as const) {
          if (mode === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = mode
          expect(getRefreshCookieOptions().secure).toBe(secure)
        }
      } finally {
        process.env.NODE_ENV = previous
      }
    })
  })
})
