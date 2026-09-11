/** @file link-backup-integration.mjs @description 友链v6严格格式、规范URL跳过与草稿复制、规则兼容、引用与真实断连后结果核查的隔离验收 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
const nativeFetch = globalThis.fetch
const externalRequests = []
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.origin !== fixture.origin) {
    externalRequests.push(url.href)
    throw new Error('友链维护不得自动访问输入的外部地址')
  }
  return nativeFetch(input, options)
}
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
  file.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'shared-logo.png')
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: file,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const post = await ok('/admin/posts', 'POST', {
    title: '共用图片的记录',
    cover: asset.url,
    contentRaw: '保留文章与媒体的原有关系。',
  })
  const gallery = await ok('/admin/gallery', 'POST', {
    title: '窗边的光',
    mediaId: asset.id,
    requestId: randomUUID(),
    status: 'published',
  })
  const project = await ok('/admin/projects', 'POST', {
    title: '记录台',
    coverMediaId: asset.id,
    requestId: randomUUID(),
    status: 'published',
  })
  const canonical = 'https://example.com/Docs/Guide?tag=A&tag=B&signature=AbC#Start'
  const link = await ok('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '山间札记',
    description: '安静记录沿途见闻。',
    url: canonical.replace('https://example.com', 'HTTPS://Example.COM:443'),
    logoMediaId: asset.id,
    logoUrl: null,
    status: 'published',
    isFeatured: true,
    sortOrder: 17,
  })
  const external = await ok('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '纸上花园',
    description: '',
    url: canonical.replace('/Docs/', '/docs/'),
    logoMediaId: null,
    logoUrl: 'https://assets.example.org/Logo.PNG?version=A&version=B#Icon',
    status: 'draft',
  })
  const withdrawn = await ok('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '一段路程',
    url: canonical.replace('/Guide?', '/Guide/?'),
    logoMediaId: null,
    logoUrl: null,
    status: 'withdrawn',
  })
  const deleted = await ok('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '旧书页',
    url: 'https://example.org/closed',
    logoMediaId: asset.id,
  })
  await ok(`/admin/links/${deleted.id}?revision=${deleted.revision}`, 'DELETE')
  assert.equal(
    (await request('/admin/links', 'POST', { requestId: randomUUID(), name: '相同地址', url: canonical })).status,
    400,
  )
  const rules = ['介绍相近主题的独立站点。', '在线申请暂未开放，可自行复制站点资料。']
  await ok('/admin/links/settings', 'PATCH', { revision: (await ok('/admin/links/settings')).revision, rules })
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.data
  assert.equal(bundle.version, 8)
  assert.equal(bundle.links.length, 4)
  assert.deepEqual(bundle.linkSettings, { rules })
  const sourceLink = bundle.links.find((item) => item.sourceId === link.id)
  assert.equal(sourceLink.values.url, canonical)
  assert.equal(sourceLink.values.logoMediaId, asset.id)
  assert.equal(sourceLink.values.logoUrl, null)
  assert.equal(sourceLink.values.isFeatured, true)
  assert.equal(bundle.links.find((item) => item.sourceId === deleted.id).deleted, true)
  for (const forbidden of ['requestId', 'requestHash', 'revision', 'domain', 'avatar', 'verified'])
    assert(!JSON.stringify(bundle.links).includes(`"${forbidden}"`))
  bundle.posts = bundle.posts.filter((item) => item.sourceId === post.id)
  bundle.gallery = bundle.gallery.filter((item) => item.sourceId === gallery.id)
  bundle.projects = bundle.projects.filter((item) => item.sourceId === project.id)
  async function preview(input, strategy = 'skip', settings = false, id = randomUUID()) {
    if (++writes % 5 === 0) await delay(1100)
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), 'links.json')
    form.append('requestId', id)
    form.append('strategy', strategy)
    form.append('includeSettings', String(settings))
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
  assert.equal(same.data.data.plan.counts.links, 0)
  assert.equal(same.data.data.plan.links.length, 4)
  let oldPlan
  for (const version of [1, 2, 3, 4, 5]) {
    const legacy = structuredClone(bundle)
    legacy.version = version
    delete legacy.site.about
    for (const photo of legacy.gallery ?? []) delete photo.values.externalUrl
    delete legacy.links
    delete legacy.linkSettings
    if (version < 5) delete legacy.projects
    if (version < 4) {
      delete legacy.gallery
      delete legacy.gallerySettings
    }
    if (version < 3) delete legacy.guestbook
    if (version < 2) delete legacy.moments
    const accepted = await preview(legacy, 'skip', true)
    assert.equal(accepted.status, 201, `旧v${version}必须仍可读取`)
    assert.equal(accepted.data.data.plan.counts.links, 0)
    assert.equal(accepted.data.data.linkSettingsPreview, null)
    oldPlan = accepted.data.data
    assert.equal((await preview({ ...legacy, links: [] })).status, 400)
    assert.equal((await preview({ ...legacy, linkSettings: { rules: [] } })).status, 400)
  }
  assert.equal((await execute(oldPlan)).status, 201)
  assert.deepEqual((await ok('/admin/links/settings')).rules, rules)
  for (const field of ['links', 'linkSettings']) {
    const invalid = structuredClone(bundle)
    delete invalid[field]
    assert.equal((await preview(invalid)).status, 400)
  }
  for (const patch of [
    { domain: 'other.example' },
    { avatar: 'https://example.org/logo.png' },
    { verified: true },
    { isFeatured: 'true' },
    { isFeatured: 1 },
    { status: ['draft'] },
    { status: 'enabled' },
    { sortOrder: 1000001 },
    { logoMediaId: 'bad-id' },
    { logoMediaId: asset.id, logoUrl: 'https://example.org/logo.png' },
  ]) {
    const invalid = structuredClone(bundle)
    Object.assign(invalid.links[0].values, patch)
    assert.equal((await preview(invalid)).status, 400)
  }
  for (const url of [
    '#',
    'javascript:alert(1)',
    'https://user:secret@example.com/path',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\nb',
    'https://example.com/' + '路'.repeat(350),
  ]) {
    const invalid = structuredClone(bundle)
    invalid.links[0].values.url = url
    assert.equal((await preview(invalid)).status, 400)
  }
  for (const logoUrl of [
    'http://example.org/logo.png',
    'data:image/png;base64,AAAA',
    `/api/v1/media/${asset.id}.webp`,
    `https://outside.example/api/v1/media/${asset.id}.webp`,
    `https://outside.example/%61pi/v1/media/${asset.id}.webp`,
  ]) {
    const invalid = structuredClone(bundle)
    Object.assign(invalid.links[0].values, { logoMediaId: null, logoUrl })
    assert.equal((await preview(invalid)).status, 400)
  }
  for (const rules of [[''], ['x'.repeat(301)], Array(13).fill('规则'), [1]]) {
    const invalid = structuredClone(bundle)
    invalid.linkSettings.rules = rules
    assert.equal((await preview(invalid)).status, 400)
  }
  const duplicateId = structuredClone(bundle)
  duplicateId.links.push(structuredClone(duplicateId.links[0]))
  assert.equal((await preview(duplicateId)).status, 400)
  const missing = structuredClone(bundle)
  missing.links[0].values.logoMediaId = randomUUID()
  assert.equal((await preview(missing, 'copy')).data.data.plan.ready, false)
  const changedText = structuredClone(bundle)
  changedText.links[0].values.name = '内容不同但地址相同'
  assert.equal((await preview(changedText)).data.data.plan.counts.links, 0)
  assert.equal((await ok(`/admin/links/${link.id}`)).name, '山间札记')
  const duplicateUrl = structuredClone(bundle)
  duplicateUrl.links = [
    {
      ...structuredClone(sourceLink),
      sourceId: 10001,
      values: { ...sourceLink.values, name: '同包的第一项', url: 'HTTPS://Package.example:443/Path?tag=A&tag=B#Start' },
    },
    {
      ...structuredClone(sourceLink),
      sourceId: 10002,
      values: { ...sourceLink.values, name: '同包的第二项', url: 'https://package.example/Path?tag=A&tag=B#Start' },
    },
  ]
  assert.equal((await preview(duplicateUrl)).data.data.plan.counts.links, 1)
  assert.equal((await preview(duplicateUrl, 'copy')).data.data.plan.counts.links, 2)

  const copied = structuredClone(bundle),
    mappedId = randomUUID()
  copied.media[0].id = mappedId
  for (const item of copied.links) if (item.values.logoMediaId) item.values.logoMediaId = mappedId
  copied.linkSettings.rules = ['从备份迁入后再次核对站点内容。']
  const plan = (await preview(copied, 'copy', true)).data.data
  assert.equal(plan.plan.ready, true)
  assert.equal(plan.plan.counts.links, 3)
  assert.equal(plan.plan.counts.media, 1)
  assert.deepEqual(plan.linkSettingsPreview, copied.linkSettings)
  assert.match(plan.plan.links.find((item) => item.sourceId === link.id).reason, /相同地址.*草稿/)
  const imported = await execute(plan)
  assert.equal(imported.status, 201, imported.data.message)
  const result = imported.data.data.result
  assert.equal(result.links.length, 3)
  const map = new Map(result.links.map((item) => [item.sourceId, item.id]))
  assert(!map.has(deleted.id))
  const restored = await ok(`/admin/links/${map.get(link.id)}`)
  assert.equal(restored.status, 'draft')
  assert.equal(restored.url, canonical)
  assert.equal(restored.logoMediaId, mappedId)
  assert.equal(restored.isFeatured, true)
  assert.equal(restored.sortOrder, 17)
  assert.equal(restored.createdAt, sourceLink.createdAt)
  assert.equal(restored.publishedAt, sourceLink.publishedAt)
  assert.equal(restored.domain, 'example.com')
  assert.equal((await request(`/links/${restored.id}`, 'GET', undefined, '')).status, 404)
  assert.equal((await ok(`/admin/links/${map.get(external.id)}`)).logoUrl, external.logoUrl)
  assert.equal((await ok(`/admin/links/${map.get(withdrawn.id)}`)).status, 'draft')
  assert.equal((await ok('/links')).total, 1)
  assert(
    (await ok(`/admin/media/${mappedId}/references`)).items.some(
      (item) => item.kind === 'link' && item.url === `/admin/links/${restored.id}`,
    ),
  )
  assert.deepEqual((await ok('/admin/links/settings')).rules, copied.linkSettings.rules)
  assert.equal(
    (await request(`/admin/links/${restored.id}`, 'PATCH', { revision: restored.revision, status: 'published' }))
      .status,
    400,
  )
  const em = fixture.testOrm.em.fork()
  await assert.rejects(
    em.execute("update friend_link set status='published' where id=?", [restored.id]),
    /friend_link_public_url_unique|duplicate key/i,
  )
  const count = (await em.execute('select count(*)::int as n from friend_link'))[0].n
  assert.deepEqual((await execute(plan)).data.data.result.links, result.links)
  assert.equal((await em.execute('select count(*)::int as n from friend_link'))[0].n, count)
  assert.equal((await preview(copied)).data.data.plan.counts.links, 0)
  const stale = (await preview(copied, 'copy')).data.data
  await ok(`/admin/links/${link.id}`, 'PATCH', { revision: link.revision, description: '重新整理的站点介绍。' })
  assert.equal((await execute(stale)).status, 409)
  const staleSettings = (await preview(copied, 'copy', true)).data.data
  await ok('/admin/links/settings', 'PATCH', {
    revision: (await ok('/admin/links/settings')).revision,
    rules: ['当前采用的规则。'],
  })
  assert.equal((await execute(staleSettings)).status, 409)
  const withoutSettings = (await preview(copied, 'skip')).data.data
  assert.equal(withoutSettings.linkSettingsPreview, undefined)
  assert.equal((await execute(withoutSettings)).status, 201)
  assert.deepEqual((await ok('/admin/links/settings')).rules, ['当前采用的规则。'])

  const broken = structuredClone(copied),
    rollbackMedia = randomUUID()
  broken.media[0].id = rollbackMedia
  broken.links[0].values.logoMediaId = rollbackMedia
  broken.links[0].values.name = '友链迁入回滚证明'
  const brokenPlan = (await preview(broken, 'copy', true)).data.data
  const countsSql =
    "select (select count(*) from friend_link)::int as links,(select count(*) from project)::int as projects,(select count(*) from post)::int as posts,(select count(*) from gallery_photo)::int as gallery,(select count(*) from guestbook_message)::int as guestbook,(select count(*) from media_asset)::int as media,(select count(*) from media_reference)::int as refs,(select revision from link_settings where id='default') as rules_revision"
  const before = await em.execute(countsSql)
  await em.execute(
    "create function fail_link_import() returns trigger language plpgsql as $$ begin if new.name='友链迁入回滚证明' then raise exception 'isolated link import failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger fail_link_import before insert on friend_link for each row execute function fail_link_import()',
  )
  assert.equal((await execute(brokenPlan)).status, 503)
  assert.deepEqual(await em.execute(countsSql), before)
  assert(!existsSync(join(process.env.MEDIA_DIRECTORY, `${rollbackMedia}.webp`)))
  const failed = await ok(`/admin/backup/imports/${brokenPlan.ticket}`)
  assert.equal(failed.completed, false)
  assert(failed.error)
  await em.execute('drop trigger fail_link_import on friend_link')
  await em.execute('drop function fail_link_import()')
  const badSettings = structuredClone(copied)
  badSettings.linkSettings.rules = ['规则写入回滚']
  const settingsPlan = (await preview(badSettings, 'copy', true)).data.data
  await em.execute(
    "create function fail_link_settings_import() returns trigger language plpgsql as $$ begin if new.rules @> '[\"规则写入回滚\"]'::jsonb then raise exception 'isolated link settings failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger fail_link_settings_import before update on link_settings for each row execute function fail_link_settings_import()',
  )
  assert.equal((await execute(settingsPlan)).status, 503)
  assert.deepEqual(await em.execute(countsSql), before)
  await em.execute('drop trigger fail_link_settings_import on link_settings')
  await em.execute('drop function fail_link_settings_import()')

  const unknown = structuredClone(copied)
  unknown.posts = []
  unknown.flashes = []
  unknown.moments = []
  unknown.guestbook = []
  unknown.gallery = []
  unknown.projects = []
  unknown.links = [
    {
      ...structuredClone(copied.links[0]),
      values: {
        ...copied.links[0].values,
        name: '等待回音的站点',
        url: 'https://pending.example/Path?tag=A&tag=B#Start',
      },
    },
  ]
  const unknownPlan = (await preview(unknown, 'copy')).data.data
  await em.execute(
    "create function slow_link_import() returns trigger language plpgsql as $$ begin if new.name='等待回音的站点' then perform pg_sleep(0.5); end if; return new; end $$",
  )
  await em.execute(
    'create trigger slow_link_import before insert on friend_link for each row execute function slow_link_import()',
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
    const [row] = await em.execute('select started_at,completed_at from content_import where id=?', [
      unknownPlan.ticket,
    ])
    if (row.started_at && !row.completed_at) {
      started = true
      break
    }
    await delay(20)
  }
  assert(started, '必须确认真实请求开始后再断开客户端')
  controller.abort()
  assert.equal(await sending, 'AbortError')
  let completed = false
  for (let attempt = 0; attempt < 100; attempt++) {
    completed = !!(await em.execute('select completed_at from content_import where id=?', [unknownPlan.ticket]))[0]
      .completed_at
    if (completed) break
    await delay(20)
  }
  assert(completed, '断连后必须核查数据库实际完成状态')
  const found = await ok(`/admin/backup/imports/${unknownPlan.ticket}`)
  assert.equal(found.result.links.length, 1)
  assert.deepEqual((await execute(unknownPlan)).data.data.result.links, found.result.links)
  assert.equal((await em.execute("select count(*)::int as n from friend_link where name='等待回音的站点'"))[0].n, 1)
  await em.execute('drop trigger slow_link_import on friend_link')
  await em.execute('drop function slow_link_import()')

  // 模拟升级前已持久化的票据，而不是仅用新服务重新上传旧版本文件。
  const { packageHash } = createRequire(import.meta.url)('../dist/modules/backup/content-package.js')
  const oldMessage = await ok('/admin/guestbook', 'POST', { content: '旧票据中的留言', requestId: randomUUID() })
  const oldReply = await ok('/admin/guestbook', 'POST', {
    content: '旧票据中的答复',
    replyToId: oldMessage.id,
    requestId: randomUUID(),
  })
  const currentSnapshot = (await request('/admin/backup/export', 'POST', { mediaIncluded: false })).data
  const legacyPayload = structuredClone(currentSnapshot)
  legacyPayload.version = 5
  delete legacyPayload.site.about
  for (const photo of legacyPayload.gallery ?? []) delete photo.values.externalUrl
  delete legacyPayload.links
  delete legacyPayload.linkSettings
  legacyPayload.posts = legacyPayload.posts.filter((item) => item.sourceId === post.id)
  legacyPayload.gallery = legacyPayload.gallery.filter((item) => item.sourceId === gallery.id)
  legacyPayload.projects = legacyPayload.projects.filter((item) => item.sourceId === project.id)
  legacyPayload.guestbook = legacyPayload.guestbook.filter((item) =>
    [oldMessage.id, oldReply.id].includes(item.sourceId),
  )
  const legacyPreview = (await preview(legacyPayload, 'copy', true)).data.data
  const [stored] = await em.execute('select payload,plan from content_import where id=?', [legacyPreview.ticket])
  const payloadV5 = { ...stored.payload, version: 5 }
  delete payloadV5.links
  delete payloadV5.linkSettings
  const planV5 = structuredClone(stored.plan)
  delete planV5.links
  delete planV5.counts.links
  delete planV5.linkSettingsRevision
  const [versions] = await em.execute(`select (select generation from content_context where id='default') as context,
    (select revision from site_settings where id='default') as site,
    (select revision from comment_policy where id='default') as policy,
    (select revision from gallery_settings where id='default') as gallery`)
  // 此对象保持 v5 的实际基准算法：没有 links 字段或第四项规则配置版本。
  planV5.basis = packageHash({
    context: versions.context,
    guestbook: currentSnapshot.guestbook,
    gallery: currentSnapshot.gallery,
    projects: currentSnapshot.projects,
    posts: currentSnapshot.posts.map((item) => ({ id: item.sourceId, values: item.values })),
    flashes: currentSnapshot.flashes.map((item) => ({ id: item.sourceId, values: item.values })),
    moments: currentSnapshot.moments.map((item) => ({
      id: item.sourceId,
      values: item.values,
      deleted: item.deleted,
      comments: item.comments,
    })),
    folders: currentSnapshot.folders,
    tags: currentSnapshot.tags,
    aliases: await em.execute('select kind,alias,target from taxonomy_alias order by kind,alias'),
    addresses: (await em.execute('select slug,post_id from post_address order by slug')).map((item) => ({
      slug: item.slug,
      post: item.post_id,
    })),
    media: currentSnapshot.media.map((item) => ({ id: item.id, sha256: item.sha256, deleted: item.deleted })),
    settings: [versions.site, versions.policy, payloadV5.gallerySettings ? versions.gallery : null],
  })
  await em.execute('update content_import set payload=?::jsonb,plan=?::jsonb where id=?', [
    JSON.stringify(payloadV5),
    JSON.stringify(planV5),
    legacyPreview.ticket,
  ])
  const oldTicket = await ok(`/admin/backup/imports/${legacyPreview.ticket}`)
  assert.equal(oldTicket.plan.links, undefined)
  assert.equal(oldTicket.plan.counts.links, undefined)
  assert.equal(oldTicket.linkSettingsPreview, undefined)
  const countsBeforeLegacy = await em.execute(countsSql)
  const mustRepreview = await execute(oldTicket)
  assert.equal(mustRepreview.status, 409)
  assert.match(mustRepreview.data.message, /重新预览/)
  assert.deepEqual(await em.execute(countsSql), countsBeforeLegacy)
  const refreshed = await ok(`/admin/backup/imports/${oldTicket.ticket}/repreview`, 'POST')
  assert.equal(refreshed.plan.counts.links, 0)
  assert.deepEqual(refreshed.plan.links, [])
  assert.equal((await execute(oldTicket)).status, 409, '重新预览后旧确认摘要不能执行')
  const currentRules = (await ok('/admin/links/settings')).rules
  const migratedLegacy = await execute(refreshed)
  assert.equal(migratedLegacy.status, 201, migratedLegacy.data.message)
  const legacyResult = migratedLegacy.data.data.result
  assert.equal(legacyResult.posts.length, 1)
  assert.equal(legacyResult.gallery.length, 1)
  assert.equal(legacyResult.projects.length, 1)
  assert.equal(legacyResult.guestbook.length, 2)
  assert.deepEqual(legacyResult.links, [])
  const importedParent = legacyResult.guestbook.find((item) => item.sourceId === oldMessage.id).id
  const importedReply = legacyResult.guestbook.find((item) => item.sourceId === oldReply.id).id
  assert.equal((await ok(`/admin/guestbook/${importedReply}`)).replyTo.id, importedParent)
  assert.deepEqual((await ok('/admin/links/settings')).rules, currentRules)

  // 已完成 v5 结果缺少 links，已完成 v1 结果还缺少后来新增的业务数组。
  const completedCases = [{ ticket: oldTicket.ticket, fields: ['links'] }]
  const payloadV1 = structuredClone(legacyPayload)
  payloadV1.version = 1
  delete payloadV1.site.about
  for (const field of ['moments', 'guestbook', 'gallery', 'gallerySettings', 'projects']) delete payloadV1[field]
  const previewV1 = (await preview(payloadV1, 'copy')).data.data
  const importedV1 = await execute(previewV1)
  assert.equal(importedV1.status, 201)
  completedCases.push({ ticket: previewV1.ticket, fields: ['moments', 'guestbook', 'gallery', 'projects', 'links'] })
  for (const completedCase of completedCases) {
    const [record] = await em.execute('select plan,result from content_import where id=?', [completedCase.ticket])
    for (const field of completedCase.fields) {
      assert.equal(record.result[field]?.length ?? 0, 0, '模拟旧版缺省字段不能丢弃真实迁入内容')
      delete record.plan[field]
      delete record.plan.counts[field]
      delete record.result[field]
    }
    delete record.plan.linkSettingsRevision
    if (completedCase.fields.includes('gallery')) delete record.plan.gallerySettingsRevision
    await em.execute('update content_import set plan=?::jsonb,result=?::jsonb where id=?', [
      JSON.stringify(record.plan),
      JSON.stringify(record.result),
      completedCase.ticket,
    ])
    const beforeRepeat = await em.execute(countsSql)
    const completedView = await ok(`/admin/backup/imports/${completedCase.ticket}`)
    assert.equal(completedView.completed, true)
    assert.equal(completedView.result.links, undefined)
    assert.equal(completedView.result.posts.length, 1)
    const repeatedCompleted = await execute(completedView)
    assert.equal(repeatedCompleted.status, 201)
    assert.equal(repeatedCompleted.data.data.importedLinks, 0)
    assert.deepEqual(repeatedCompleted.data.data.result, record.result)
    assert.deepEqual(
      (await ok(`/admin/backup/imports/${completedCase.ticket}/repreview`, 'POST')).result,
      record.result,
    )
    assert.deepEqual(await em.execute(countsSql), beforeRepeat)
  }
  process.stdout.write(
    '旧持久化票据通过：v5预览强制重新确认、不遗漏文章/留言回复/图库/项目、不清新规则；v1/v5完成结果缺新字段仍可查询和重复执行且不增殖\n',
  )
  const oldContext = (await request('/site')).headers.get('x-content-context'),
    nextContext = randomUUID()
  const current = await ok(`/admin/links/${link.id}`)
  await em.execute('update content_context set generation=?,require_context=true', [nextContext])
  assert.equal(
    (
      await request(
        `/admin/links/${link.id}`,
        'PATCH',
        { revision: current.revision, name: '旧页面输入' },
        token,
        oldContext,
      )
    ).status,
    409,
  )
  assert.equal(
    (await request(`/admin/links/${link.id}`, 'PATCH', { revision: current.revision, name: '缺少上下文' })).status,
    428,
  )
  assert.equal(
    (
      await request(
        `/admin/links/${link.id}`,
        'PATCH',
        { revision: current.revision, name: current.name },
        token,
        nextContext,
      )
    ).status,
    200,
  )
  assert.deepEqual(externalRequests, [])
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    '友链维护通过：v6与v1-v5冻结、URL语义/同址跳过与草稿复制、规则选择/旧包保护、媒体映射、双故障事务回滚、真实断连票据幂等、恢复上下文与零外部抓取\n',
  )
} finally {
  globalThis.fetch = nativeFetch
  await fixture.close()
}
