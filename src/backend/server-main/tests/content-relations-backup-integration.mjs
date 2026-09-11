/** @file content-relations-backup-integration.mjs @description v9跨域编号映射、循环关系、旧包边界、媒体说明保留与原子回滚 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
import { stripV9Fields } from './legacy-content-package.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  let token, writes = 0
  async function request(path, method = 'GET', body) {
    if (method !== 'GET' && ++writes % 4 === 0) await delay(1100)
    const form = body instanceof FormData
    const response = await fetch(`${fixture.origin}/api/v1${path}`, { method,
      headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(...args) { const response = await request(...args); assert(response.status < 300, `${args[0]}: ${response.status} ${JSON.stringify(response.body)}`); return response.body.data }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'relation-photo.png')
  const asset = await ok('/admin/media', 'POST', form)
  await ok(`/admin/media/${asset.id}`, 'PATCH', { alt: '窗边的光', description: '由博主管理的原说明' })
  const a = await ok('/admin/posts', 'POST', { title: '有序阅读的实现', contentRaw: '# 关联\n\n保留不同内容的阅读路径。', status: 'published' })
  const b = await ok('/admin/posts', 'POST', { title: '编号映射的边界', contentRaw: '# 映射\n\n来源编号不是目标编号。', status: 'published' })
  const p = await ok('/admin/projects', 'POST', { title: '阅读路径工程', requestId: randomUUID(), status: 'published' })
  const g = await ok('/admin/gallery', 'POST', { title: '窗边的光', mediaId: asset.id, requestId: randomUUID(), status: 'published' })
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.body
  assert.equal(bundle.version, 9)
  bundle.posts = bundle.posts.filter((row) => [a.id, b.id].includes(row.sourceId))
  bundle.projects = bundle.projects.filter((row) => row.sourceId === p.id)
  bundle.gallery = bundle.gallery.filter((row) => row.sourceId === g.id)
  // 特意使用与目标既有文章碰撞的来源编号，验证不会误关联到既有 #1/#2。
  bundle.posts[0].sourceId = 1; bundle.posts[1].sourceId = 2
  bundle.projects[0].sourceId = 1; bundle.gallery[0].sourceId = 1
  bundle.posts[0].values.relatedContent = [{ type: 'project', id: 1 }, { type: 'gallery', id: 1 }, { type: 'post', id: 2 }]
  bundle.projects[0].values.relatedContent = [{ type: 'post', id: 1 }]
  bundle.gallery[0].values.relatedContent = [{ type: 'project', id: 1 }]
  bundle.media[0].description = '来源包中的素材说明'
  async function preview(value, strategy = 'copy') {
    const file = new FormData()
    file.append('file', new Blob([JSON.stringify(value)], { type: 'application/json' }), 'relations.json')
    file.append('requestId', randomUUID()); file.append('strategy', strategy); file.append('includeSettings', 'false')
    return request('/admin/backup/imports/preview', 'POST', file)
  }
  async function execute(plan) { return request(`/admin/backup/imports/${plan.ticket}/execute`, 'POST', { acknowledgement: '导入为新草稿', confirmation: plan.confirmation }) }
  let prepared = await preview(bundle)
  assert.equal(prepared.status, 201)
  assert.equal(prepared.body.data.plan.ready, true)
  const imported = await execute(prepared.body.data)
  assert.equal(imported.status, 201, JSON.stringify(imported.body))
  const result = imported.body.data.result
  assert.equal(result.relations.applied, 5)
  const newA = result.posts.find((row) => row.sourceId === 1).id, newB = result.posts.find((row) => row.sourceId === 2).id
  const newP = result.projects[0].id, newG = result.gallery[0].id
  const expected = [{ type: 'project', id: newP }, { type: 'gallery', id: newG }, { type: 'post', id: newB }]
  assert.deepEqual((await ok(`/admin/posts/${newA}`)).relatedContent, expected)
  assert.deepEqual((await ok(`/admin/projects/${newP}`)).relatedContent, [{ type: 'post', id: newA }])
  assert.deepEqual((await ok(`/admin/gallery/${newG}`)).relatedContent, [{ type: 'project', id: newP }])
  const em = fixture.testOrm.em.fork()
  const [history] = await em.execute('select snapshot from post_revision where post_id=? order by revision desc limit 1', [newA])
  assert.deepEqual(history.snapshot.relatedContent, expected)
  assert.equal((await em.execute('select description from media_asset where id=?', [asset.id]))[0].description, '由博主管理的原说明')
  assert.deepEqual((await execute(prepared.body.data)).body.data.result, result, '同票据不重复迁入或映射')
  const skip = await preview(bundle, 'skip')
  assert.equal(skip.body.data.plan.counts.posts, 0)
  assert.equal(skip.body.data.plan.counts.projects, 0)
  assert.equal(skip.body.data.plan.counts.gallery, 0)
  const mixed = structuredClone(bundle)
  mixed.posts[0].values.title += '的续篇'
  prepared = await preview(mixed, 'skip')
  assert.equal(prepared.body.data.plan.ready, true)
  const mixedImport = await execute(prepared.body.data)
  assert.equal(mixedImport.status, 201)
  const mixedA = mixedImport.body.data.result.posts.find((row) => row.sourceId === 1).id
  const mixedRelations = (await ok(`/admin/posts/${mixedA}`)).relatedContent
  assert.equal(mixedRelations[2].id, b.id, '跳过目标复用匹配的既有内容，不采用来源数字2')
  const withNewMedia = structuredClone(bundle), importedMediaId = randomUUID()
  withNewMedia.media[0].id = importedMediaId
  withNewMedia.gallery[0].values.mediaId = importedMediaId
  const mediaPlan = await preview(withNewMedia)
  assert.equal((await execute(mediaPlan.body.data)).status, 201)
  assert.equal((await em.execute('select description from media_asset where id=?', [importedMediaId]))[0].description, '来源包中的素材说明', '新增媒体保留v9说明')
  const invalid = structuredClone(bundle)
  invalid.posts[0].values.relatedContent = [{ type: 'post', id: 999999 }]
  assert.equal((await preview(invalid)).status, 400)
  const legacy = stripV9Fields(structuredClone(bundle)); legacy.version = 8
  assert.equal((await preview(legacy)).status, 201)
  legacy.posts[0].values.relatedContent = []
  assert.equal((await preview(legacy)).status, 400, '旧版本明确拒绝关联新字段')
  const cyclic = structuredClone(bundle)
  cyclic.gallery = []; cyclic.projects = []
  cyclic.posts[1].values = structuredClone(cyclic.posts[0].values)
  cyclic.posts[0].values.relatedContent = [{ type: 'post', id: 2 }]
  cyclic.posts[1].values.relatedContent = [{ type: 'post', id: 1 }]
  const coalesced = await preview(cyclic, 'skip')
  assert.equal(coalesced.status, 201)
  assert.equal(coalesced.body.data.plan.ready, false, '去重后自引用必须在预览阻止')
  assert.equal((await preview(cyclic, 'copy')).body.data.plan.ready, true)
  // 实际导出已删除目标时明确计数省略，完整备份仍保留原JSON。
  await em.execute('update post set related_content=?::jsonb where id=?', [JSON.stringify([{ type: 'project', id: 999999 }]), a.id])
  const withMissing = await request('/admin/backup/export', 'POST', { mediaIncluded: false })
  assert.equal(withMissing.body.omittedRelations, 1)
  assert.deepEqual(withMissing.body.posts.find((row) => row.sourceId === a.id).values.relatedContent, [])
  const before = (await em.execute('select count(*)::int as count from post'))[0].count
  prepared = await preview(bundle)
  await em.execute("create function reject_relation_import() returns trigger language plpgsql as $$ begin if new.title='阅读路径工程' then raise exception 'relation_import_failure'; end if; return new; end $$")
  await em.execute('create trigger reject_relation_import before insert on project for each row execute function reject_relation_import()')
  assert.equal((await execute(prepared.body.data)).status, 503)
  assert.equal((await em.execute('select count(*)::int as count from post'))[0].count, before, '后续目标失败应回滚此前文章与关系')
  await em.execute('drop trigger reject_relation_import on project'); await em.execute('drop function reject_relation_import()')
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write('v9关联维护隔离验证通过：跨域循环与有序编号映射、跳过/复制、历史快照、旧包拒绝新字段、失效省略、同票据幂等和故障回滚\n')
} finally { await fixture.close() }
