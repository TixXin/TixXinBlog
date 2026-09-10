/** @file link-fixtures-integration.ts @description 友链真实样本、URL语义、推荐统计、保留设置、失败回滚、幂等和跨业务媒体清理 */
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { createBrowserTestApp } from './test-app.mjs'
import { seedLinkBrowserFixture } from './link-fixture.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'
import { LinkService } from '../src/modules/link/link.service'
import { GalleryService } from '../src/modules/gallery/gallery.service'
import { ProjectService } from '../src/modules/project/project.service'
import { LINK_EXTERNAL_LOGO } from '../src/seeders/link-fixtures'
import { seedDevelopmentData } from '../src/seeders/seed-development-data'
import { removeDevelopmentData } from '../src/seeders/remove-development-data'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const seed = () =>
    seedDevelopmentData(
      ['--dataset', 'link-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
  const cleanup = (apply = false) =>
    removeDevelopmentData(
      ['--dataset', 'link-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
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
    await assert.rejects(seedLinkBrowserFixture({ testOrm: { config: { get: () => 'tixxin_blog' } } }), /隔离数据库/)
    const service = new LinkService(em)
    await service.saveSettings({
      revision: 0,
      rules: ['长期保留认真维护的站点。', '资料由博主整理，尚未开放在线申请。'],
    })
    const settings = (await em.execute('select * from link_settings'))[0]
    const posts = await em.execute('select * from post order by id')
    assert.equal((await inspectDataCatalog(em, 'links')).domains[0].ownership.state, 'not-seeded')
    await em.execute(
      "create function reject_link_fixture() returns trigger language plpgsql as $$ begin if new.name='MDN Web Docs' then raise exception 'link_fixture_failure'; end if; return new; end $$",
    )
    await em.execute(
      'create trigger reject_link_fixture before insert on friend_link for each row execute function reject_link_fixture()',
    )
    await assert.rejects(seed(), /link_fixture_failure/)
    for (const table of ['friend_link', 'media_asset', 'development_fixture'])
      assert.equal((await em.execute(`select count(*)::int n from ${table}`))[0].n, 0)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), [])
    await em.execute('drop trigger reject_link_fixture on friend_link')
    await em.execute('drop function reject_link_fixture()')
    const seeded = await seed()
    assert.equal(seeded.ready, true)
    assert.equal(seeded.created.length, 21)
    assert.equal(seeded.expectedRecords, 21)
    assert.deepEqual((await em.execute('select * from link_settings'))[0], settings)
    const catalog = await inspectDataCatalog(em, 'links')
    assert.equal(catalog.ready, true, JSON.stringify(catalog))
    assert.equal(catalog.domains[0].media.available, 3)
    assert.equal(catalog.domains[0].counts.managed, 3)
    assert.equal(catalog.domains[0].counts.references, 3)
    assert.deepEqual((await inspectDataCatalog(em, 'links', '不会出现的站点')).domains[0].filter, {
      matched: 0,
      state: 'normal-empty-filter',
    })
    const first = await get('/links'),
      second = await get('/links?page=2')
    assert.equal(first.items.length, 12)
    assert.equal(second.items.length, 4)
    assert.equal(first.total, 16)
    const links = [...first.items, ...second.items]
    assert.equal(new Set(links.map((link) => link.id)).size, 16)
    assert(links.slice(0, 4).every((link) => link.isFeatured))
    assert(links.slice(4).every((link) => !link.isFeatured))
    assert.equal((await get('/links?featured=true')).total, 4)
    assert.equal((await get('/links?featured=false')).total, 12)
    assert.equal((await get('/links?q=Vue')).total, 2)
    assert(
      links.every(
        (link) =>
          link.domain === new URL(link.url).host &&
          !('status' in link) &&
          !('logoMediaId' in link) &&
          !('revision' in link) &&
          !('verified' in link),
      ),
    )
    assert(links.every((link) => !/开发示例|测试数据|演示用途|已验证互链/.test(link.name + link.description)))
    assert(links.some((link) => link.avatar === null))
    assert(links.some((link) => link.avatar === LINK_EXTERNAL_LOGO && link.width === null && link.height === null))
    const metadata = await get('/links/metadata')
    assert.deepEqual(metadata.stats, {
      links: 16,
      featured: 4,
      domains: new Set(links.map((link) => link.domain)).size,
    })
    assert.equal(metadata.stats.domains, 15)
    assert.deepEqual(metadata.rules, settings.rules)
    const media = await em.execute('select * from media_asset order by id')
    assert.equal(new Set(media.map((image) => image.sha256)).size, 3)
    for (const image of media) {
      const response = await fetch(fixture.origin + `/api/v1/media/${image.id}.webp`)
      assert.equal(response.status, 200)
      const bytes = Buffer.from(await response.arrayBuffer())
      const info = await sharp(bytes).metadata()
      assert.equal(info.width, image.width)
      assert.equal(info.height, image.height)
      assert.equal(info.format, 'webp')
      assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256)
    }
    const snapshots = await em.execute('select * from friend_link order by id')
    const ownership = await em.execute('select * from development_fixture order by key')
    assert.equal((await seed()).created.length, 0)
    assert.deepEqual(await em.execute('select * from friend_link order by id'), snapshots)
    assert.equal((await seedLinkBrowserFixture(fixture)).retained.length, 21)
    assert.equal((await cleanup()).remove.length, 21)
    const urlService = new LinkService(em.fork())
    await assert.rejects(
      urlService.save(null, { name: '同址提交', url: 'HTTPS://VUEJS.ORG:443/', requestId: randomUUID() }),
      /已存在/,
    )
    const variants = [
      'HTTPS://EXAMPLE.COM:443/Guide?x=1&x=2#Intro',
      'https://example.com/guide?x=1&x=2#Intro',
      'https://example.com/Guide/?x=1&x=2#Intro',
      'https://example.com/Guide?x=2&x=1#Intro',
      'https://example.com/Guide?x=1&x=2#intro',
    ]
    const normalized: string[] = []
    const actualFetch = globalThis.fetch
    let remoteFetches = 0
    globalThis.fetch = async () => {
      remoteFetches++
      throw new Error('友链写入不得抓取地址')
    }
    try {
      for (const [index, url] of variants.entries())
        normalized.push((await urlService.save(null, { name: `地址语义 ${index}`, url, requestId: randomUUID() })).url)
    } finally {
      globalThis.fetch = actualFetch
    }
    assert.equal(remoteFetches, 0)
    assert.equal(normalized[0], 'https://example.com/Guide?x=1&x=2#Intro')
    assert.equal(new Set(normalized).size, 5)
    await assert.rejects(
      urlService.save(null, { name: '规范化重复', url: normalized[0], requestId: randomUUID() }),
      /已存在/,
    )
    assert.equal((await get('/links')).total, 16)
    const absent = join(process.env.MEDIA_DIRECTORY!, media[0].storage_key),
      original = await readFile(absent)
    await unlink(absent)
    try {
      const missing = await inspectDataCatalog(em, 'links')
      assert.equal(missing.ready, false)
      assert.deepEqual(missing.domains[0].media.unavailable, [media[0].id])
      await assert.rejects(seed(), /ENOENT/)
    } finally {
      await writeFile(absent, original)
    }
    const edited = snapshots[3],
      deleted = snapshots[4]
    await em.execute("update friend_link set description='保留我后来补充的阅读路线',revision=revision+1 where id=?", [
      edited.id,
    ])
    await em.execute('delete from friend_link where id=?', [deleted.id])
    const noRevival = await seed()
    assert.equal(noRevival.created.length, 0)
    assert.equal(noRevival.ready, false)
    assert(noRevival.unavailable.includes('link-v1/link/4'))
    assert.equal((await em.execute('select count(*)::int n from friend_link where id=?', [deleted.id]))[0].n, 0)
    const changed = await inspectDataCatalog(em, 'links')
    assert.equal(changed.domains[0].ownership.state, 'deleted-fixtures')
    assert.deepEqual(changed.domains[0].ownership.edited, ['link-v1/link/3'])
    const vue = ownership.find((item) => item.key === 'link-v1/media/vue').resource_id
    const typescript = ownership.find((item) => item.key === 'link-v1/media/typescript').resource_id
    const photo = await new GalleryService(em).save(null, {
      title: 'Vue 标志收藏',
      mediaId: vue,
      requestId: randomUUID(),
    })
    const project = await new ProjectService(em).save(null, {
      title: '类型工具整理',
      coverMediaId: typescript,
      requestId: randomUUID(),
    })
    const protectedPlan = await cleanup()
    assert(protectedPlan.preserve.some((item) => item.key === 'link-v1/media/vue'))
    assert(protectedPlan.preserve.some((item) => item.key === 'link-v1/media/typescript'))
    assert(protectedPlan.remove.some((item) => item.key === 'link-v1/media/vite'))
    assert(protectedPlan.remove.some((item) => item.key === 'link-v1/link/0'))
    await assert.rejects(cleanup(true), /其他连接/)
    const files = await readdir(process.env.MEDIA_DIRECTORY!)
    await fixture.stopServices()
    assert('backup' in (await cleanup(true)))
    await fixture.testOrm.connect()
    reconnected = true
    const after = fixture.testOrm.em.fork()
    assert.equal((await after.execute('select media_id from gallery_photo where id=?', [photo.id]))[0].media_id, vue)
    assert.equal(
      (await after.execute('select cover_media_id from project where id=?', [project.id]))[0].cover_media_id,
      typescript,
    )
    assert.equal((await after.execute('select count(*)::int n from media_asset'))[0].n, 2)
    assert.equal(
      (await after.execute('select description from friend_link where id=?', [edited.id]))[0].description,
      '保留我后来补充的阅读路线',
    )
    assert.deepEqual(await after.execute('select * from post order by id'), posts)
    assert.deepEqual((await after.execute('select * from link_settings'))[0], settings)
    assert.deepEqual(await after.execute('select * from development_fixture order by key'), ownership)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), files)
    assert.equal((await cleanup()).remove.length, 0)
    assert.equal((await seed()).created.length, 0)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  } finally {
    if (reconnected) await fixture.testOrm.close(true)
    await fixture.close()
  }
  process.stdout.write(
    '友链样本通过：18记录/3标志、分页推荐统计、保留规则、URL规范化与路径参数区别、不抓取地址、事务回滚、幂等编辑删除保护及图库项目跨业务引用保护\n',
  )
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
