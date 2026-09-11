/**
 * @file backup-integration.mjs
 * @description 隔离内容包的导出、媒体/引用校验、草稿迁入、事务回滚、票据幂等与恢复上下文保护。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  let token
  let writes = 0
  async function request(path, method = 'GET', body, credential = token, context) {
    if (method !== 'GET' && ++writes % 6 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': 'backup-isolated-visitor',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        ...(context ? { 'X-Content-Context': context } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json(), headers: response.headers }
  }
  const login = await request('/auth/login', 'POST', { username: fixture.username, password: fixture.password }, '')
  assert.equal(login.status, 200)
  token = login.body.data.accessToken
  async function ok(path, method = 'GET', body) {
    const response = await request(path, method, body)
    assert(response.status < 300, `${path}: ${response.status} ${response.body.message ?? ''}`)
    return response.body.data
  }
  const upload = new FormData()
  upload.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'backup-source.png',
  )
  const assetResponse = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: upload,
  })
  assert.equal(assetResponse.status, 201)
  const asset = (await assetResponse.json()).data
  const original = await ok('/admin/posts', 'POST', {
    title: '内容包源文章',
    contentRaw: `![图片](${asset.url})`,
    status: 'published',
    slug: 'backup-source',
  })
  const parent = await ok(`/posts/${original.id}/comments`, 'POST', {
    author: '备份访客',
    avatar: asset.url,
    content: '导入根评论',
  })
  await ok(`/posts/${original.id}/comments`, 'POST', { author: '备份访客', content: '导入子评论', parentId: parent.id })
  const flash = await ok('/admin/flashes', 'POST', { content: '内容包源闪念', images: [asset.url], isDraft: false })
  await ok(`/flashes/${flash.id}/comments`, 'POST', {
    authorName: '备份访客',
    authorAvatar: asset.url,
    content: '迁入闪念评论',
  })
  const moment = await ok('/admin/moments', 'POST', {
    content: '内容包源朋友圈',
    images: [asset.url],
    linkedArticleId: original.id,
    status: 'published',
    topics: ['迁入'],
    requestId: randomUUID(),
  })
  await ok(`/moments/${moment.id}/like`, 'PUT', { liked: true })
  await ok(`/moments/${moment.id}/comments`, 'POST', {
    author: '迁入访客',
    avatar: asset.url,
    content: '迁入动态公开评论',
    requestId: randomUUID(),
  })
  const hidden = await ok(`/moments/${moment.id}/comments`, 'POST', {
    author: '迁入访客',
    avatar: asset.url,
    content: '迁入动态隐藏评论',
    requestId: randomUUID(),
  })
  await ok(`/admin/moments/${moment.id}/comments/${hidden.id}`, 'PATCH', {
    status: 'hidden',
    expectedStatus: 'published',
  })
  const guest = await ok('/guestbook', 'POST', {
    content: '迁入留言父项',
    author: '小林',
    avatar: asset.url,
    requestId: randomUUID(),
  })
  const reply = await ok('/admin/guestbook', 'POST', {
    content: '迁入留言答复',
    replyToId: guest.id,
    requestId: randomUUID(),
  })
  await ok(`/guestbook/${guest.id}/reactions`, 'PUT', { emoji: '👍', reacted: true })
  const deletedGuest = await ok('/admin/guestbook', 'POST', { content: '已删除引用源', requestId: randomUUID() })
  const hiddenReply = await ok('/admin/guestbook', 'POST', {
    content: '保留隐藏回复',
    replyToId: deletedGuest.id,
    requestId: randomUUID(),
  })
  await ok(`/admin/guestbook/${hiddenReply.id}`, 'PATCH', { status: 'hidden', revision: hiddenReply.revision })
  await ok(`/admin/guestbook/${deletedGuest.id}?revision=${deletedGuest.revision}`, 'DELETE')
  const gallery = await ok('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    mediaId: asset.id,
    title: '雾中的桥',
    description: '清晨河面上的薄雾',
    category: '城市',
    takenOn: '2020-11-04',
    location: '',
    device: '',
    status: 'published',
    sortOrder: 8,
  })
  const withdrawnGallery = await ok('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    mediaId: asset.id,
    title: '留在窗边的光',
    status: 'withdrawn',
  })
  const deletedGallery = await ok('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    mediaId: asset.id,
    title: '重拍之前',
  })
  await ok(`/admin/gallery/${deletedGallery.id}?revision=${deletedGallery.revision}`, 'DELETE')
  const gear = [{ icon: 'lucide:camera', name: '随行相机', description: '器材介绍由博主维护' }]
  await ok('/admin/gallery/settings', 'PATCH', { gear, revision: (await ok('/admin/gallery/settings')).revision })
  const siteBefore = await ok('/admin/site')
  const { updatedAt: _siteUpdatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...siteInput } = siteBefore
  const about = { visible: true, introduction: '公开介绍', sections: [{ kind: 'reading', visible: false, items: [{ title: '尚未公开的书单', detail: '只在后台保留', period: '', visible: false }] }] }
  await ok('/admin/site', 'PATCH', { ...siteInput, about })
  assert.equal((await request('/admin/backup/export', 'POST', { mediaIncluded: true }, '')).status, 401)
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  assert(exported.headers.get('content-disposition').includes('attachment'))
  assert.equal(exported.body.format, 'tixxin-content')
  const bundle = exported.body
  assert.equal(bundle.version, 8)
  assert.deepEqual(bundle.site.about, about, '管理员内容包保留隐藏资料供迁入恢复')
  assert.deepEqual(bundle.projects, [])
  assert.deepEqual(bundle.links, [])
  assert.deepEqual(bundle.linkSettings, { rules: [] })
  assert.equal(bundle.gallery.length, 3)
  assert.deepEqual(bundle.gallerySettings, { gear })
  assert.equal(bundle.gallery.find((photo) => photo.sourceId === gallery.id).values.takenOn, '2020-11-04')
  assert.equal(bundle.gallery.find((photo) => photo.sourceId === withdrawnGallery.id).values.takenOn, null)
  assert(!JSON.stringify(bundle.gallery).includes('requestId'))
  assert(!JSON.stringify(bundle.gallery).includes('revision'))
  assert.equal(bundle.guestbook.length, 4)
  assert.equal(bundle.guestbook.find((item) => item.sourceId === reply.id).replyToId, guest.id)
  assert.equal(bundle.guestbook.find((item) => item.sourceId === deletedGuest.id).deleted, true)
  assert(!JSON.stringify(bundle.guestbook).includes('requestId'))
  assert(!JSON.stringify(bundle.guestbook).includes('reactions'))
  assert.equal(bundle.moments.length, 1)
  assert.equal(bundle.moments[0].comments.length, 2)
  assert(!JSON.stringify(bundle.moments).includes('requestId'))
  assert(!JSON.stringify(bundle.moments).includes('likes'))
  bundle.posts = bundle.posts.filter((item) => item.sourceId === original.id)
  bundle.flashes = bundle.flashes.filter((item) => item.sourceId === flash.id)
  assert.equal(bundle.posts[0].comments.length, 2)
  assert(!JSON.stringify(bundle).includes('visitorIdHash'))
  assert(bundle.media[0].base64)
  async function preview(data, strategy = 'skip', includeSettings = false, id = randomUUID()) {
    if (++writes % 6 === 0) await delay(1100)
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }), 'content.json')
    form.append('requestId', id)
    form.append('strategy', strategy)
    form.append('includeSettings', String(includeSettings))
    const response = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    return { status: response.status, body: await response.json() }
  }
  const same = await preview(bundle)
  assert.equal(same.status, 201, same.body.message)
  assert.equal(same.body.data.plan.counts.posts, 0)
  assert.equal(same.body.data.plan.counts.skipped, 10)
  assert.equal(same.body.data.plan.counts.gallery, 0)
  assert.equal((await preview(bundle, 'skip', false, same.body.data.ticket)).body.data.ticket, same.body.data.ticket)
  assert.equal((await preview({ ...bundle, version: 99 })).status, 400)
  assert.equal(
    (
      await preview(
        JSON.parse(JSON.stringify(bundle).replace('"version":8', '"version":8,"__proto__":{"polluted":true}')),
      )
    ).status,
    400,
  )
  const legacy = structuredClone(bundle)
  legacy.version = 1
  delete legacy.site.about
  for (const photo of legacy.gallery ?? []) delete photo.values.externalUrl
  delete legacy.moments
  delete legacy.guestbook
  delete legacy.gallery
  delete legacy.gallerySettings
  delete legacy.projects
  delete legacy.links
  delete legacy.linkSettings
  assert.equal((await preview(legacy)).body.data.plan.counts.moments, 0)
  const legacyV2 = structuredClone(bundle)
  legacyV2.version = 2
  delete legacyV2.site.about
  delete legacyV2.guestbook
  delete legacyV2.gallery
  delete legacyV2.gallerySettings
  delete legacyV2.projects
  delete legacyV2.links
  delete legacyV2.linkSettings
  assert.equal((await preview(legacyV2)).body.data.plan.counts.guestbook, 0)
  const legacyV3 = structuredClone(bundle)
  legacyV3.version = 3
  delete legacyV3.site.about
  delete legacyV3.gallery
  delete legacyV3.gallerySettings
  delete legacyV3.projects
  delete legacyV3.links
  delete legacyV3.linkSettings
  const oldPreview = await preview(legacyV3, 'skip', true)
  assert.equal(oldPreview.status, 201)
  assert.equal(oldPreview.body.data.plan.counts.gallery, 0)
  assert.equal(oldPreview.body.data.gallerySettingsPreview, null)
  assert.equal((await preview({ ...legacyV3, gallery: [] })).status, 400)
  assert.equal((await preview({ ...legacyV3, gallerySettings: { gear: [] } })).status, 400)
  const legacyV4 = structuredClone(bundle)
  legacyV4.version = 4
  delete legacyV4.site.about
  for (const photo of legacyV4.gallery ?? []) delete photo.values.externalUrl
  delete legacyV4.projects
  delete legacyV4.links
  delete legacyV4.linkSettings
  assert.equal((await preview(legacyV4)).body.data.plan.counts.projects, 0)
  assert.equal((await preview({ ...legacyV4, projects: [] })).status, 400)
  const invalidLegacyGear = structuredClone(legacyV4)
  invalidLegacyGear.gallerySettings.gear[0].icon = ['lucide:camera']
  assert.equal((await preview(invalidLegacyGear)).status, 400)
  const legacyV5 = structuredClone(bundle)
  legacyV5.version = 5
  delete legacyV5.site.about
  for (const photo of legacyV5.gallery ?? []) delete photo.values.externalUrl
  delete legacyV5.links
  delete legacyV5.linkSettings
  assert.equal((await preview(legacyV5)).body.data.plan.counts.links, 0)
  assert.equal((await preview({ ...legacyV5, links: [] })).status, 400)
  assert.equal((await preview({ ...legacyV5, linkSettings: { rules: [] } })).status, 400)
  const legacyV7 = structuredClone(bundle)
  legacyV7.version = 7
  delete legacyV7.site.about
  const oldSitePlan = await preview(legacyV7, 'skip', true)
  assert.equal(oldSitePlan.status, 201)
  const oldSiteResult = await ok(`/admin/backup/imports/${oldSitePlan.body.data.ticket}/execute`, 'POST', { acknowledgement: '导入为新草稿', confirmation: oldSitePlan.body.data.confirmation })
  assert(oldSiteResult.completed)
  assert.deepEqual((await ok('/admin/site')).about, about, '旧内容包未提供关于页时保留目标资料')
  assert.equal((await preview({ ...legacyV7, site: { ...legacyV7.site, about } })).status, 400, '旧版本不能偷偷接受新字段')
  assert.equal((await preview({ ...bundle, friendApplications: [] })).status, 400)
  const invalidGallery = structuredClone(bundle)
  invalidGallery.gallery[0].values.takenOn = '2025-02-30'
  assert.equal((await preview(invalidGallery)).status, 400)
  invalidGallery.gallery[0].values.takenOn = null
  invalidGallery.gallery[0].values.width = 100
  assert.equal((await preview(invalidGallery)).status, 400)
  delete invalidGallery.gallery[0].values.width
  invalidGallery.gallery[0].values.requestId = randomUUID()
  assert.equal((await preview(invalidGallery)).status, 400)
  const missingGallery = structuredClone(bundle)
  missingGallery.gallery[0].values.mediaId = randomUUID()
  assert.equal((await preview(missingGallery, 'copy')).body.data.plan.ready, false)
  assert.equal((await preview({ ...bundle, version: 2 })).status, 400)
  assert.equal((await preview({ ...bundle, version: 1 })).status, 400)
  const invalidGuest = structuredClone(bundle)
  invalidGuest.guestbook[0].replyToId = invalidGuest.guestbook[0].sourceId
  assert.equal((await preview(invalidGuest)).status, 400)
  invalidGuest.guestbook[0].replyToId = 2147483647
  assert.equal((await preview(invalidGuest)).status, 400)
  invalidGuest.guestbook[0].replyToId = null
  invalidGuest.guestbook[0].requestId = randomUUID()
  assert.equal((await preview(invalidGuest)).status, 400)
  const invalidMoment = structuredClone(bundle)
  invalidMoment.moments[0].values.requestId = randomUUID()
  assert.equal((await preview(invalidMoment)).status, 400)
  delete invalidMoment.moments[0].values.requestId
  invalidMoment.moments[0].values.linkedArticleId = 2147483647
  assert.equal((await preview(invalidMoment)).status, 400)
  const missing = structuredClone(bundle)
  missing.media = []
  missing.posts[0].values.cover = `/api/v1/media/${randomUUID()}.webp`
  const missingPreview = await preview(missing)
  assert.equal(missingPreview.status, 201)
  assert.equal(missingPreview.body.data.plan.ready, false)
  const corrupt = structuredClone(bundle)
  corrupt.media[0].sha256 = '0'.repeat(64)
  assert.equal((await preview(corrupt)).status, 400)
  const migratedMediaId = randomUUID()
  const copied = structuredClone(bundle)
  copied.media[0].id = migratedMediaId
  copied.posts[0].values.cover = `/api/v1/media/${migratedMediaId}.webp`
  copied.gallery.forEach((photo) => {
    photo.values.mediaId = migratedMediaId
  })
  copied.gallerySettings.gear[0].description = '随身携带，记录日常'
  copied.site.name = '迁入后的站点资料'
  const planned = (await preview(copied, 'copy', true)).body.data
  assert.equal(planned.plan.ready, true)
  assert.equal(planned.plan.counts.posts, 1)
  assert.equal(planned.plan.counts.moments, 1)
  assert.equal(planned.plan.counts.guestbook, 4)
  assert.equal(planned.plan.counts.media, 1)
  assert.equal(planned.plan.counts.gallery, 2)
  assert.deepEqual(planned.gallerySettingsPreview, copied.gallerySettings)
  assert.notEqual(planned.plan.posts[0].slug, 'backup-source')
  const execute = (value, confirmation = value.confirmation) =>
    request(`/admin/backup/imports/${value.ticket}/execute`, 'POST', { acknowledgement: '导入为新草稿', confirmation })
  const imported = await execute(planned)
  assert.equal(imported.status, 201, imported.body.message)
  assert.equal(imported.body.data.completed, true)
  assert.equal(imported.body.data.result.posts.length, 1)
  assert.equal(imported.body.data.result.comments, 5)
  assert.equal(imported.body.data.result.gallery.length, 2)
  const importedPhotoId = imported.body.data.result.gallery.find((photo) => photo.sourceId === gallery.id).id
  const importedPhoto = await ok(`/admin/gallery/${importedPhotoId}`)
  assert.equal(importedPhoto.status, 'draft')
  assert.equal(importedPhoto.mediaId, migratedMediaId)
  assert.equal(importedPhoto.takenOn, '2020-11-04')
  assert.equal(importedPhoto.sortOrder, 8)
  assert.equal((await request(`/gallery/${importedPhotoId}`, 'GET', undefined, '')).status, 404)
  assert(
    (await ok(`/admin/media/${migratedMediaId}/references`)).items.some(
      (item) => item.url === `/admin/gallery/${importedPhotoId}`,
    ),
  )
  assert.deepEqual((await ok('/admin/gallery/settings')).gear, copied.gallerySettings.gear)
  const importedGuest = new Map(imported.body.data.result.guestbook.map((item) => [item.sourceId, item.id]))
  assert.equal(importedGuest.size, 4)
  const newGuest = await ok(`/admin/guestbook/${importedGuest.get(guest.id)}`)
  const newReply = await ok(`/admin/guestbook/${importedGuest.get(reply.id)}`)
  assert.equal(newGuest.moderationStatus, 'pending')
  assert.equal(newGuest.isPinned, false)
  assert.equal(newGuest.reactions.length, 0)
  assert.equal(newReply.replyTo.id, newGuest.id)
  assert.equal((await request(`/guestbook/${newGuest.id}`, 'GET', undefined, '')).status, 404)
  const restoredHidden = await ok(`/admin/guestbook/${importedGuest.get(hiddenReply.id)}`)
  assert.equal(restoredHidden.moderationStatus, 'hidden')
  const importedRows = await fixture.testOrm.em
    .fork()
    .execute('select id,reply_to_id,deleted_at,request_id from guestbook_message where id in (?,?,?,?)', [
      ...importedGuest.values(),
    ])
  assert(importedRows.find((row) => row.id === importedGuest.get(deletedGuest.id)).deleted_at)
  assert.equal(
    importedRows.find((row) => row.id === importedGuest.get(hiddenReply.id)).reply_to_id,
    importedGuest.get(deletedGuest.id),
  )
  assert(importedRows.every((row) => row.request_id === null))
  assert(
    (await ok(`/admin/media/${asset.id}/references`)).items.some(
      (item) => item.url === `/admin/guestbook?focus=${newGuest.id}`,
    ),
  )
  const newId = imported.body.data.result.posts[0].id
  const momentId = imported.body.data.result.moments[0].id
  const restoredMoment = await ok(`/admin/moments/${momentId}`)
  assert.equal(restoredMoment.status, 'draft')
  assert.equal(restoredMoment.linkedArticleId, newId)
  assert.equal(restoredMoment.likes, 0)
  assert.equal(restoredMoment.commentCount, 1)
  assert.equal(restoredMoment.comments.length, 2)
  assert.equal(
    restoredMoment.comments.find((comment) => comment.content === '迁入动态隐藏评论').moderationStatus,
    'hidden',
  )
  assert.equal((await request(`/moments/${momentId}`)).status, 404)
  assert.equal((await ok(`/moments/${moment.id}`)).likes, 1)
  assert(
    (await ok(`/admin/media/${asset.id}/references`)).items.some(
      (item) => item.url === `/admin/moments?edit=${momentId}`,
    ),
  )
  assert.equal((await ok(`/admin/posts/${newId}`)).status, 'draft')
  assert.equal((await request(`/posts/${newId}`)).status, 404)
  assert.equal((await ok(`/admin/posts/${original.id}`)).status, 'published')
  assert.equal((await ok('/site')).name, '迁入后的站点资料')
  const refreshedLegacy = await ok(`/admin/backup/imports/${oldPreview.body.data.ticket}/repreview`, 'POST')
  assert.equal((await execute(refreshedLegacy)).status, 201)
  assert.deepEqual((await ok('/admin/gallery/settings')).gear, copied.gallerySettings.gear)
  const repeat = await execute(planned)
  assert.equal(repeat.body.data.result.posts[0].id, newId)
  assert.equal(repeat.body.data.result.moments[0].id, momentId)
  assert.deepEqual(repeat.body.data.result.gallery, imported.body.data.result.gallery)
  const copiedAgain = await preview(copied)
  assert.equal(copiedAgain.body.data.plan.counts.moments, 0)
  assert.equal(copiedAgain.body.data.plan.counts.guestbook, 0)
  assert.equal(copiedAgain.body.data.plan.counts.gallery, 0)
  const staleGalleryPlan = (await preview(copied, 'copy')).body.data
  await ok(`/admin/gallery/${gallery.id}`, 'PATCH', { revision: gallery.revision, title: '河面上的雾' })
  assert.equal((await execute(staleGalleryPlan)).status, 409)
  const staleGearPlan = (await preview(copied, 'copy', true)).body.data
  await ok('/admin/gallery/settings', 'PATCH', { gear: [], revision: (await ok('/admin/gallery/settings')).revision })
  assert.equal((await execute(staleGearPlan)).status, 409)
  const defaultGearPlan = (await preview(copied, 'skip')).body.data
  assert.equal((await execute(defaultGearPlan)).status, 201)
  assert.deepEqual((await ok('/admin/gallery/settings')).gear, [])
  const messagePackage = structuredClone(bundle)
  messagePackage.posts = []
  messagePackage.flashes = []
  messagePackage.moments = []
  const sourceGuest = messagePackage.guestbook.find((item) => item.sourceId === guest.id)
  messagePackage.guestbook = [
    sourceGuest,
    { ...sourceGuest, sourceId: 10001, content: '新答复映射到已有父留言', replyToId: guest.id },
  ]
  const mixed = (await preview(messagePackage)).body.data
  assert.equal(mixed.plan.guestbook[0].targetId, guest.id)
  const mixedResult = (await execute(mixed)).body.data.result.guestbook
  assert.equal(mixedResult.length, 1)
  assert.equal((await ok(`/admin/guestbook/${mixedResult[0].id}`)).replyTo.id, guest.id)
  messagePackage.guestbook = [
    { ...sourceGuest, sourceId: 11000, content: '同包重复父项' },
    { ...sourceGuest, sourceId: 11001, content: '同包重复父项' },
    { ...sourceGuest, sourceId: 11002, content: '编号不同但引用相同', replyToId: 11001 },
  ]
  const duplicatePlan = (await preview(messagePackage)).body.data
  assert.equal(duplicatePlan.plan.counts.guestbook, 2)
  const duplicateResult = (await execute(duplicatePlan)).body.data.result.guestbook
  const duplicateParent = duplicateResult.find((item) => item.sourceId === 11000).id
  const duplicateReply = duplicateResult.find((item) => item.sourceId === 11002).id
  assert.equal((await ok(`/admin/guestbook/${duplicateReply}`)).replyTo.id, duplicateParent)
  const staleGuestPlan = (await preview(messagePackage, 'copy')).body.data
  const guestRevision = (await ok(`/admin/guestbook/${guest.id}`)).revision
  await ok(`/admin/guestbook/${guest.id}`, 'PATCH', { status: 'hidden', revision: guestRevision })
  assert.equal((await execute(staleGuestPlan)).status, 409)
  await ok(`/admin/guestbook/${guest.id}`, 'PATCH', { status: 'published', revision: guestRevision + 1 })
  assert.equal((await ok(`/admin/comments?postId=${newId}`)).total, 2)
  const importedComments = await ok(`/admin/comments?postId=${newId}`)
  const root = importedComments.items.find((item) => item.parentId === null)
  assert.equal((await ok(`/admin/comments/${root.id}/context`)).deleteTotal, 2)
  const beforeCount = (await ok('/admin/overview')).counts.posts
  const broken = structuredClone(copied)
  const brokenMedia = randomUUID()
  broken.media[0].id = brokenMedia
  broken.posts[0].values.cover = `/api/v1/media/${brokenMedia}.webp`
  broken.posts[0].values.title = '导入回滚证明'
  const brokenPlan = (await preview(broken, 'copy')).body.data
  const em = fixture.testOrm.em.fork()
  await em.execute(
    "create function fail_import_test() returns trigger language plpgsql as $$ begin if new.title='导入回滚证明' then raise exception 'isolated import failure'; end if; return new; end $$",
  )
  await em.execute('create trigger fail_import before insert on post for each row execute function fail_import_test()')
  assert.equal((await execute(brokenPlan)).status, 503)
  assert.equal((await ok('/admin/overview')).counts.posts, beforeCount)
  assert.equal(
    (await em.execute('select count(*)::int as count from media_asset where id=?', [brokenMedia]))[0].count,
    0,
  )
  assert(!existsSync(join(process.env.MEDIA_DIRECTORY, `${brokenMedia}.webp`)))
  await em.execute('drop trigger fail_import on post')
  await em.execute('drop function fail_import_test()')
  await ok('/admin/posts', 'POST', { title: '预览后的其他修改', contentRaw: '新草稿' })
  const refreshed = await ok(`/admin/backup/imports/${brokenPlan.ticket}/repreview`, 'POST')
  assert.notEqual(refreshed.confirmation, brokenPlan.confirmation)
  assert.equal((await execute(refreshed, brokenPlan.confirmation)).status, 409)
  assert.equal((await execute(refreshed)).status, 201)
  const galleryRollback = structuredClone(copied)
  const rollbackMedia = randomUUID()
  galleryRollback.media[0].id = rollbackMedia
  galleryRollback.gallery[0].values.mediaId = rollbackMedia
  galleryRollback.gallery[0].values.title = '图库导入回滚证明'
  const galleryRollbackPlan = (await preview(galleryRollback, 'copy')).body.data
  const beforeRollback = await em.execute(
    'select (select count(*) from gallery_photo)::int as gallery, (select count(*) from post)::int as posts, (select count(*) from guestbook_message)::int as guestbook, (select count(*) from media_reference)::int as refs',
  )
  await em.execute(
    "create function fail_gallery_import_test() returns trigger language plpgsql as $$ begin if new.title='图库导入回滚证明' then raise exception 'isolated gallery import failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger fail_gallery_import before insert on gallery_photo for each row execute function fail_gallery_import_test()',
  )
  assert.equal((await execute(galleryRollbackPlan)).status, 503)
  assert.deepEqual(
    await em.execute(
      'select (select count(*) from gallery_photo)::int as gallery, (select count(*) from post)::int as posts, (select count(*) from guestbook_message)::int as guestbook, (select count(*) from media_reference)::int as refs',
    ),
    beforeRollback,
  )
  assert.equal(
    (await em.execute('select count(*)::int as count from media_asset where id=?', [rollbackMedia]))[0].count,
    0,
  )
  assert(!existsSync(join(process.env.MEDIA_DIRECTORY, `${rollbackMedia}.webp`)))
  assert.equal((await ok(`/admin/backup/imports/${galleryRollbackPlan.ticket}`)).completed, false)
  await em.execute('drop trigger fail_gallery_import on gallery_photo')
  await em.execute('drop function fail_gallery_import_test()')
  assert.equal((await request('/admin/maintenance/diagnostics', 'GET', undefined, '')).status, 401)
  const diagnostics = await ok('/admin/maintenance/diagnostics')
  assert.equal(diagnostics.schemaDrift, false)
  assert.equal(diagnostics.pendingMigrations, 0)
  assert.deepEqual(diagnostics.storage, { readable: true, writable: true, cleaned: true })
  const checked = await ok('/admin/maintenance/media-check', 'POST')
  assert.equal(checked.problems.length, 0)
  assert.equal(checked.checked, 3)
  const oldContext = (await request('/site')).headers.get('x-content-context')
  assert(oldContext)
  const nextContext = randomUUID()
  await em.execute('update content_context set generation=?,require_context=true', [nextContext])
  assert.equal(
    (await request('/admin/posts', 'POST', { title: '拒绝旧页面', contentRaw: '' }, token, oldContext)).status,
    409,
  )
  assert.equal((await request('/admin/posts', 'POST', { title: '拒绝缺少上下文', contentRaw: '' })).status, 428)
  assert.equal(
    (
      await request(
        `/admin/gallery/${gallery.id}`,
        'PATCH',
        { title: '拒绝旧图库编辑', revision: gallery.revision + 1 },
        token,
        oldContext,
      )
    ).status,
    409,
  )
  assert.equal(
    (await request('/admin/gallery', 'POST', { title: '拒绝旧图库创建', mediaId: asset.id, requestId: randomUUID() }))
      .status,
    428,
  )
  const guestBody = { content: '旧页面不能提交留言', author: '小林', requestId: randomUUID() }
  assert.equal((await request('/guestbook', 'POST', guestBody, '', oldContext)).status, 409)
  assert.equal((await request('/guestbook', 'POST', guestBody, '')).status, 428)
  assert.equal(
    (await request(`/guestbook/${guest.id}/reactions`, 'PUT', { emoji: '👍', reacted: false }, '', oldContext)).status,
    409,
  )
  assert.equal((await request('/guestbook', 'POST', guestBody, '', nextContext)).status, 201)
  assert.equal(
    (await request('/admin/posts', 'POST', { title: '重新读取后允许创建', contentRaw: '' }, token, nextContext)).status,
    201,
  )
  process.stdout.write(
    '内容包集成通过：真实导出、媒体/引用/格式校验、去重与新草稿、评论关系、配置迁入、幂等结果、故障回滚、预览变更确认与旧页面恢复保护\n',
  )
} finally {
  await fixture.close()
}
