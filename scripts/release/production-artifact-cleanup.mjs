/** @file production-artifact-cleanup.mjs @description 仅清理本次生产隔离验收的固定数据载荷与临时凭据，保留文字证据。 */
import { lstat, realpath, readdir, unlink, rmdir } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const productionArtifactRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.artifacts/production-release',
)
const runName = /^tixxin-production-smoke-[0-9]+-[0-9]+$/

async function maybeStat(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function assertPhysical(path, kind) {
  const stat = await lstat(path)
  if (
    stat.isSymbolicLink() ||
    (await realpath(path)) !== path ||
    !(kind === 'directory' ? stat.isDirectory() : stat.isFile())
  )
    throw new Error('隔离验收清理拒绝链接、非预期类型或真实路径变化')
  return stat
}

async function assertRun(runDirectory) {
  const target = resolve(runDirectory)
  if (dirname(target) !== productionArtifactRoot || !runName.test(basename(target)))
    throw new Error('隔离验收清理目录不在允许的本次运行范围')
  await assertPhysical(productionArtifactRoot, 'directory')
  await assertPhysical(target, 'directory')
  return target
}

async function assertTree(path, boundary) {
  if (path !== boundary && !path.startsWith(boundary + sep)) throw new Error('隔离验收载荷路径越界')
  const stat = await lstat(path)
  if (stat.isSymbolicLink()) throw new Error('隔离验收数据目录含链接，保留现场并拒绝清理')
  await assertPhysical(path, stat.isDirectory() ? 'directory' : 'file')
  if (stat.isDirectory()) {
    for (const name of await readdir(path)) await assertTree(join(path, name), boundary)
  }
}

/** 所有目标先校验，再逐个 unlink/rmdir；不把递归删除交给未经复核的路径。 */
export async function cleanupProductionArtifacts(runDirectory) {
  const target = await assertRun(runDirectory)
  const payloadRoots = ['backup', 'restored'].map((name) => join(target, name))
  const environment = join(target, 'production.env')
  for (const path of payloadRoots) {
    if (await maybeStat(path)) {
      await assertPhysical(path, 'directory')
      await assertTree(path, path)
      for (const [name, kind] of [
        ['database.dump', 'file'],
        ['media', 'directory'],
      ]) {
        const child = join(path, name)
        if (await maybeStat(child)) await assertPhysical(child, kind)
      }
    }
  }
  if (await maybeStat(environment)) await assertPhysical(environment, 'file')
  const connection = join(target, 'restored', 'connection.json')
  if (await maybeStat(connection)) await assertPhysical(connection, 'file')
  const result = {
    payloadsRemoved: true,
    environmentRemoved: true,
    payloadFilesRemoved: 0,
    payloadBytesRemoved: 0,
    credentialFilesRemoved: 0,
    environmentFilesRemoved: 0,
    removedPaths: [],
  }
  async function removeFile(path, category) {
    await assertRun(target)
    const stat = await assertPhysical(path, 'file')
    await unlink(path)
    if (category === 'payload') {
      result.payloadFilesRemoved++
      result.payloadBytesRemoved += stat.size
    } else if (category === 'credential') result.credentialFilesRemoved++
    else result.environmentFilesRemoved++
    result.removedPaths.push(
      path
        .slice(target.length + 1)
        .split(sep)
        .join('/'),
    )
  }
  async function removeMedia(path, boundary) {
    await assertRun(target)
    await assertPhysical(boundary, 'directory')
    await assertPhysical(path, 'directory')
    for (const name of await readdir(path)) {
      const child = join(path, name)
      if (!child.startsWith(boundary + sep)) throw new Error('隔离媒体清理路径越界')
      const stat = await lstat(child)
      if (stat.isDirectory() && !stat.isSymbolicLink()) await removeMedia(child, boundary)
      else await removeFile(child, 'payload')
    }
    await assertPhysical(path, 'directory')
    await rmdir(path)
  }
  for (const path of payloadRoots) {
    if (!(await maybeStat(path))) continue
    await assertPhysical(path, 'directory')
    const database = join(path, 'database.dump')
    if (await maybeStat(database)) await removeFile(database, 'payload')
    const media = join(path, 'media')
    if (await maybeStat(media)) await removeMedia(media, media)
  }
  if (await maybeStat(connection)) await removeFile(connection, 'credential')
  if (await maybeStat(environment)) await removeFile(environment, 'environment')
  for (const path of [
    ...payloadRoots.flatMap((path) => [join(path, 'database.dump'), join(path, 'media')]),
    connection,
    environment,
  ])
    if (await maybeStat(path)) throw new Error('隔离验收数据或临时凭据仍存在，清理未完成')
  result.payloadCleanupAt = new Date().toISOString()
  return result
}
