/** @file sustainable-fixtures-integration.ts @description 长文关联与通知样本的真实链路、零对外投递、指纹与定向保护 */
import assert from 'node:assert/strict'
import { loadLocalEnvironment } from '../src/config/environment'
import { createBrowserTestApp } from './test-app.mjs'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const previousEmail = process.env.NOTIFICATION_EMAIL_ENABLED
  try {
    const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
    const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
    const { fixtureCleanupPlan } = await import('../src/seeders/fixture-cleanup-plan')
    const { writingHandbook } = await import('../src/seeders/writing-fixtures')
    const seed = (dataset: string) =>
      seedDevelopmentData(
        ['--dataset', dataset, '--apply', '--confirm', database],
        () => undefined,
        fixture.backupOptions,
      )
    assert(writingHandbook.length > 10000)
    const first = await seed('writing-v1')
    assert('created' in first && first.created.length === 6)
    const em = fixture.testOrm.em.fork()
    const [longPost] = await em.execute(
      "select p.* from post p join development_fixture f on f.resource_id=p.id::text and f.kind='post' where f.key='writing-v1/post/handbook'",
    )
    assert(longPost.content_raw.length > 10000)
    assert.equal(longPost.related_content.length, 2)
    const [project] = await em.execute(
      "select p.* from project p join development_fixture f on f.resource_id=p.id::text and f.kind='project' where f.dataset='writing-v1'",
    )
    assert.equal(project.related_content.length, 2)
    const publicProject = await fetch(`${fixture.origin}/api/v1/projects/${project.id}`)
    assert.equal(publicProject.status, 200)
    assert.equal((await publicProject.json()).data.relatedContent.length, 1, '公开关系不泄露写作草稿')
    assert.equal((await fixtureCleanupPlan(em, 'writing-v1')).remove.length, 6)
    const repeated = await seed('writing-v1')
    assert('created' in repeated && repeated.created.length === 0)
    assert.equal((await fixtureCleanupPlan(em, 'writing-v1')).remove.length, 6, '初次完成关联后的指纹与最终内容一致')
    // 在本次隔离库打开运行开关，证明种子仍不能排队对外投递。
    process.env.NOTIFICATION_EMAIL_ENABLED = 'true'
    await em.execute("update operation_control set external_paused=false where id='default'")
    const notifications = await seed('notifications-v1')
    assert('created' in notifications && notifications.created.length === 71)
    const [counts] = await em.execute(
      'select count(*)::int total,count(*) filter(where read_at is null)::int unread from owner_notification',
    )
    assert.equal(counts.total, 23)
    assert.equal(counts.unread, 21)
    const tasks = await em.execute('select state,attempts from background_task')
    assert.equal(tasks.length, 23)
    assert(tasks.every((task: { state: string; attempts: number }) => task.state === 'paused' && task.attempts === 0))
    const notificationPlan = await fixtureCleanupPlan(em, 'notifications-v1')
    assert.equal(notificationPlan.remove.length, 71)
    const [event] = await em.execute('select id,source_id from owner_notification where read_at is null limit 1')
    await em.execute('update owner_notification set read_at=now() where id=?', [event.id])
    const protectedPlan = await fixtureCleanupPlan(em, 'notifications-v1')
    assert(protectedPlan.preserve.some((item: { key: string }) => item.key.includes('/notification/')))
    assert(
      !protectedPlan.remove.some(
        (item: { kind: string; id: string }) => item.kind === 'guestbook' && item.id === event.source_id,
      ),
      '已读互动家庭保留',
    )
    const repeatedNotifications = await seed('notifications-v1')
    assert('created' in repeatedNotifications && repeatedNotifications.created.length === 0)
    assert.equal(
      (await em.execute('select count(*)::int as count from owner_notification where read_at is null'))[0].count,
      20,
    )
    await em.execute('update post set title=? where id=?', ['保留手工修订的手册', longPost.id])
    const preserved = await fixtureCleanupPlan(em, 'writing-v1')
    assert.equal(preserved.remove.length, 0, '手工编辑保护关联家庭与共用媒体')
    await seed('writing-v1')
    assert.equal((await em.execute('select title from post where id=?', [longPost.id]))[0].title, '保留手工修订的手册')
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '创作和通知样本隔离验证通过：6+71归属、万字长文、公开过滤、真实通知分页、启用环境下仍零排队、指纹兼容与关联家庭保护\n',
    )
  } finally {
    if (previousEmail === undefined) delete process.env.NOTIFICATION_EMAIL_ENABLED
    else process.env.NOTIFICATION_EMAIL_ENABLED = previousEmail
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
})
