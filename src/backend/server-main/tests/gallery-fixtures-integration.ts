/** @file gallery-fixtures-integration.ts @description 隔离验证图库本地图片、公开分页、幂等归属、跨业务引用保护及缺失诊断 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const seed = () =>
    seedDevelopmentData(
      ['--dataset', 'gallery-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
  const cleanup = (apply = false) =>
    removeDevelopmentData(
      ['--dataset', 'gallery-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
      () => undefined,
      fixture.backupOptions,
    )
  const get = async (path: string) => {
    const response = await fetch(fixture.origin + '/api/v1' + path)
    assert.equal(response.status, 200, path)
    return (await response.json()).data
  }
  let reconnected = false
  try {
    const em = fixture.testOrm.em.fork()
    const missing = await inspectDataCatalog(em, 'gallery')
    assert.equal(missing.ready, false)
    assert.equal(missing.domains[0].ownership.state, 'not-seeded')
    const before = await em.execute('select * from post order by id')
    const seeded = await seed()
    assert.equal(seeded.ready, true)
    assert.equal(seeded.created.length, 26)
    assert.equal(seeded.expectedRecords, 26)
    const catalog = await inspectDataCatalog(em, 'gallery')
    assert.equal(catalog.ready, true, JSON.stringify(catalog))
    assert.equal(catalog.domains[0].counts.published, 16)
    assert.equal(catalog.domains[0].counts.drafts, 1)
    assert.equal(catalog.domains[0].counts.withdrawn, 1)
    assert.equal(catalog.domains[0].media.checked, 8)
    assert.equal(catalog.domains[0].media.available, 8)
    assert.equal(catalog.domains[0].ownership.original, 26)
    assert.deepEqual((await inspectDataCatalog(em, 'gallery', '不存在的作品标题')).domains[0].filter, {
      matched: 0,
      state: 'normal-empty-filter',
    })
    const first = await get('/gallery')
    const second = await get('/gallery?page=2')
    assert.equal(first.items.length, 12)
    assert.equal(second.items.length, 4)
    assert.equal(first.total, 16)
    const photos = [...first.items, ...second.items]
    assert.equal(new Set(photos.map((photo) => photo.id)).size, 16)
    assert(photos.every((photo) => !('status' in photo) && !('mediaId' in photo) && !('storageKey' in photo)))
    assert(photos.every((photo) => !/开发示例|测试数据|演示用途/.test(photo.title + photo.description)))
    assert(photos.every((photo) => photo.location === '' && photo.device === ''))
    assert(photos.some((photo) => photo.date === ''))
    assert(photos.some((photo) => photo.width > photo.height))
    assert(photos.some((photo) => photo.width < photo.height))
    const metadata = await get('/gallery/metadata')
    assert.equal(metadata.stats.photos, 16)
    assert.equal(
      metadata.categories.reduce((total, category) => total + category.count, 0),
      16,
    )
    assert.equal(metadata.stats.locations, 0)
    const sourceFiles = await em.execute('select * from media_asset order by id')
    const hashes = new Set<string>()
    for (const image of sourceFiles) {
      const response = await fetch(fixture.origin + `/api/v1/media/${image.id}.webp`)
      assert.equal(response.status, 200)
      const bytes = Buffer.from(await response.arrayBuffer())
      const decoded = await sharp(bytes).metadata()
      assert.equal(decoded.width, image.width)
      assert.equal(decoded.height, image.height)
      assert.equal(decoded.format, 'webp')
      assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256)
      hashes.add(image.sha256)
    }
    assert.equal(hashes.size, 8)
    const snapshots = await em.execute('select * from gallery_photo order by id')
    const repeated = await seed()
    assert.equal(repeated.created.length, 0)
    assert.deepEqual(await em.execute('select * from gallery_photo order by id'), snapshots)
    assert.equal((await cleanup()).remove.length, 26)

    // 实际文件暂时丢失时报告文件问题，不把正常数据库记录称作空图库，也不重新上传覆盖。
    const absent = join(process.env.MEDIA_DIRECTORY!, sourceFiles[0].storage_key)
    const original = await readFile(absent)
    await unlink(absent)
    try {
      const missingFile = await inspectDataCatalog(em, 'gallery')
      assert.equal(missingFile.ready, false)
      assert.equal(missingFile.domains[0].counts.total, 18)
      assert.deepEqual(missingFile.domains[0].media.unavailable, [sourceFiles[0].id])
      // 缺文件会阻止完整备份，工具必须拒绝写入；不能借补种静默替换已有资源。
      await assert.rejects(seed(), /ENOENT/)
      assert.deepEqual(await em.execute('select * from gallery_photo order by id'), snapshots)
    } finally {
      await writeFile(absent, original)
    }

    const ownership = await em.execute('select * from development_fixture order by key')
    const [edited, deleted] = snapshots
    await em.execute("update gallery_photo set title='自己选的山色',revision=revision+1 where id=?", [edited.id])
    await em.execute('delete from gallery_photo where id=?', [deleted.id])
    const afterDelete = await seed()
    assert.equal(afterDelete.created.length, 0)
    assert.equal(afterDelete.ready, false)
    assert(afterDelete.unavailable.includes('gallery-v1/gallery/1'))
    assert.equal((await em.execute('select title from gallery_photo where id=?', [edited.id]))[0].title, '自己选的山色')
    assert.equal((await em.execute('select count(*)::int n from gallery_photo where id=?', [deleted.id]))[0].n, 0)
    const changed = await inspectDataCatalog(em, 'gallery')
    assert.equal(changed.domains[0].state, 'changed-fixtures')
    assert.deepEqual(changed.domains[0].ownership.edited, ['gallery-v1/gallery/0'])
    assert.deepEqual(changed.domains[0].ownership.deleted, ['gallery-v1/gallery/1'])
    assert.match(changed.domains[0].repair, /不会复活/)

    // 外部文章当前引用与历史引用分别保护图库媒体，即使作品本身仍可定向清理。
    const shared = snapshots[2].media_id
    const post = before[0]
    await em.execute('update post set cover=? where id=?', [`/api/v1/media/${shared}.webp`, post.id])
    await em.execute(
      "insert into media_reference (asset_id,source_key,kind,post_id,revision) values (?,?,'post',?,1)",
      [shared, `post:${post.id}:revision:1`, post.id],
    )
    const guarded = await cleanup()
    const sharedKey = ownership.find((item) => item.resource_id === shared && item.kind === 'media').key
    assert(guarded.preserve.some((item) => item.key === sharedKey))
    assert(guarded.preserve.some((item) => item.key === 'gallery-v1/gallery/0'))
    assert(guarded.preserve.some((item) => item.key === 'gallery-v1/gallery/1'))
    assert(guarded.preserve.some((item) => item.key === 'gallery-v1/media/ridge'))
    assert(guarded.remove.some((item) => item.key === 'gallery-v1/gallery/2'))
    await assert.rejects(cleanup(true), /其他连接/)
    const files = await readdir(process.env.MEDIA_DIRECTORY!)
    await fixture.stopServices()
    const removed = await cleanup(true)
    assert('backup' in removed)
    await fixture.testOrm.connect()
    reconnected = true
    const after = fixture.testOrm.em.fork()
    assert.equal(
      (await after.execute('select title from gallery_photo where id=?', [edited.id]))[0].title,
      '自己选的山色',
    )
    assert.equal((await after.execute('select count(*)::int n from media_asset where id=?', [shared]))[0].n, 1)
    assert.equal((await after.execute('select count(*)::int n from post'))[0].n, before.length)
    assert.equal(
      (await after.execute('select count(*)::int n from media_reference where post_id=?', [post.id]))[0].n,
      1,
    )
    assert.deepEqual(await after.execute('select * from development_fixture order by key'), ownership)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), files)
    assert.equal((await cleanup()).remove.length, 0)
    assert.equal((await seed()).created.length, 0)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '图库样本通过：18作品/8实图、两页公开、分类统计、真实横竖尺寸、重复不变、编辑/删除/媒体缺失诊断、跨业务历史引用保护、备份与指定清理不复活\n',
    )
  } finally {
    if (reconnected) await fixture.testOrm.close(true)
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
