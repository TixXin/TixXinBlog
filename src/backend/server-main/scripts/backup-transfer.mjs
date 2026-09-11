/** @file backup-transfer.mjs @description 显式配置的备份传输及接收器；流式写入、摘要确认、独立归属目录，不获取内容外链。 */
import { createServer } from 'node:http'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, lstat, realpath, rename, unlink } from 'node:fs/promises'
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { resolve, join, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { verifyFullBackup } from './full-backup.mjs'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const taskPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-[1-9][0-9]*$/i
async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
export async function transferBackup(directory, { url, token, ownerId, taskId }) {
  if (!UUID.test(ownerId) || !taskPattern.test(taskId) || token.length < 32) throw new Error('备份传输配置不合法')
  const destination = new URL(url)
  if (
    destination.username ||
    destination.password ||
    destination.search ||
    destination.hash ||
    !(
      destination.protocol === 'https:' ||
      (destination.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname))
    )
  )
    throw new Error('备份传输要求 HTTPS 或明确的本机接收器')
  const { root, manifest } = await verifyFullBackup(directory)
  const files = ['database.dump', ...manifest.media.map((item) => `media/${item.key}`), 'manifest.json']
  let totalBytes = 0
  const base = destination.toString().replace(/\/$/, '') + `/${ownerId}/${taskId}`
  for (const relative of files) {
    const path = join(root, relative),
      bytes = (await lstat(path)).size
    totalBytes += bytes
    const response = await fetch(`${base}/${relative}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes),
        'X-Content-SHA256': await digest(path),
      },
      body: createReadStream(path),
      duplex: 'half',
      redirect: 'error',
      signal: AbortSignal.timeout(300000),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error('备份文件传输失败')
    }
    await response.body?.cancel()
  }
  const sha256 = await digest(join(root, 'manifest.json'))
  const response = await fetch(`${base}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Manifest-SHA256': sha256 },
    redirect: 'error',
    signal: AbortSignal.timeout(300000),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('远端备份校验失败')
  }
  const text = await response.text()
  if (text.length > 4096) throw new Error('备份回执格式不合法')
  const result = JSON.parse(text)
  if (
    result.verified !== true ||
    result.manifestSha256 !== sha256 ||
    result.totalBytes !== totalBytes ||
    result.ownerId !== ownerId ||
    result.backupId !== taskId
  )
    throw new Error('远端备份摘要回执不一致')
  return { verified: true, manifestSha256: sha256, totalBytes }
}
export async function createBackupReceiver({
  directory,
  ownerId,
  token,
  prefix = '/backups',
  maxFileBytes = 64 * 1024 ** 3,
}) {
  if (!UUID.test(ownerId) || typeof token !== 'string' || token.length < 32 || !/^\/[A-Za-z0-9/_-]+$/.test(prefix))
    throw new Error('备份接收器配置不合法')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const root = await realpath(directory)
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('接收根目录不允许符号链接')
  const staging = join(root, '.staging'),
    permanent = join(root, ownerId)
  for (const path of [staging, permanent]) {
    await mkdir(path, { recursive: true, mode: 0o700 })
    if ((await realpath(path)) !== path || (await lstat(path)).isSymbolicLink()) throw new Error('接收目录归属不合法')
  }
  const active = new Set()
  return createServer(async (request, response) => {
    const reply = (status, value) => {
      if (!response.headersSent) response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(value))
    }
    const supplied = Buffer.from(request.headers.authorization ?? ''),
      expected = Buffer.from(`Bearer ${token}`)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      request.resume()
      reply(401, { error: 'unauthorized' })
      return
    }
    let temporary
    let lockKey
    let acquired = false
    try {
      const url = new URL(request.url, 'http://receiver.invalid')
      const pattern = new RegExp(
        `^${prefix}/${ownerId}/([^/]+)/(database\\.dump|manifest\\.json|media/[a-f0-9-]+\\.webp|complete)$`,
        'i',
      )
      const match = pattern.exec(url.pathname)
      if (!match || !taskPattern.test(match[1]) || url.search) {
        request.resume()
        reply(400, { error: 'invalid_path' })
        return
      }
      const backupId = match[1],
        relative = match[2],
        target = resolve(staging, backupId),
        final = resolve(permanent, backupId)
      if (!target.startsWith(staging + sep) || !final.startsWith(permanent + sep)) throw new Error('path')
      lockKey = backupId
      if (active.has(lockKey)) {
        request.resume()
        reply(409, { error: 'upload_busy' })
        return
      }
      active.add(lockKey)
      acquired = true
      if (request.method === 'POST' && relative === 'complete') {
        request.resume()
        const source = await lstat(final).then(
          () => final,
          () => target,
        )
        if ((await realpath(source)) !== source || (await lstat(source)).isSymbolicLink()) throw new Error('path')
        const { manifest } = await verifyFullBackup(source)
        const manifestSha256 = await digest(join(source, 'manifest.json'))
        if (manifestSha256 !== request.headers['x-manifest-sha256']) throw new Error('digest')
        const totalBytes =
          manifest.database.bytes +
          manifest.media.reduce((sum, media) => sum + media.bytes, 0) +
          (await lstat(join(source, 'manifest.json'))).size
        if (source === target) {
          await writeOwnerMarker(target, { ownerId, backupId, manifestSha256 })
          await rename(target, final)
        } else await verifyOwnerMarker(final, { ownerId, backupId, manifestSha256 })
        reply(200, { verified: true, ownerId, backupId, manifestSha256, totalBytes })
        return
      }
      if (request.method !== 'PUT' || relative === 'complete') {
        request.resume()
        reply(405, { error: 'method' })
        return
      }
      const bytes = Number(request.headers['content-length']),
        checksum = request.headers['x-content-sha256']
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < 0 ||
        bytes > maxFileBytes ||
        typeof checksum !== 'string' ||
        !/^[a-f0-9]{64}$/.test(checksum)
      ) {
        request.resume()
        reply(400, { error: 'metadata' })
        return
      }
      const existsFinal = await lstat(final).then(
        () => true,
        () => false,
      )
      const directory = existsFinal ? final : target
      await mkdir(join(directory, 'media'), { recursive: true, mode: 0o700 })
      if (
        (await realpath(directory)) !== directory ||
        (await realpath(join(directory, 'media'))) !== join(directory, 'media')
      )
        throw new Error('path')
      const file = resolve(directory, relative)
      if (!file.startsWith(directory + sep)) throw new Error('path')
      if (
        await lstat(file).then(
          () => true,
          () => false,
        )
      ) {
        request.resume()
        if (
          (await lstat(file)).isSymbolicLink() ||
          (await lstat(file)).size !== bytes ||
          (await digest(file)) !== checksum
        )
          throw new Error('existing')
        reply(200, { stored: true })
        return
      }
      if (existsFinal) throw new Error('completed_backup_immutable')
      temporary = `${file}.upload-${randomUUID()}`
      const hash = createHash('sha256')
      let received = 0
      await pipeline(
        request,
        new Transform({
          transform(chunk, _encoding, done) {
            received += chunk.length
            if (received > bytes) done(new Error('size'))
            else {
              hash.update(chunk)
              done(null, chunk)
            }
          },
        }),
        createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
      )
      if (received !== bytes || hash.digest('hex') !== checksum) throw new Error('digest')
      await rename(temporary, file)
      temporary = undefined
      reply(201, { stored: true })
    } catch {
      request.resume()
      reply(400, { error: 'backup_not_verified' })
    } finally {
      if (temporary) await unlink(temporary).catch(() => {})
      if (acquired) active.delete(lockKey)
    }
  })
}
async function writeOwnerMarker(directory, value) {
  const { writeFile } = await import('node:fs/promises')
  try {
    await writeFile(
      join(directory, 'receiver-owner.json'),
      JSON.stringify({ format: 'tixxin-backup-receiver', version: 1, ...value, completedAt: new Date().toISOString() }),
      { flag: 'wx', mode: 0o600 },
    )
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    // 上次可能在写标记后、原子迁移前中断；只接受同一已验证副本的原标记。
    await verifyOwnerMarker(directory, value)
  }
}
async function verifyOwnerMarker(directory, value) {
  const path = join(directory, 'receiver-owner.json')
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096 || (await realpath(path)) !== path)
    throw new Error('receiver_owner_invalid')
  const marker = JSON.parse(await readFile(path, 'utf8'))
  if (
    marker.format !== 'tixxin-backup-receiver' ||
    marker.version !== 1 ||
    marker.ownerId !== value.ownerId ||
    marker.backupId !== value.backupId ||
    marker.manifestSha256 !== value.manifestSha256 ||
    typeof marker.completedAt !== 'string' ||
    !Number.isFinite(Date.parse(marker.completedAt))
  )
    throw new Error('receiver_owner_mismatch')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--serve') || !process.argv.includes('--apply')) {
    process.stdout.write(
      '接收器未启动。显式 --serve --apply，并提供 BACKUP_RECEIVER_DIRECTORY/OWNER_ID/TOKEN 才启动；默认仅绑定本机。\n',
    )
  } else {
    const server = await createBackupReceiver({
      directory: process.env.BACKUP_RECEIVER_DIRECTORY,
      ownerId: process.env.BACKUP_RECEIVER_OWNER_ID,
      token: process.env.BACKUP_RECEIVER_TOKEN,
    })
    server.listen(
      Number(process.env.BACKUP_RECEIVER_PORT ?? 8091),
      process.env.BACKUP_RECEIVER_HOST ?? '127.0.0.1',
      () => process.stdout.write('备份接收器已启动。\n'),
    )
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
  }
}
