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
import { getAccessSecret } from '../../modules/auth/auth.constants'

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

  it('缺失、短密钥和占位值无法用作签名密钥', () => {
    for (const value of [undefined, '', 'short', '<required>'.repeat(4)]) {
      expect(() => getAccessSecret(value)).toThrow('JWT_ACCESS_SECRET')
    }
    const secret = 'test-secret-with-at-least-32-characters'
    expect(getAccessSecret(secret)).toBe(secret)
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: secret })).toThrow('DATABASE_URL')
  })
})
