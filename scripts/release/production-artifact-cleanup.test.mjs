/** @file production-artifact-cleanup.test.mjs @description 载荷清理的固定边界、元数据保留、链接拒绝与失败可见性。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile, lstat, realpath, rm, unlink, symlink } from 'node:fs/promises'
import { join, dirname, sep } from 'node:path'
import { randomInt } from 'node:crypto'
import { cleanupProductionArtifacts, productionArtifactRoot } from './production-artifact-cleanup.mjs'

async function fixture() {
  const name = `tixxin-production-smoke-${Date.now()}-${randomInt(100000, 999999)}`
  const directory = join(productionArtifactRoot, name)
  await mkdir(directory, { recursive: true })
  await mkdir(join(directory, 'backup', 'media', 'nested'), { recursive: true })
  await mkdir(join(directory, 'restored', 'media'), { recursive: true })
  const files = {
    'verification-report.json': JSON.stringify({ id: name, status: 'passed' }),
    'build-api.log': '构建日志',
    'backup/database.dump': 'isolated database',
    'backup/media/photo.webp': 'isolated image',
    'backup/media/nested/second.webp': 'another image',
    'backup/manifest.json': '{"format":"retained manifest"}',
    'backup/worker-owner.json': '{"ownerId":"retained owner"}',
    'restored/media/photo.webp': 'restored image',
    'restored/restore-report.json': '{"rowDigestsVerified":true}',
    'restored/connection.json': '{"password":"isolated temporary credential"}',
    'production.env': 'ISOLATED_SECRET=temporary\n',
  }
  for (const [path, text] of Object.entries(files)) await writeFile(join(directory, path), text)
  return { directory, files }
}
async function removeFixture(directory) {
  assert.equal(dirname(directory), productionArtifactRoot)
  assert.equal(await realpath(directory), directory)
  assert(directory.startsWith(productionArtifactRoot + sep))
  await rm(directory, { recursive: true })
}
async function missing(path) {
  await assert.rejects(lstat(path), (error) => error.code === 'ENOENT')
}

test('仅移除固定数据库、媒体与临时凭据，保留报告和manifest，重复执行幂等', async () => {
  const { directory, files } = await fixture()
  try {
    const result = await cleanupProductionArtifacts(directory)
    assert.equal(result.payloadsRemoved, true)
    assert.equal(result.environmentRemoved, true)
    assert.equal(result.payloadFilesRemoved, 4)
    assert.equal(result.credentialFilesRemoved, 1)
    assert.equal(result.environmentFilesRemoved, 1)
    for (const path of [
      'backup/database.dump',
      'backup/media',
      'restored/media',
      'restored/connection.json',
      'production.env',
    ])
      await missing(join(directory, path))
    for (const path of [
      'verification-report.json',
      'build-api.log',
      'backup/manifest.json',
      'backup/worker-owner.json',
      'restored/restore-report.json',
    ])
      assert.equal(await readFile(join(directory, path), 'utf8'), files[path])
    const repeated = await cleanupProductionArtifacts(directory)
    assert.equal(repeated.payloadFilesRemoved, 0)
    assert.equal(repeated.payloadsRemoved, true)
    assert.equal(repeated.environmentRemoved, true)
  } finally {
    await removeFixture(directory)
  }
})

test('拒绝运行目录之外或非法名称，不处理其数据', async () => {
  await assert.rejects(
    cleanupProductionArtifacts(join(productionArtifactRoot, '..', 'daily-backup')),
    /允许的本次运行范围/,
  )
  await assert.rejects(
    cleanupProductionArtifacts(join(productionArtifactRoot, 'arbitrary-folder')),
    /允许的本次运行范围/,
  )
})

test('媒体中的目录链接导致预检失败，链接目标和原dump都保留', async () => {
  const first = await fixture(),
    second = await fixture()
  const link = join(first.directory, 'restored', 'media', 'foreign')
  try {
    await symlink(join(second.directory, 'backup'), link, process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(cleanupProductionArtifacts(first.directory), /链接/)
    assert.equal(await readFile(join(first.directory, 'backup', 'database.dump'), 'utf8'), 'isolated database')
    assert.equal(await readFile(join(second.directory, 'backup', 'database.dump'), 'utf8'), 'isolated database')
  } finally {
    await unlink(link)
    await removeFixture(first.directory)
    await removeFixture(second.directory)
  }
})

test('环境路径不是普通文件时显式失败，不静默报告清理成功', async () => {
  const { directory } = await fixture()
  try {
    await unlink(join(directory, 'production.env'))
    await mkdir(join(directory, 'production.env'))
    await assert.rejects(cleanupProductionArtifacts(directory), /非预期类型/)
    assert.equal(await readFile(join(directory, 'backup', 'database.dump'), 'utf8'), 'isolated database')
  } finally {
    await removeFixture(directory)
  }
})

test('即使名称合法也拒绝链接形式的运行根目录', async () => {
  const { directory } = await fixture()
  const link = join(productionArtifactRoot, `tixxin-production-smoke-${Date.now()}-${randomInt(100000, 999999)}`)
  try {
    await symlink(directory, link, process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(cleanupProductionArtifacts(link), /链接/)
    assert.equal(await readFile(join(directory, 'backup', 'database.dump'), 'utf8'), 'isolated database')
  } finally {
    await unlink(link)
    await removeFixture(directory)
  }
})
