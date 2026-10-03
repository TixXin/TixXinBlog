/** @file prompt-fixtures-integration.ts @description 隔离验证提示词素材、样本覆盖与重复补种的历史保护 */
import assert from 'node:assert/strict'
import { ConfigService } from '@nestjs/config'
import { createBrowserTestApp } from './test-app.mjs'
import { seedPromptBrowserFixture } from './prompt-fixture.mjs'
import { seedPromptFixtures, PROMPT_FIXTURE_COUNT } from '../src/seeders/prompt-fixtures'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'
import { fixtureCleanupPlan } from '../src/seeders/fixture-cleanup-plan'
import { LocalMediaStorage } from '../src/modules/media/media-storage'
import { lockMedia } from '../src/modules/media/media-references'

async function main() {
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const em = fixture.testOrm.em.fork()
    const unrelated = await em.execute('select * from post order by id')
    assert.equal((await inspectDataCatalog(em, 'prompts')).ready, false)
    const first = await seedPromptBrowserFixture(fixture)
    assert.equal(first.created.length, PROMPT_FIXTURE_COUNT)
    const initial = await em.execute('select * from image_prompt order by id')
    const catalog = await inspectDataCatalog(em, 'prompts')
    assert.equal(catalog.ready, true, JSON.stringify(catalog))
    assert.equal(catalog.domains[0].media?.available, 11)
    assert.equal(catalog.domains[0].counts?.references, 14)
    const second = await seedPromptBrowserFixture(fixture)
    assert.equal(second.created.length, 0)
    assert.deepEqual(await em.execute('select * from image_prompt order by id'), initial)
    assert.equal((await fixtureCleanupPlan(em, 'prompts-v1')).remove.length, PROMPT_FIXTURE_COUNT)

    const get = async (path: string) => {
      const response = await fetch(fixture.origin + '/api/v1' + path)
      assert.equal(response.status, 200, path)
      return (await response.json()).data
    }
    const firstPage = await get('/prompts'),
      lastPage = await get('/prompts?page=2')
    assert.equal(firstPage.items.length, 12)
    assert.equal(lastPage.items.length, 1)
    assert.equal(firstPage.total, 13)
    assert.equal(new Set([...firstPage.items, ...lastPage.items].map((item) => item.id)).size, 13)
    const originals = firstPage.items.filter((item) => item.model === 'ImageGen')
    assert.equal(originals.length, 3)
    assert(originals.some((item) => item.width > item.height))
    assert(originals.some((item) => item.width < item.height))
    assert(originals.some((item) => item.width === item.height))
    for (const item of originals) {
      assert.equal((await fetch(fixture.origin + item.imageUrl)).status, 200)
      assert(item.prompt.length > 500)
      assert(!('revision' in item))
    }
    assert.equal((await get('/prompts/metadata')).stats.prompts, 13)
    const photoReferences = firstPage.items.filter((item) => item.sourceUrl)
    assert(photoReferences.every((item) => item.description.includes('并非此提示词的生成结果')))

    // 用户修改和物理清理都保留归属；重新补种不能覆盖或复活记录。
    const [edited, deleted] = initial
    await em.execute("update image_prompt set title='保留这次构图修改', revision=revision+1 where id=?", [edited.id])
    await em.execute('delete from image_prompt where id=?', [deleted.id])
    const progress = { created: [] as string[], retained: [] as string[], unavailable: [] as string[] }
    await em.transactional(async (tx) => {
      await lockMedia(tx)
      await seedPromptFixtures(tx, new LocalMediaStorage(new ConfigService(process.env)), progress, [])
    })
    assert.equal(progress.created.length, 0)
    assert.equal(progress.unavailable.length, 1)
    assert.equal(
      (await em.execute('select title from image_prompt where id=?', [edited.id]))[0].title,
      '保留这次构图修改',
    )
    assert.equal((await em.execute('select count(*)::int n from image_prompt where id=?', [deleted.id]))[0].n, 0)
    const cleanup = await fixtureCleanupPlan(em, 'prompts-v1')
    assert(cleanup.preserve.some((item) => item.reason.includes('已经修改')))
    assert(cleanup.preserve.some((item) => item.reason.includes('防止补种复活')))
    assert.deepEqual(await em.execute('select * from post order by id'), unrelated)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    console.log('提示词样本通过：真实媒体/横竖方图/两页公开/草稿/来源说明/幂等/编辑和删除保护/结构一致')
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
