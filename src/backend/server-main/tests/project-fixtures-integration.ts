/** @file project-fixtures-integration.ts @description 项目种子独立运行、真实分页与技术统计、事务补偿、归属幂等和跨数据集封面保护 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { ConfigService } from '@nestjs/config'
import { createBrowserTestApp } from './test-app.mjs'
import { seedProjectBrowserFixture } from './project-fixture.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'
import { LocalMediaStorage } from '../src/modules/media/media-storage'
import { lockMedia } from '../src/modules/media/media-references'
import { seedGalleryFixtures } from '../src/seeders/gallery-fixtures'
import { GalleryService } from '../src/modules/gallery/gallery.service'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const seed = (apply = true) =>
    seedDevelopmentData(
      ['--dataset', 'project-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
      () => undefined,
      fixture.backupOptions,
    )
  const cleanup = (apply = false) =>
    removeDevelopmentData(
      ['--dataset', 'project-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
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
    await assert.rejects(seedProjectBrowserFixture({ testOrm: { config: { get: () => 'tixxin_blog' } } }), /隔离数据库/)
    const beforePosts = await em.execute('select * from post order by id')
    assert.equal((await seed(false)).preview, true)
    assert.equal((await inspectDataCatalog(em, 'projects')).domains[0].ownership.state, 'not-seeded')
    await em.execute(
      "create function reject_project_fixture() returns trigger language plpgsql as $$ begin if new.title='组件索引' then raise exception 'project_fixture_failure'; end if; return new; end $$",
    )
    await em.execute(
      'create trigger reject_project_fixture before insert on project for each row execute function reject_project_fixture()',
    )
    await assert.rejects(seed(), /project_fixture_failure/)
    for (const table of ['project', 'media_asset', 'development_fixture'])
      assert.equal((await em.execute(`select count(*)::int as count from ${table}`))[0].count, 0)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), [])
    await em.execute('drop trigger reject_project_fixture on project')
    await em.execute('drop function reject_project_fixture()')

    const seeded = await seed()
    assert.equal(seeded.ready, true)
    assert.equal(seeded.created.length, 21)
    assert.equal(seeded.expectedRecords, 21)
    assert.equal(
      (await em.execute('select count(*)::int as count from gallery_photo'))[0].count,
      0,
      '项目种子不能依赖图库先补种',
    )
    const catalog = await inspectDataCatalog(em, 'projects')
    assert.equal(catalog.ready, true, JSON.stringify(catalog))
    assert.equal(catalog.domains[0].counts.published, 16)
    assert.equal(catalog.domains[0].counts.drafts, 1)
    assert.equal(catalog.domains[0].counts.withdrawn, 1)
    assert.equal(catalog.domains[0].media.available, 3)
    assert.equal(catalog.domains[0].counts.covered, catalog.domains[0].counts.references)
    assert.deepEqual((await inspectDataCatalog(em, 'projects', '没有这个项目')).domains[0].filter, {
      matched: 0,
      state: 'normal-empty-filter',
    })
    const first = await get('/projects'),
      second = await get('/projects?page=2')
    assert.equal(first.items.length, 12)
    assert.equal(second.items.length, 4)
    assert.equal(first.total, 16)
    const projects = [...first.items, ...second.items]
    assert.equal(new Set(projects.map((project) => project.id)).size, 16)
    assert.deepEqual([...new Set(projects.map((project) => project.progress))].sort(), ['active', 'archived', 'dev'])
    assert(
      projects.every(
        (project) =>
          !('status' in project) && !('revision' in project) && !('requestId' in project) && !('stars' in project),
      ),
    )
    assert(projects.every((project) => !/开发示例|测试数据|演示用途/.test(project.title + project.description)))
    assert(projects.some((project) => project.links.length === 0))
    assert(projects.some((project) => project.cover === null && project.width === null && project.height === null))
    assert(projects.some((project) => project.cover && project.width > 0 && project.height > 0))
    const sources = projects.flatMap((project) => project.links.filter((link) => link.kind === 'source'))
    assert.deepEqual(
      sources.map((link) => link.href),
      ['https://github.com/TixXin/TixXinBlog'],
    )
    for (const project of projects)
      for (const link of project.links) {
        assert(['source', 'docs'].includes(link.kind))
        assert.equal(new URL(link.href).protocol, 'https:')
        assert.notEqual(link.href, '#')
      }
    assert.equal((await get('/projects?progress=active')).total, 8)
    assert.equal((await get('/projects?progress=dev')).total, 4)
    assert.equal((await get('/projects?progress=archived')).total, 4)
    assert.equal((await get('/projects?q=TixXinBlog')).total, 1)
    const metadata = await get('/projects/metadata')
    const labels = new Set(projects.flatMap((project) => project.tags.map((tag) => tag.label.toLowerCase())))
    assert.deepEqual(metadata.stats, { projects: 16, active: 8, dev: 4, archived: 4, tags: labels.size })
    assert.equal(metadata.tags.length, labels.size)
    for (const tag of metadata.tags) {
      const count = projects.filter((project) =>
        project.tags.some((value) => value.label.toLowerCase() === tag.label.toLowerCase()),
      ).length
      assert.equal(tag.count, count)
      assert.equal(tag.percent, Math.round((count * 100) / projects.length))
      assert.equal((await get(`/projects?tag=${encodeURIComponent(tag.label.toUpperCase())}`)).total, count)
    }

    const media = await em.execute('select * from media_asset order by id')
    assert.equal(new Set(media.map((image) => image.sha256)).size, 3)
    for (const image of media) {
      const response = await fetch(fixture.origin + `/api/v1/media/${image.id}.webp`)
      assert.equal(response.status, 200)
      const bytes = Buffer.from(await response.arrayBuffer())
      const decoded = await sharp(bytes).metadata()
      assert.equal(decoded.width, image.width)
      assert.equal(decoded.height, image.height)
      assert.equal(decoded.format, 'webp')
      assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256)
    }
    const snapshots = await em.execute('select * from project order by id')
    const ownership = await em.execute('select * from development_fixture order by key')
    const browserRepeat = await seedProjectBrowserFixture(fixture)
    assert.equal(browserRepeat.created.length, 0)
    assert.equal(browserRepeat.retained.length, 21)
    assert.equal((await seed()).created.length, 0)
    assert.deepEqual(await em.execute('select * from project order by id'), snapshots)
    assert.equal((await cleanup()).remove.length, 21)

    const absent = join(process.env.MEDIA_DIRECTORY!, media[0].storage_key)
    const bytes = await readFile(absent)
    await unlink(absent)
    try {
      const missing = await inspectDataCatalog(em, 'projects')
      assert.equal(missing.ready, false)
      assert.deepEqual(missing.domains[0].media.unavailable, [media[0].id])
      assert.equal(missing.domains[0].counts.total, 18)
      await assert.rejects(seed(), /ENOENT/)
    } finally {
      await writeFile(absent, bytes)
    }

    const [edited, deleted] = snapshots
    await em.execute("update project set title='自己维护的博客项目',revision=revision+1 where id=?", [edited.id])
    await em.execute('delete from project where id=?', [deleted.id])
    const noRevival = await seed()
    assert.equal(noRevival.created.length, 0)
    assert.equal(noRevival.ready, false)
    assert(noRevival.unavailable.includes('project-v1/project/1'))
    assert.equal((await em.execute('select title from project where id=?', [edited.id]))[0].title, '自己维护的博客项目')
    assert.equal((await em.execute('select count(*)::int as count from project where id=?', [deleted.id]))[0].count, 0)
    const changed = await inspectDataCatalog(em, 'projects')
    assert.equal(changed.domains[0].ownership.state, 'deleted-fixtures')
    assert.deepEqual(changed.domains[0].ownership.edited, ['project-v1/project/0'])
    assert.deepEqual(changed.domains[0].ownership.deleted, ['project-v1/project/1'])

    const storage = new LocalMediaStorage(new ConfigService(process.env))
    await em.transactional(async (transaction) => {
      await lockMedia(transaction)
      await seedGalleryFixtures(transaction, storage, { created: [], retained: [], unavailable: [] }, [])
    })
    const shared = ownership.find((item) => item.key === 'project-v1/media/mist').resource_id
    const [photo] = await em.execute('select id,revision from gallery_photo order by id limit 1')
    await new GalleryService(em).save(photo.id, { revision: photo.revision, mediaId: shared })
    const galleryBefore = await em.execute('select * from gallery_photo order by id')
    const ledgerBefore = await em.execute('select * from development_fixture order by key')
    const guarded = await cleanup()
    assert(guarded.preserve.some((item) => item.key === 'project-v1/media/mist'))
    assert(guarded.preserve.some((item) => item.key === 'project-v1/media/skyline'))
    assert(guarded.remove.some((item) => item.key === 'project-v1/media/ridge'))
    assert(guarded.remove.some((item) => item.key === 'project-v1/project/4'))
    assert(guarded.preserve.some((item) => item.key === 'project-v1/project/0'))
    await assert.rejects(cleanup(true), /其他连接/)
    const files = await readdir(process.env.MEDIA_DIRECTORY!)
    await fixture.stopServices()
    const removed = await cleanup(true)
    assert('backup' in removed)
    await fixture.testOrm.connect()
    reconnected = true
    const after = fixture.testOrm.em.fork()
    assert.deepEqual(await after.execute('select * from gallery_photo order by id'), galleryBefore)
    assert.deepEqual(await after.execute('select * from post order by id'), beforePosts)
    assert.deepEqual(await after.execute('select * from development_fixture order by key'), ledgerBefore)
    assert.equal(
      (await after.execute('select count(*)::int as count from media_asset where id=?', [shared]))[0].count,
      1,
    )
    assert.equal(
      (
        await after.execute(
          'select count(*)::int as count from media_reference where gallery_photo_id=? and asset_id=?',
          [photo.id, shared],
        )
      )[0].count,
      1,
    )
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), files)
    assert.equal((await cleanup()).remove.length, 0)
    assert.equal((await seed()).created.length, 0)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '项目样本通过：独立18项目/3封面、两页公开、三种进展、有效文档链接、真实图片与统计、失败回滚、归属幂等、编辑删除保护、跨数据集图库引用保护及清理不复活\n',
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
