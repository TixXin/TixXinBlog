/** @file database-dev-integration.ts @description 开发数据库工具在独立临时库中验证预览、备份、样本、清空及事务重建 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const sourceUrl = process.env.DATABASE_URL!
  const { runDevDatabase } = await import('../src/seeders/database-dev')
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const target = decodeURIComponent(new URL(sourceUrl).pathname.slice(1))
  const output: string[] = []
  const run = (action: string, apply = false) =>
    runDevDatabase(
      [action, ...(apply ? ['--apply', '--confirm', target] : [])],
      (text) => output.push(text),
      fixture.backupOptions,
    )
  try {
    const preview = await run('seed-moments')
    assert.equal(preview.counts.moment, 0)
    assert.equal((await run('status')).counts.moment, 0)
    await assert.rejects(runDevDatabase(['seed-moments', '--apply', '--confirm', 'wrong-target']), /确认不匹配/)
    await assert.rejects(runDevDatabase(['seed-moments', '--unexpected']), /不支持的参数/)
    process.env.NODE_ENV = 'production'
    await assert.rejects(run('seed-moments', true), /本机非生产/)
    process.env.NODE_ENV = 'test'
    const seeded = await run('seed-moments', true)
    assert(seeded.after && seeded.after.moment > 0)
    assert.equal(seeded.after.moment_like, 0)
    assert(seeded.after.moment_comment > 0)
    assert.equal(seeded.after.post, preview.counts.post)
    const initialMoments = await fixture.testOrm.em.fork().execute('select id,content from moment order by id')
    assert(initialMoments.every((note) => !/开发示例|测试数据|演示用途/.test(note.content)))
    const firstDates = await fixture.testOrm.em.fork().execute('select id,published_at from moment order by id')
    const latestDate = Math.max(...firstDates.map((note) => new Date(note.published_at).getTime()))
    assert.equal(new Date(latestDate).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
    assert(latestDate <= Date.now(), '开发样本不能发布日期在未来')
    const overviewResponse = await fetch(fixture.origin + '/api/v1/moments/overview')
    assert.equal(overviewResponse.status, 200)
    const overview = (await overviewResponse.json()).data
    assert(overview.photos.length > 0 && overview.topics.length > 0 && overview.recollections.length > 0)
    assert(overview.dates.some((item) => item.date === new Date(latestDate).toISOString().slice(0, 10)))
    const again = await run('seed-moments', true)
    assert.equal(again.samplesToAdd, 0)
    assert.equal('backup' in again, false)
    assert.deepEqual(
      await fixture.testOrm.em.fork().execute('select id,published_at from moment order by id'),
      firstDates,
    )
    const [legacy, edited, compactPrefix, concurrent, manuallyEdited] = initialMoments
    const em = fixture.testOrm.em.fork()
    for (const note of [legacy, compactPrefix, concurrent])
      await em.execute('update moment set content=? where id=?', [
        `[开发示例]${note === compactPrefix ? '' : ' '}${note.content}`,
        note.id,
      ])
    await em.execute('update moment set content=?,revision=4,location=? where id=?', [
      '[开发示例] 自己改写的第一段。\n\n正文里提到[开发示例]时保留原文。',
      '杭州·西湖',
      edited.id,
    ])
    await em.execute('update moment set content=? where id=?', ['直接在数据库维护的正文也要保留。', manuallyEdited.id])
    for (const id of ['personal-moment', 'dev-moment-v1-unknown'])
      await em.execute('insert into moment (id,content,status,created_at,updated_at) values (?,?,?,now(),now())', [
        id,
        '[开发示例] 自己创建的记录不属于种子清理范围。',
        'published',
      ])
    await em.execute('insert into moment_like (moment_id,visitor_id_hash,created_at) values (?,?,now())', [
      edited.id,
      'database-dev-normalization-visitor',
    ])
    await em.execute('update moment set likes=1 where id=?', [edited.id])
    const interacted = initialMoments[5]
    await em.execute('insert into moment_like (moment_id,visitor_id_hash,created_at) values (?,?,now())', [
      interacted.id,
      'another-user-interaction',
    ])
    const beforeNormalization = await em.execute('select * from moment order by id')
    const beforeComments = await em.execute('select * from moment_comment order by id')
    const beforeLikes = await em.execute('select * from moment_like order by id')
    const beforeReferences = await em.execute('select * from media_reference order by id')
    const normalizePreview = await run('normalize-samples')
    assert.equal(normalizePreview.samplesToNormalize, 4)
    assert.deepEqual(await em.execute('select * from moment order by id'), beforeNormalization)

    // 持有行锁，在备份完成后模拟另一客户端编辑，验证比较更新不会覆盖并发正文。
    const concurrentEm = fixture.testOrm.em.fork()
    await concurrentEm.begin()
    await concurrentEm.execute('select id from moment where id=? for update', [concurrent.id])
    let backupReady!: () => void
    const backedUp = new Promise<void>((resolve) => {
      backupReady = resolve
    })
    const normalization = runDevDatabase(
      ['normalize-samples', '--apply', '--confirm', target],
      (text) => {
        output.push(text)
        if (text.startsWith('写入前完整备份：')) backupReady()
      },
      fixture.backupOptions,
    )
    try {
      await Promise.race([
        backedUp,
        normalization.then(() => {
          throw new Error('正文清理必须先完成备份')
        }),
      ])
      await concurrentEm.execute('update moment set content=?,revision=revision+1 where id=?', [
        '刚刚保存的并发编辑内容。',
        concurrent.id,
      ])
      await concurrentEm.commit()
    } catch (error) {
      await concurrentEm.rollback()
      await normalization.catch(() => undefined)
      throw error
    }
    const normalized = await normalization
    assert.equal(normalized.samplesNormalized, 3)
    assert('backup' in normalized)
    const expectedMoments = beforeNormalization.map((note) => {
      if (note.id === concurrent.id)
        return { ...note, content: '刚刚保存的并发编辑内容。', revision: note.revision + 1 }
      if ([legacy.id, edited.id, compactPrefix.id].includes(note.id))
        return { ...note, content: note.content.replace(/^\[开发示例\] ?/, '') }
      return note
    })
    assert.deepEqual(await em.execute('select * from moment order by id'), expectedMoments)
    assert.deepEqual(await em.execute('select * from moment_comment order by id'), beforeComments)
    assert.deepEqual(await em.execute('select * from moment_like order by id'), beforeLikes)
    assert.deepEqual(await em.execute('select * from media_reference order by id'), beforeReferences)
    const normalizedAgain = await run('normalize-samples', true)
    assert.equal(normalizedAgain.samplesToNormalize, 0)
    assert.equal('backup' in normalizedAgain, false)
    const seedAgain = await run('seed-moments', true)
    assert.equal(seedAgain.samplesToAdd, 0)
    assert.deepEqual(await em.execute('select * from moment order by id'), expectedMoments)
    // 删除操作同时识别自然正文与旧前缀正文，但保留已编辑样本和未登记的编号。
    await em.execute('update moment set content=? where id=?', [`[开发示例] ${legacy.content}`, legacy.id])
    await assert.rejects(run('clear-moments', true), /其他连接/)
    const [guest] = await em.execute(
      "insert into guestbook_message (visitor_id_hash,author,avatar,content,status,revision,is_owner,is_pinned,created_at,updated_at) values ('clear-tool','小林','','清空范围中的留言','published',0,false,false,now(),now()) returning id",
    )
    await em.execute(
      "insert into guestbook_reaction (message_id,visitor_id_hash,emoji,created_at) values (?,'clear-tool','👍',now())",
      [guest.id],
    )
    assert.equal((await run('status')).counts.guestbook_message, 1)
    assert.equal((await run('status')).counts.guestbook_reaction, 1)
    await seedDevelopmentData(
      ['--dataset', 'gallery-v1', '--apply', '--confirm', target],
      () => undefined,
      fixture.backupOptions,
    )
    await seedDevelopmentData(
      ['--dataset', 'project-v1', '--apply', '--confirm', target],
      () => undefined,
      fixture.backupOptions,
    )
    await seedDevelopmentData(
      ['--dataset', 'link-v1', '--apply', '--confirm', target],
      () => undefined,
      fixture.backupOptions,
    )
    await em.execute(
      "update link_settings set rules='[\"保留博主自行维护的规则\"]'::jsonb,revision=1 where id='default'",
    )
    await em.execute(
      'update gallery_settings set gear=\'[{"icon":"lucide:camera","name":"随身相机","description":"日常记录"}]\'::jsonb,revision=1 where id=\'default\'',
    )
    assert.equal((await run('status')).counts.gallery_photo, 18)
    assert.equal((await run('status')).counts.project, 18)
    assert.equal((await run('status')).counts.friend_link, 18)
    await fixture.testOrm.em.fork().execute('create view database_dev_guard as select id from moment')
    await fixture.stopServices()
    const removed = await run('remove-samples', true)
    assert.equal(removed.after?.moment, 6)
    assert.equal(removed.editedSamplesPreserved, 4)
    assert.equal(removed.after?.moment_like, 2)
    const cleared = await run('clear-content', true)
    assert.equal(cleared.after?.moment, 0)
    assert.equal(cleared.after?.post, 0)
    assert.equal(cleared.after?.guestbook_message, 0)
    assert.equal(cleared.after?.guestbook_reaction, 0)
    assert.equal(cleared.after?.gallery_photo, 0)
    assert.equal(cleared.after?.project, 0)
    assert.equal(cleared.after?.friend_link, 0)
    assert.equal(cleared.after?.link_settings, 1)
    assert.equal(cleared.after?.gallery_settings, 1)
    assert.equal(cleared.after?.development_fixture, 68)
    assert.equal(cleared.after?.media_asset, 14)
    assert.equal(cleared.after?.admin_user, preview.counts.admin_user)
    assert.equal(cleared.after?.site_settings, 1)
    const beforeRejectedReset = await run('status')
    await assert.rejects(run('reset', true), /cannot drop|depend/)
    assert.deepEqual((await run('status')).counts, beforeRejectedReset.counts)
    await fixture.testOrm.connect()
    try {
      assert.deepEqual(
        (await fixture.testOrm.em.getConnection().execute('select gear,revision from gallery_settings'))[0],
        {
          gear: [{ icon: 'lucide:camera', name: '随身相机', description: '日常记录' }],
          revision: 1,
        },
      )
      assert.deepEqual(
        (await fixture.testOrm.em.getConnection().execute('select rules,revision from link_settings'))[0],
        {
          rules: ['保留博主自行维护的规则'],
          revision: 1,
        },
      )
      await fixture.testOrm.em.getConnection().execute('drop view database_dev_guard')
    } finally {
      await fixture.testOrm.close(true)
    }
    const reset = await run('reset', true)
    assert.equal(reset.after?.admin_user, 0)
    assert.equal(reset.after?.post, 0)
    assert.equal(reset.after?.site_settings, 1)
    assert.equal(reset.after?.content_context, 1)
    assert.equal(reset.after?.gallery_photo, 0)
    assert.equal(reset.after?.project, 0)
    assert.equal(reset.after?.friend_link, 0)
    assert.equal(reset.after?.link_settings, 1)
    assert.equal(reset.after?.gallery_settings, 1)
    assert.equal(reset.after?.development_fixture, 0)
    assert.equal(reset.pendingMigrations, 0)
    assert.equal((await run('status')).pendingMigrations, 0)
    assert.equal(reset.after?.mikro_orm_migrations, preview.counts.mikro_orm_migrations)
    const text = output.join('\n')
    assert(!text.includes(sourceUrl))
    assert(!text.includes(`${new URL(sourceUrl).username}:${new URL(sourceUrl).password}@`))
    process.stdout.write(
      '开发数据库工具通过：默认预览、目标/生产/运行连接拒绝、备份、无标记样本、正文清理幂等与并发保护、编辑内容与互动保留、业务清空与全部迁移事务重建\n',
    )
  } finally {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = sourceUrl
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
})
