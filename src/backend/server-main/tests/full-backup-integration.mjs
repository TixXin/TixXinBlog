/**
 * @file full-backup-integration.mjs
 * @description 隔离数据的一致快照、并发写入、校验拒绝及无网络容器完整恢复演练。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createBrowserTestApp } from './test-app.mjs'
import {
  backendRoot,
  createFullBackup,
  verifyFullBackup,
  restoreFullBackup,
  verifyRestoredApplication,
} from '../scripts/full-backup.mjs'

const fixture = await createBrowserTestApp('http://localhost')
let restored
try {
  const login = await fetch(`${fixture.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  const token = (await login.json()).data.accessToken
  const image = new FormData()
  image.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'restore-example.png',
  )
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: image,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  async function createPost(title) {
    const response = await fetch(`${fixture.origin}/api/v1/admin/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, contentRaw: `![恢复图片](${asset.url})`, status: 'published' }),
    })
    assert.equal(response.status, 201)
    return (await response.json()).data
  }
  const sourcePost = await createPost('完整恢复校验文章')
  const commented = await fetch(`${fixture.origin}/api/v1/posts/${sourcePost.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-verification' },
    body: JSON.stringify({ author: '恢复访客', content: '恢复评论内容', avatar: asset.url }),
  })
  assert.equal(commented.status, 201)
  const flash = await fetch(`${fixture.origin}/api/v1/admin/flashes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '恢复闪念内容', images: [asset.url], isDraft: true }),
  })
  assert.equal(flash.status, 201)
  const target = resolve(backendRoot, '../../..', '.backups', `verification-${randomUUID()}`)
  const backup = await createFullBackup({
    output: join(target, 'backup'),
    onProgress: (value) => process.stdout.write(`备份阶段：${value.stage}\n`),
    onSnapshot: async () => {
      await createPost('快照之后的新文章')
    },
  })
  assert.equal(backup.manifest.counts.post, 107)
  assert.equal(
    Number((await fixture.testOrm.em.fork().execute('select count(*)::int as count from post'))[0].count),
    108,
  )
  assert.equal(backup.manifest.media.length, 1)
  await verifyFullBackup(backup.directory)
  const mediaFile = join(backup.directory, 'media', backup.manifest.media[0].key)
  const valid = await readFile(mediaFile)
  await writeFile(mediaFile, Buffer.concat([valid, Buffer.from('tamper')]))
  await assert.rejects(verifyFullBackup(backup.directory), /校验失败/)
  await writeFile(mediaFile, valid)
  restored = await restoreFullBackup(backup.directory, { output: join(target, 'restored') })
  assert.equal(restored.report.counts.post, 107)
  assert.equal(restored.report.mediaFiles, 1)
  assert.equal(restored.report.rowDigestsVerified, true)
  assert.equal(restored.report.network, 'none')
  assert.equal(restored.report.revokedRestoredSessions, true)
  assert.equal(restored.report.requireFreshContentContext, true)
  const application = process.env.RESTORE_API_IMAGE
    ? await verifyRestoredApplication(restored, process.env.RESTORE_API_IMAGE, process.env.JWT_ACCESS_SECRET, token)
    : undefined
  const report = {
    ...restored.report,
    application,
    isolatedResourcesRemoved: true,
    backupDirectory: backup.directory,
    verification: [
      '并发写入不进入既有快照',
      '数据库全部表行数与内容摘要一致',
      '媒体字节校验一致',
      '篡改文件拒绝恢复',
      '恢复不影响源库',
      '旧会话撤销与上下文轮换',
    ],
  }
  await restored.cleanup()
  restored = null
  await writeFile(join(target, 'verification-report.json'), JSON.stringify(report, null, 2))
  process.stdout.write(`完整恢复演练通过：${join(target, 'verification-report.json')}\n`)
} finally {
  await restored?.cleanup()
  await fixture.close()
}
