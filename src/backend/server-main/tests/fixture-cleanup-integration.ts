/** @file fixture-cleanup-integration.ts @description 隔离验证样本清理范围、外部互动与媒体保护、停止服务要求及归属不复活 */
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const target = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const run = (apply = false) =>
    removeDevelopmentData(['--dataset', 'all', ...(apply ? ['--apply', '--confirm', target] : [])], () => undefined)
  try {
    const em = fixture.testOrm.em.fork()
    const originals = await em.execute('select * from post order by id')
    await seedDevelopmentData(['--dataset', 'all', '--apply', '--confirm', target], () => undefined)
    const ownership = await em.execute('select * from development_fixture order by key')
    assert.equal(ownership.length, 109)
    const initial = await run()
    assert.equal(initial.preview, true)
    assert.equal(initial.remove.length, 109, JSON.stringify(initial.preserve))
    assert.equal(initial.preserve.length, 0)
    await assert.rejects(removeDevelopmentData(['--dataset', 'all', '--apply', '--confirm', 'wrong']), /确认/)
    await assert.rejects(removeDevelopmentData([]), /显式指定/)
    process.env.NODE_ENV = 'production'
    await assert.rejects(run(true), /非生产/)
    process.env.NODE_ENV = 'test'
    await assert.rejects(run(true), /其他连接/)
    const id = (key: string) => ownership.find((row) => row.key === key).resource_id
    const postId = id('core-v1/post/0')
    await em.execute("update post set title='手工保留的正文',revision=revision+1 where id=?", [postId])
    const guestRows = await em.execute(
      "select f.key,m.* from development_fixture f join guestbook_message m on m.id::text=f.resource_id where f.kind='guestbook' and m.status='published' and m.reply_to_id is null order by m.id",
    )
    const parent = guestRows[0]
    const [userReply] = await em.execute(
      `insert into guestbook_message (visitor_id_hash,author,avatar,content,reply_to_id,status,revision,is_owner,is_pinned,created_at,updated_at) values ('user-reply','远山','','用户后来的回复',?,'published',0,false,false,now(),now()) returning *`,
      [parent.id],
    )
    const next = guestRows[1]
    const [userReaction] = await em.execute(
      "insert into guestbook_reaction (message_id,visitor_id_hash,emoji,created_at) values (?,'user-reaction','👍',now()) returning *",
      [next.id],
    )
    const media = ownership.find((row) => row.key.startsWith('guestbook-v1/media/'))
    await em.execute(
      "insert into media_reference (asset_id,source_key,kind) values (?,'site:external-avatar','site')",
      [media.resource_id],
    )
    const protectedPlan = await run()
    for (const key of ['core-v1/post/0', parent.key, next.key, media.key])
      assert(
        protectedPlan.preserve.some((item) => item.key === key),
        key,
      )
    assert(protectedPlan.remove.length > 20)
    assert(protectedPlan.remove.length < initial.remove.length)
    const files = await readdir(process.env.MEDIA_DIRECTORY!)
    await fixture.stopServices()
    const removed = await run(true)
    assert('backup' in removed)
    await fixture.testOrm.connect()
    const after = fixture.testOrm.em.fork()
    assert.deepEqual(
      await after.execute(
        'select * from post where id in (' + originals.map(() => '?').join(',') + ') order by id',
        originals.map((row) => row.id),
      ),
      originals,
    )
    assert.equal((await after.execute('select title from post where id=?', [postId]))[0].title, '手工保留的正文')
    assert.deepEqual((await after.execute('select * from guestbook_message where id=?', [userReply.id]))[0], userReply)
    assert.deepEqual(
      (await after.execute('select * from guestbook_reaction where id=?', [userReaction.id]))[0],
      userReaction,
    )
    assert.equal(
      (await after.execute('select count(*)::int n from media_asset where id=?', [media.resource_id]))[0].n,
      1,
    )
    assert.deepEqual(await after.execute('select * from development_fixture order by key'), ownership)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), files)
    assert.equal((await after.execute('select require_context from content_context'))[0].require_context, true)
    const repeated = await run()
    assert.equal(repeated.remove.length, 0)
    const reseeded = await seedDevelopmentData(['--dataset', 'all', '--apply', '--confirm', target], () => undefined)
    assert.equal(reseeded.created.length, 0)
    assert.equal(reseeded.ready, false)
    process.stdout.write(
      '样本清理通过：109项归属预览、确认和连接保护、用户编辑/回复/互动/媒体保留、独立备份、账本与文件保留、重复补种不复活\n',
    )
  } finally {
    process.env.NODE_ENV = 'test'
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
})
