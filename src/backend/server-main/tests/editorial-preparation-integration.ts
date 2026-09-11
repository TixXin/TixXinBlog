/** @file editorial-preparation-integration.ts @description 首发旧稿精确迁正、独立目标v9迁入和隔离发布阅读，所有数据库与媒体均为临时资源。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { ensureFixture } from '../src/seeders/fixture-ledger'
import { AdminPostService } from '../src/modules/post/admin-post.service'
import { PostRevisionsService } from '../src/modules/post/post-revisions.service'
import { ProjectService } from '../src/modules/project/project.service'
import { editorialCandidates, editorialPostInput, editorialProjectInput } from '../src/seeders/editorial-model'
import {
  EDITORIAL_CREATE_REASON,
  EDITORIAL_DATASET,
  EDITORIAL_REFRESH_REASON,
  editorialArticles,
} from '../src/seeders/editorial-content'
import { inspectEditorialContent } from '../src/seeders/editorial-review'
import { prepareEditorialContent } from '../src/seeders/editorial-maintenance'
import { exportEditorialPackage } from '../src/seeders/editorial-package'
import { parseContentPackage } from '../src/modules/backup/content-package'
const execute = promisify(execFile)
const root = resolve(__dirname, '../../../..')

async function source(packagePath: string) {
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const em = fixture.testOrm.em.fork(),
      database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
    const progress = { created: [], retained: [], unavailable: [] }
    await em.transactional(async (transaction) => {
      const posts = new AdminPostService(transaction, new PostRevisionsService(transaction))
      for (const candidate of editorialCandidates)
        await ensureFixture(
          transaction,
          EDITORIAL_DATASET,
          candidate.key,
          candidate.kind,
          async () =>
            candidate.kind === 'post'
              ? (await posts.save(null, editorialPostInput(candidate.key, [], true), EDITORIAL_CREATE_REASON)).id
              : (
                  await new ProjectService(transaction).save(null, {
                    ...editorialProjectInput([], true),
                    requestId: randomUUID(),
                  })
                ).id,
          progress,
        )
    })
    const legacy = await inspectEditorialContent(em)
    assert.equal(legacy.eligible, true)
    assert(
      legacy.items.every((item) => item.stage === 'legacy'),
      JSON.stringify(legacy.items),
    )
    assert.equal((await prepareEditorialContent(false, '', fixture.backupOptions)).changed, false)
    await em.execute('insert into post_address(slug,post_id) values (?,?)', [editorialArticles[0].slug, 1])
    const occupied = await prepareEditorialContent(false, '', fixture.backupOptions)
    assert.equal(occupied.eligible, false)
    assert.deepEqual(occupied.blockedSlugs, [editorialArticles[0].slug])
    await em.execute('delete from post_address where slug=?', [editorialArticles[0].slug])
    await assert.rejects(prepareEditorialContent(true, 'wrong-target', fixture.backupOptions), /精确确认/)
    const firstId = legacy.ids['content-boundaries']
    const prototype = Object.getPrototypeOf(fixture.testOrm.em),
      originalExecute = prototype.execute,
      own = Object.hasOwn(prototype, 'execute')
    let changedDuringBackup = 0
    prototype.execute = async function (sql: unknown, ...args: unknown[]) {
      const result = await Reflect.apply(originalExecute, this, [sql, ...args])
      if (typeof sql === 'string' && sql.includes('pg_export_snapshot()') && changedDuringBackup === 0) {
        changedDuringBackup++
        await Reflect.apply(originalExecute, em, [
          'update post set title=? where id=?',
          ['备份期间的人工编辑', firstId],
        ])
      }
      return result
    }
    try {
      assert.equal((await prepareEditorialContent(true, database, fixture.backupOptions)).changed, false)
    } finally {
      if (own) prototype.execute = originalExecute
      else delete prototype.execute
    }
    assert.equal(changedDuringBackup, 1)
    assert.equal((await em.execute('select title from post where id=?', [firstId]))[0].title, '备份期间的人工编辑')
    await em.execute('update post set title=? where id=?', [editorialArticles[0].title, firstId])
    const revised = await prepareEditorialContent(true, database, fixture.backupOptions)
    assert.equal(revised.changed, true, JSON.stringify(revised))
    assert.equal(revised.updated.length, 4)
    assert.equal(revised.ready, true)
    assert(revised.backup)
    const current = await inspectEditorialContent(em)
    assert(current.items.every((item) => item.stage === 'ready'))
    assert(current.items.filter((item) => item.kind === 'post').every((item) => item.revision === 2))
    assert.equal(current.items.find((item) => item.kind === 'project')?.revision, 1)
    const [originalHistory] = await em.execute(
      'select snapshot,reason from post_revision where post_id=? and revision=1',
      [firstId],
    )
    assert.equal(originalHistory.reason, EDITORIAL_CREATE_REASON)
    assert(originalHistory.snapshot.contentRaw.includes('# TixXinBlog 的内容边界'))
    const before = await em.execute(
      'select id,revision,title from post where id in (?,?,?) order by id',
      current.items.filter((item) => item.kind === 'post').map((item) => item.id),
    )
    assert.equal((await prepareEditorialContent(true, database, fixture.backupOptions)).changed, false)
    assert.deepEqual(
      await em.execute(
        'select id,revision,title from post where id in (?,?,?) order by id',
        current.items.filter((item) => item.kind === 'post').map((item) => item.id),
      ),
      before,
    )
    await em.execute(
      'update site_settings set "values"="values"||\'{"ownerTitle":"private-source-profile-marker","about":{"visible":false,"introduction":"private-source-profile-marker","sections":[]}}\'::jsonb',
    )
    await em.execute('insert into post_folder(label) values (?)', ['private-unselected-folder-marker'])
    const exported = await exportEditorialPackage(packagePath)
    assert.equal(exported.articles, 3)
    assert.equal(exported.projects, 1)
    assert.equal(exported.relations, 12)
    assert.equal(exported.media, 0)
    const bytes = await readFile(packagePath),
      bundle = await parseContentPackage(bytes)
    assert(!bytes.toString().includes('private-source-profile-marker'))
    assert(!bytes.toString().includes('private-unselected-folder-marker'))
    assert.deepEqual(bundle.folders, ['博客建设'])
    assert.deepEqual(bundle.tags.map((tag) => tag.label).sort(), ['TixXinBlog', '工程实践'].sort())
    assert(bundle.posts.every((post) => !post.deleted && post.values.status === 'draft' && post.comments.length === 0))
    assert.equal(bundle.projects[0]!.values.status, 'draft')
    for (const field of ['flashes', 'moments', 'guestbook', 'gallery', 'links', 'media'] as const)
      assert.equal(bundle[field].length, 0)
    await em.execute('update post set title=? where id=?', ['用户已经改写的候选标题', firstId])
    assert.equal((await prepareEditorialContent(true, database, fixture.backupOptions)).eligible, false)
    await assert.rejects(exportEditorialPackage(packagePath + '.blocked.json'), /候选尚未全部通过/)
    assert.equal((await em.execute('select title from post where id=?', [firstId]))[0].title, '用户已经改写的候选标题')
    await em.execute('update post set title=? where id=?', [editorialArticles[0].title, firstId])
    await em.execute('update post_revision set reason=? where post_id=? and revision=2', ['用户维护的历史', firstId])
    assert.equal((await prepareEditorialContent(true, database, fixture.backupOptions)).eligible, false)
    await em.execute('update post_revision set reason=? where post_id=? and revision=2', [
      EDITORIAL_REFRESH_REASON,
      firstId,
    ])
    const [preservedHistory] = await em.execute('select snapshot from post_revision where post_id=? and revision=2', [
      firstId,
    ])
    await em.execute("update post_revision set snapshot='null'::jsonb where post_id=? and revision=2", [firstId])
    assert.equal((await prepareEditorialContent(false, '', fixture.backupOptions)).eligible, false)
    await em.execute('update post_revision set snapshot=?::jsonb where post_id=? and revision=2', [
      JSON.stringify(preservedHistory.snapshot),
      firstId,
    ])
    await em.execute('update project set deleted_at=now() where id=?', [current.ids.tixxinblog])
    assert.equal((await prepareEditorialContent(true, database, fixture.backupOptions)).changed, false)
    assert.equal((await inspectEditorialContent(em)).items.find((item) => item.kind === 'project')?.stage, 'deleted')
    const { seedEditorialFixtures } = await import('../src/seeders/editorial-fixtures')
    const repeated = { created: [], retained: [], unavailable: [] }
    await seedEditorialFixtures(em, undefined!, repeated, [])
    assert.equal(repeated.created.length, 0)
    assert.equal(repeated.unavailable.length, 1)
    assert.equal((await em.execute('select count(*)::int as count from project'))[0].count, 1)
    process.stdout.write(
      '首发来源准备通过：旧指纹/版本/历史迁正、备份中改动拒绝、四候选零重复、私有字段剔除、编辑删除保留。\n',
    )
  } finally {
    await fixture.close()
  }
}

async function target(packagePath: string) {
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    let token = ''
    const request = async (path: string, method = 'GET', body?: unknown) => {
      const form = body instanceof FormData
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(fixture.origin + '/api/v1' + path, {
          method,
          headers: {
            ...(form ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
        })
        const result = await response.json()
        if (response.status === 429 && attempt < 3) {
          await delay(1100)
          continue
        }
        assert(response.status < 300, `${path}: ${response.status} ${JSON.stringify(result)}`)
        return result.data
      }
    }
    token = (await request('/auth/login', 'POST', { username: fixture.username, password: fixture.password }))
      .accessToken
    const em = fixture.testOrm.em.fork(),
      bundle = await parseContentPackage(await readFile(packagePath))
    for (let index = 0; index < 3; index++)
      await request('/admin/posts', 'POST', {
        title: `目标原有记录 ${index}`,
        contentRaw: '只属于隔离目标的内容',
        status: 'draft',
      })
    await request('/admin/projects', 'POST', { title: '目标原有项目', requestId: randomUUID() })
    await em.execute(
      'update site_settings set "values"="values"||\'{"description":"目标资料不能被候选包覆盖","ownerTitle":"目标资料不能被候选包覆盖"}\'::jsonb',
    )
    await em.execute('update comment_policy set require_approval=true')
    const settingsBefore = await em.execute('select * from site_settings'),
      policyBefore = await em.execute('select * from comment_policy')
    const totals = async () =>
      (
        await em.execute(
          'select (select count(*)::int from post) as posts,(select count(*)::int from project) as projects,(select count(*)::int from media_asset) as media',
        )
      )[0]
    const before = await totals()
    const preview = async (strategy: 'copy' | 'skip') => {
      const file = new FormData()
      file.append('file', new Blob([JSON.stringify(bundle)], { type: 'application/json' }), 'editorial-content-v9.json')
      file.append('requestId', randomUUID())
      file.append('strategy', strategy)
      file.append('includeSettings', 'false')
      return request('/admin/backup/imports/preview', 'POST', file)
    }
    const plan = await preview('copy')
    assert.equal(plan.includeSettings, false)
    assert.equal(plan.plan.ready, true)
    assert.equal(plan.plan.counts.posts, 3)
    assert.equal(plan.plan.counts.projects, 1)
    const executePlan = () =>
      request(`/admin/backup/imports/${plan.ticket}/execute`, 'POST', {
        acknowledgement: '导入为新草稿',
        confirmation: plan.confirmation,
      })
    const imported = (await executePlan()).result
    assert.equal(imported.relations.applied, 12)
    assert.deepEqual((await executePlan()).result, imported)
    assert.deepEqual(await totals(), { posts: before.posts + 3, projects: before.projects + 1, media: before.media })
    assert.deepEqual(await em.execute('select * from site_settings'), settingsBefore)
    assert.deepEqual(await em.execute('select * from comment_policy'), policyBefore)
    const map = new Map(imported.posts.map((item: { sourceId: number; id: number }) => [item.sourceId, item.id]))
    const projectId = imported.projects[0].id
    assert.notEqual(projectId, bundle.projects[0]!.sourceId)
    const importedPosts = []
    for (const input of bundle.posts) {
      const post = await request(`/admin/posts/${map.get(input.sourceId)}`)
      assert.notEqual(post.id, input.sourceId)
      assert.equal(post.status, 'draft')
      assert.equal(post.slug, input.values.slug)
      assert.deepEqual(
        post.relatedContent,
        input.values.relatedContent!.map((item) => ({
          type: item.type,
          id: item.type === 'post' ? map.get(item.id) : projectId,
        })),
      )
      importedPosts.push(post)
    }
    assert.equal((await request(`/admin/projects/${projectId}`)).status, 'draft')
    // 仅在此隔离目标公开四份内容，验证真实首页精选、栏目及文章/项目阅读闭环。
    for (const post of importedPosts) {
      const { id, savedAt: _savedAt, deletedAt: _deletedAt, ...body } = post
      void _savedAt
      void _deletedAt
      await request(`/admin/posts/${id}`, 'PATCH', { ...body, status: 'published' })
    }
    const project = await request(`/admin/projects/${projectId}`)
    await request(`/admin/projects/${projectId}`, 'PATCH', { revision: project.revision, status: 'published' })
    const featured = await request('/posts?pinned=true&pageSize=10')
    assert.equal(featured.total, 1)
    assert.equal(featured.items[0].slug, editorialArticles[0].slug)
    assert.equal((await request('/posts?folder=' + encodeURIComponent('博客建设'))).total, 3)
    for (const post of importedPosts) assert.equal((await request(`/posts/${post.id}`)).relatedContent.length, 3)
    assert.equal((await request(`/projects/${projectId}`)).relatedContent.length, 3)
    const skipped = await preview('skip')
    assert.equal(skipped.plan.counts.posts, 0)
    assert.equal(skipped.plan.counts.projects, 0)
    assert.deepEqual(await em.execute('select * from site_settings'), settingsBefore)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '独立隔离目标迁入通过：v9解析/预览/四候选迁入、12条跨库编号映射、配置不变、同票据/跳过幂等和隔离精选阅读。\n',
    )
  } finally {
    await fixture.close()
  }
}
async function main() {
  loadLocalEnvironment()
  if (process.argv[2] === '--source') {
    await source(process.argv[3]!)
    return
  }
  const directory = resolve(root, '.artifacts/first-release/editorial-validation', randomUUID())
  assert(directory.startsWith(resolve(root, '.artifacts') + sep))
  await mkdir(directory, { recursive: true })
  const path = join(directory, 'editorial-content-v9.json')
  const sourceRun = await execute(process.execPath, ['--import', 'tsx', __filename, '--source', path], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  })
  await writeFile(join(directory, 'source.log'), sourceRun.stdout + sourceRun.stderr)
  await target(path)
  await writeFile(
    join(directory, 'result.json'),
    JSON.stringify(
      {
        completed: true,
        sourceAndTargetCleaned: true,
        package: path,
        articles: 3,
        projects: 1,
        media: 0,
        relations: 12,
        externalPublication: false,
      },
      null,
      2,
    ),
  )
  process.stdout.write(`首发候选端到端隔离验证通过：${directory}\n`)
}
void main().catch((error) => {
  process.stderr.write(String(error.stack ?? error) + '\n')
  process.exitCode = 1
})
