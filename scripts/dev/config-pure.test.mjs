/** @file config-pure.test.mjs @description 开发配置的纯函数回归：指纹稳定性、身份边界与凭据脱敏 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseFingerprint, fingerprint, redact } from './config.mjs'

test('指纹匹配 SHA-256 标准向量，区分大小写和尾随空格', () => {
  assert.equal(fingerprint(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.equal(fingerprint('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.notEqual(fingerprint('abc'), fingerprint('ABC'))
  assert.notEqual(fingerprint('abc'), fingerprint('abc '))
})

test('中文指纹按 UTF-8 字节生成，不改变输入缓冲区', () => {
  const input = Buffer.from('博客/开发配置', 'utf8')
  const before = Buffer.from(input)
  assert.equal(fingerprint('博客/开发配置'), fingerprint(input))
  assert.deepEqual(input, before)
})

test('数据库身份忽略密码、查询参数和片段，保留相同连接目标', () => {
  const baseline = databaseFingerprint('postgres://author:first-password@127.0.0.1:5433/blog')
  for (const url of [
    'postgres://author:changed-password@127.0.0.1:5433/blog',
    'postgres://author:p%40ss%3Aword@127.0.0.1:5433/blog?sslmode=require#connection',
    'postgres://author@127.0.0.1:5433/blog?application_name=dev',
  ]) {
    assert.equal(databaseFingerprint(url), baseline)
  }
})

test('数据库身份区分协议、用户名、主机、端口和数据库名', () => {
  const baseline = databaseFingerprint('postgres://author:fixture-password@127.0.0.1:5433/blog')
  for (const url of [
    'postgresql://author:fixture-password@127.0.0.1:5433/blog',
    'postgres://reader:fixture-password@127.0.0.1:5433/blog',
    'postgres://author:fixture-password@localhost:5433/blog',
    'postgres://author:fixture-password@127.0.0.1:5434/blog',
    'postgres://author:fixture-password@127.0.0.1:5433/other',
  ]) {
    assert.notEqual(databaseFingerprint(url), baseline)
  }
  assert.throws(() => databaseFingerprint('不是连接地址'), TypeError)
})

test('多个环境中的原始、编码及重复凭据均脱敏，不修改环境对象', () => {
  const api = Object.freeze({ jwt_secret: '口令 value/@', DATABASE_PASSWORD: 'db-password' })
  const web = Object.freeze({ api_token: 'web-token', API_KEY: 'key-value' })
  const text = '口令 value/@ %E5%8F%A3%E4%BB%A4%20value%2F%40 db-password web-token key-value web-token'
  assert.equal(redact(text, api, web), '[已隐藏] [已隐藏] [已隐藏] [已隐藏] [已隐藏] [已隐藏]')
  assert.deepEqual(api, { jwt_secret: '口令 value/@', DATABASE_PASSWORD: 'db-password' })
  assert.deepEqual(web, { api_token: 'web-token', API_KEY: 'key-value' })
})

test('先替换较长凭据，避免共同前缀使剩余密钥泄漏', () => {
  assert.equal(
    redact('prefix prefix-long prefix-longer', {
      TOKEN: 'prefix',
      PASSWORD: 'prefix-long',
      SECRET: 'prefix-longer',
    }),
    '[已隐藏] [已隐藏] [已隐藏]',
  )
})

test('脱敏保留普通配置、空值及短值，四字符密钥开始隐藏', () => {
  assert.equal(
    redact('public-label abc abcd', {
      SITE_TITLE: 'public-label',
      EMPTY_SECRET: '',
      MISSING_TOKEN: undefined,
      NULL_PASSWORD: null,
      SHORT_KEY: 'abc',
      API_KEY: 'abcd',
    }),
    'public-label abc [已隐藏]',
  )
  assert.equal(redact(1234), '1234')
  assert.equal(redact(null), 'null')
})

test('未提供环境时也隐藏 PostgreSQL URL 凭据，并保留目标和普通 URL', () => {
  assert.equal(
    redact(
      'postgres://alice:p%40ss@127.0.0.1:5433/blog?sslmode=require ' +
        'POSTGRESQL://bob:fixture-pass@[::1]:5434/notes\nhttps://example.test/path',
    ),
    'postgres://[已隐藏]@127.0.0.1:5433/blog?sslmode=require ' +
      'POSTGRESQL://[已隐藏]@[::1]:5434/notes\nhttps://example.test/path',
  )
})
