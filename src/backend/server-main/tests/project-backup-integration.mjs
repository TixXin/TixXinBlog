/** @file project-backup-integration.mjs @description 项目内容包版本、独立进展、可选封面、去重复制、事务回滚与未知提交结果的隔离验收 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  let token,
    writes = 0
  async function request(path, method = 'GET', body, credential = token, context) {
    if (method !== 'GET' && ++writes % 5 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        ...(context ? { 'X-Content-Context': context } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, data: await response.json(), headers: response.headers }
  }
  const login = await request('/auth/login', 'POST', { username: fixture.username, password: fixture.password }, '')
  assert.equal(login.status, 200)
  token = login.data.data.accessToken
  async function ok(path, method = 'GET', body) {
    const value = await request(path, method, body)
    assert(value.status < 300, `${path}: ${value.status} ${value.data.message ?? ''}`)
    return value.data.data
  }
  const file = new FormData()
  file.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'project-cover.png',
  )
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: file,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const post = await ok('/admin/posts', 'POST', {
    title: '共用封面的文章',
    cover: asset.url,
    contentRaw: '保留已有记录。',
  })
  const gallery = await ok('/admin/gallery', 'POST', {
    title: '共用的画面',
    mediaId: asset.id,
    requestId: randomUUID(),
    status: 'published',
  })
  const project = await ok('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '轻量阅读工具',
    description: '整理稍后阅读的资料。',
    coverMediaId: asset.id,
    progress: 'archived',
    status: 'published',
    sortOrder: 17,
    tags: [
      { label: ' TypeScript ', color: 'blue' },
      { label: 'typescript', color: 'sky' },
      { label: 'Vue', color: 'emerald' },
    ],
    links: [
      { kind: 'source', href: 'https://github.com/vuejs/core' },
      { kind: 'docs', href: 'https://vuejs.org/Guide/?lang=zh&tag=A&tag=B#Start' },
    ],
  })
  const withoutCover = await ok('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '纸上笔记',
    progress: 'dev',
    status: 'draft',
    coverMediaId: null,
  })
  const withdrawn = await ok('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '往返之间',
    progress: 'active',
    status: 'withdrawn',
    coverMediaId: asset.id,
  })
  const deleted = await ok('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '收起的想法',
    progress: 'dev',
    coverMediaId: asset.id,
  })
  await ok(`/admin/projects/${deleted.id}?revision=${deleted.revision}`, 'DELETE')
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.data
  assert.equal(bundle.version, 6)
  assert.equal(bundle.projects.length, 4)
  assert(!JSON.stringify(bundle.projects).includes('requestId'))
  assert(!JSON.stringify(bundle.projects).includes('revision'))
  assert(!JSON.stringify(bundle.projects).includes('stars'))
  const sourceProject = bundle.projects.find((item) => item.sourceId === project.id)
  assert.deepEqual(sourceProject.values.tags, [
    { label: 'TypeScript', color: 'blue' },
    { label: 'Vue', color: 'emerald' },
  ])
  assert.equal(sourceProject.values.links[1].href, 'https://vuejs.org/Guide/?lang=zh&tag=A&tag=B#Start')
  assert.equal(bundle.projects.find((item) => item.sourceId === withoutCover.id).values.coverMediaId, null)
  assert.equal(bundle.projects.find((item) => item.sourceId === deleted.id).deleted, true)
  bundle.posts = bundle.posts.filter((item) => item.sourceId === post.id)
  bundle.gallery = bundle.gallery.filter((item) => item.sourceId === gallery.id)
  async function preview(input, strategy = 'skip', id = randomUUID()) {
    if (++writes % 5 === 0) await delay(1100)
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), 'projects.json')
    form.append('requestId', id)
    form.append('strategy', strategy)
    form.append('includeSettings', 'false')
    const response = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    return { status: response.status, data: await response.json() }
  }
  const execute = (plan) =>
    request(`/admin/backup/imports/${plan.ticket}/execute`, 'POST', {
      acknowledgement: '导入为新草稿',
      confirmation: plan.confirmation,
    })
  const same = await preview(bundle)
  assert.equal(same.status, 201)
  assert.equal(same.data.data.plan.counts.projects, 0)
  assert.equal(same.data.data.plan.projects.length, 4)
  for (const version of [1, 2, 3, 4, 5]) {
    const legacy = structuredClone(bundle)
    legacy.version = version
    if (version < 5) delete legacy.projects
    delete legacy.links
    delete legacy.linkSettings
    if (version < 4) {
      delete legacy.gallery
      delete legacy.gallerySettings
    }
    if (version < 3) delete legacy.guestbook
    if (version < 2) delete legacy.moments
    const accepted = await preview(legacy)
    assert.equal(accepted.status, 201, `旧v${version}仍应兼容`)
    assert.equal(accepted.data.data.plan.counts.projects, 0)
    if (version < 5) assert.equal((await preview({ ...legacy, projects: [] })).status, 400)
    assert.equal((await preview({ ...legacy, links: [] })).status, 400)
  }
  const missingRequired = structuredClone(bundle)
  delete missingRequired.projects
  assert.equal((await preview(missingRequired)).status, 400)
  for (const patch of [
    { stars: 10 },
    { progress: 'draft' },
    { progress: ['active'] },
    { status: 'archived' },
    { status: ['draft'] },
    { tags: [{ label: 'Vue', color: ['blue'] }] },
    { links: [{ kind: ['source'], href: 'https://vuejs.org/' }] },
    { sortOrder: 1000001 },
    { coverMediaId: 'bad-id' },
  ]) {
    const invalid = structuredClone(bundle)
    Object.assign(invalid.projects[0].values, patch)
    assert.equal((await preview(invalid)).status, 400)
  }
  for (const href of [
    '#',
    'javascript:alert(1)',
    'https://user:secret@example.com',
    'https://example.com/path\\name',
    'https://example.com/path\nname',
    'https://example.com/path name',
  ]) {
    const invalid = structuredClone(bundle)
    invalid.projects[0].values.links = [{ kind: 'source', href }]
    assert.equal((await preview(invalid)).status, 400)
  }
  const duplicateKind = structuredClone(bundle)
  duplicateKind.projects[0].values.links = [
    { kind: 'docs', href: 'https://vuejs.org/' },
    { kind: 'docs', href: 'https://www.typescriptlang.org/' },
  ]
  assert.equal((await preview(duplicateKind)).status, 400)
  const duplicateId = structuredClone(bundle)
  duplicateId.projects.push(structuredClone(duplicateId.projects[0]))
  assert.equal((await preview(duplicateId)).status, 400)
  const missing = structuredClone(bundle)
  missing.projects[0].values.coverMediaId = randomUUID()
  assert.equal((await preview(missing, 'copy')).data.data.plan.ready, false)

  const mappedId = randomUUID(),
    copied = structuredClone(bundle)
  copied.media[0].id = mappedId
  for (const item of copied.projects) if (item.values.coverMediaId) item.values.coverMediaId = mappedId
  const plan = (await preview(copied, 'copy')).data.data
  assert.equal(plan.plan.ready, true)
  assert.equal(plan.plan.counts.projects, 3)
  assert.equal(plan.plan.counts.media, 1)
  const imported = await execute(plan)
  assert.equal(imported.status, 201, imported.data.message)
  const result = imported.data.data.result
  assert.equal(result.projects.length, 3)
  const map = new Map(result.projects.map((item) => [item.sourceId, item.id]))
  assert(!map.has(deleted.id))
  const restored = await ok(`/admin/projects/${map.get(project.id)}`)
  assert.equal(restored.status, 'draft')
  assert.equal(restored.progress, 'archived')
  assert.equal(restored.coverMediaId, mappedId)
  assert.equal(restored.sortOrder, 17)
  assert.deepEqual(restored.tags, sourceProject.values.tags)
  assert.deepEqual(
    restored.links.map(({ kind, href }) => ({ kind, href })),
    sourceProject.values.links,
  )
  assert.equal(restored.createdAt, sourceProject.createdAt)
  assert.equal(restored.publishedAt, sourceProject.publishedAt)
  assert.equal((await request(`/projects/${restored.id}`, 'GET', undefined, '')).status, 404)
  assert.equal((await ok(`/admin/projects/${map.get(withoutCover.id)}`)).coverMediaId, null)
  assert.equal((await ok(`/admin/projects/${map.get(withdrawn.id)}`)).status, 'draft')
  assert.equal((await ok('/projects')).total, 1)
  assert(
    (await ok(`/admin/media/${mappedId}/references`)).items.some(
      (item) => item.kind === 'project' && item.url === `/admin/projects/${restored.id}`,
    ),
  )
  const em = fixture.testOrm.em.fork()
  const beforeRepeat = (await em.execute('select count(*)::int as n from project'))[0].n
  const repeated = await execute(plan)
  assert.deepEqual(repeated.data.data.result.projects, result.projects)
  assert.equal((await em.execute('select count(*)::int as n from project'))[0].n, beforeRepeat)
  assert.equal((await preview(copied)).data.data.plan.counts.projects, 0)
  const duplicateContent = structuredClone(copied)
  duplicateContent.projects = [
    {
      ...structuredClone(copied.projects[0]),
      sourceId: 10001,
      values: { ...copied.projects[0].values, title: '同包的新工具' },
    },
    {
      ...structuredClone(copied.projects[0]),
      sourceId: 10002,
      values: { ...copied.projects[0].values, title: '同包的新工具' },
    },
  ]
  assert.equal((await preview(duplicateContent)).data.data.plan.counts.projects, 1)
  assert.equal((await preview(duplicateContent, 'copy')).data.data.plan.counts.projects, 2)
  const stale = (await preview(copied, 'copy')).data.data
  await ok(`/admin/projects/${project.id}`, 'PATCH', { revision: project.revision, progress: 'active' })
  assert.equal((await execute(stale)).status, 409)

  const broken = structuredClone(copied),
    rollbackMedia = randomUUID()
  broken.media[0].id = rollbackMedia
  broken.projects[0].values.coverMediaId = rollbackMedia
  broken.projects[0].values.title = '项目迁入回滚证明'
  const brokenPlan = (await preview(broken, 'copy')).data.data
  const countsSql =
    'select (select count(*) from project)::int as projects,(select count(*) from post)::int as posts,(select count(*) from gallery_photo)::int as gallery,(select count(*) from media_asset)::int as media,(select count(*) from media_reference)::int as refs'
  const before = await em.execute(countsSql)
  await em.execute(
    "create function fail_project_import() returns trigger language plpgsql as $$ begin if new.title='项目迁入回滚证明' then raise exception 'isolated project import failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger fail_project_import before insert on project for each row execute function fail_project_import()',
  )
  assert.equal((await execute(brokenPlan)).status, 503)
  assert.deepEqual(await em.execute(countsSql), before)
  assert(!existsSync(join(process.env.MEDIA_DIRECTORY, `${rollbackMedia}.webp`)))
  const failedJob = await ok(`/admin/backup/imports/${brokenPlan.ticket}`)
  assert.equal(failedJob.completed, false)
  assert(failedJob.error)
  await em.execute('drop trigger fail_project_import on project')
  await em.execute('drop function fail_project_import()')

  const unknown = structuredClone(copied)
  unknown.posts = []
  unknown.flashes = []
  unknown.moments = []
  unknown.guestbook = []
  unknown.gallery = []
  unknown.projects = [
    { ...structuredClone(copied.projects[0]), values: { ...copied.projects[0].values, title: '等待响应的工具' } },
  ]
  const unknownPlan = (await preview(unknown, 'copy')).data.data
  await em.execute(
    "create function slow_project_import() returns trigger language plpgsql as $$ begin if new.title='等待响应的工具' then perform pg_sleep(0.5); end if; return new; end $$",
  )
  await em.execute(
    'create trigger slow_project_import before insert on project for each row execute function slow_project_import()',
  )
  await delay(1100)
  const controller = new AbortController()
  const sending = fetch(`${fixture.origin}/api/v1/admin/backup/imports/${unknownPlan.ticket}/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledgement: '导入为新草稿', confirmation: unknownPlan.confirmation }),
    signal: controller.signal,
  })
    .then((response) => response.status)
    .catch((cause) => cause.name)
  let started = false
  for (let attempt = 0; attempt < 100; attempt++) {
    const [job] = await em.execute('select started_at,completed_at from content_import where id=?', [
      unknownPlan.ticket,
    ])
    if (job.started_at && !job.completed_at) {
      started = true
      break
    }
    await delay(20)
  }
  assert(started, '必须确认请求实际开始后再中断客户端')
  controller.abort()
  assert.equal(await sending, 'AbortError')
  let completed = false
  for (let attempt = 0; attempt < 100; attempt++) {
    completed = !!(await em.execute('select completed_at from content_import where id=?', [unknownPlan.ticket]))[0]
      .completed_at
    if (completed) break
    await delay(20)
  }
  assert(completed, '客户端断开后必须核对持久化执行状态')
  const found = await ok(`/admin/backup/imports/${unknownPlan.ticket}`)
  assert.equal(found.result.projects.length, 1)
  assert.deepEqual((await execute(unknownPlan)).data.data.result.projects, found.result.projects)
  assert.equal((await em.execute("select count(*)::int as n from project where title='等待响应的工具'"))[0].n, 1)
  await em.execute('drop trigger slow_project_import on project')
  await em.execute('drop function slow_project_import()')
  const oldContext = (await request('/site')).headers.get('x-content-context')
  const nextContext = randomUUID()
  await em.execute('update content_context set generation=?,require_context=true', [nextContext])
  assert.equal(
    (
      await request(
        `/admin/projects/${project.id}`,
        'PATCH',
        { revision: project.revision + 1, title: '旧页面编辑' },
        token,
        oldContext,
      )
    ).status,
    409,
  )
  assert.equal(
    (await request(`/admin/projects/${project.id}`, 'PATCH', { revision: project.revision + 1, title: '无上下文编辑' }))
      .status,
    428,
  )
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    '项目维护通过：v5严格字段/v1-v4冻结、进展与草稿独立、封面可选映射、去重复制、原数据保留、事务回滚、断连后票据核查与恢复上下文\n',
  )
} finally {
  await fixture.close()
}
