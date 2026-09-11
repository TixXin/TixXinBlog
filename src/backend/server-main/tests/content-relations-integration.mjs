/** @file content-relations-integration.mjs @description 隔离验证三域关联保存、历史、公开投影、失效目标与媒体引用不串扰。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  const session = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  const token = (await session.json()).data.accessToken
  async function request(path, method = 'GET', body, admin = true) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: {
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(admin ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      })
      const value = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      return { status: response.status, body: value }
    }
  }
  async function ok(path, method = 'GET', body, admin = true) {
    const result = await request(path, method, body, admin)
    assert(result.status < 300, `${path}: ${result.status} ${JSON.stringify(result.body)}`)
    return result.body.data
  }
  const em = fixture.testOrm.em.fork()
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  assert.equal((await request('/admin/content-relations?type=post', 'GET', undefined, false)).status, 401)
  assert.equal((await request('/admin/content-relations/resolve', 'POST', { relatedContent: [] }, false)).status, 401)
  const upload = new FormData()
  upload.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'relation.png')
  const media = await ok('/admin/media', 'POST', upload)
  let project = await ok('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '未公开项目名称',
    coverMediaId: media.id,
    status: 'draft',
  })
  let gallery = await ok('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    title: '影像笔记',
    mediaId: media.id,
    status: 'published',
  })
  const target = await ok('/admin/posts', 'POST', {
    title: '公开开发记录',
    slug: 'related-development',
    contentRaw: '正文',
    status: 'published',
  })
  let post = await ok('/admin/posts', 'POST', {
    title: '阅读入口',
    contentRaw: '正文',
    cover: media.url,
    status: 'published',
  })
  async function savePost(patch, omitRelations = false) {
    const { id, savedAt, deletedAt, ...body } = await ok(`/admin/posts/${post.id}`)
    if (omitRelations) delete body.relatedContent
    return ok(`/admin/posts/${id}`, 'PATCH', { ...body, ...patch })
  }
  const references = () =>
    em.execute(
      "select source_key,asset_id,kind from media_reference where kind in ('post','project','gallery') order by source_key,asset_id",
    )
  const beforeReferences = await references()
  const relations = [
    { type: 'project', id: project.id },
    { type: 'gallery', id: gallery.id },
    { type: 'post', id: target.id },
  ]
  post = await savePost({ relatedContent: [...relations, relations[1]] })
  assert.deepEqual(post.relatedContent, relations, '按首次出现顺序去重')
  const snapshotVersion = post.revision
  assert.deepEqual(
    (await ok(`/admin/posts/${post.id}/revisions/${snapshotVersion}`)).snapshot.relatedContent,
    relations,
  )
  const publicPost = await ok(`/posts/${post.id}`, 'GET', undefined, false)
  assert.deepEqual(
    publicPost.relatedContent.map((item) => item.type),
    ['gallery', 'post'],
  )
  assert.equal(publicPost.relatedContent[1].url, '/articles/related-development')
  assert(!JSON.stringify(publicPost).includes('未公开项目名称'))
  assert(!JSON.stringify(publicPost.relatedContent).includes('status'))
  project = await ok(`/admin/projects/${project.id}`, 'PATCH', {
    revision: project.revision,
    status: 'published',
    relatedContent: [{ type: 'post', id: post.id }],
  })
  gallery = await ok(`/admin/gallery/${gallery.id}`, 'PATCH', {
    revision: gallery.revision,
    relatedContent: [
      { type: 'project', id: project.id },
      { type: 'post', id: post.id },
    ],
  })
  assert.equal((await ok(`/projects/${project.id}`, 'GET', undefined, false)).relatedContent[0].id, post.id)
  assert.deepEqual(
    (await ok(`/gallery/${gallery.id}`, 'GET', undefined, false)).relatedContent.map((item) => item.type),
    ['project', 'post'],
  )
  assert.deepEqual(await references(), beforeReferences, '业务关联不会增减当前媒体引用')
  post = await savePost({ title: '修改正文资料保留关联' }, true)
  assert.deepEqual(post.relatedContent, relations)
  project = await ok(`/admin/projects/${project.id}`, 'PATCH', {
    revision: project.revision,
    description: '只更新介绍',
  })
  assert.deepEqual(project.relatedContent, [{ type: 'post', id: post.id }])
  gallery = await ok(`/admin/gallery/${gallery.id}`, 'PATCH', { revision: gallery.revision, description: '只更新说明' })
  assert.equal(gallery.relatedContent.length, 2)
  for (const [path, type, item] of [
    ['posts', 'post', post],
    ['projects', 'project', project],
    ['gallery', 'gallery', gallery],
  ]) {
    const body =
      path === 'posts'
        ? { title: item.title, contentRaw: '正文', revision: item.revision }
        : { revision: item.revision }
    for (const invalid of [
      [{ type, id: item.id }],
      [{ type: 'moment', id: 1 }],
      [{ type: 'post', id: 2147483647 }],
      null,
      Array.from({ length: 13 }, () => ({ type: 'post', id: target.id })),
    ])
      assert.equal(
        (await request(`/admin/${path}/${item.id}`, 'PATCH', { ...body, relatedContent: invalid })).status,
        400,
      )
  }
  const manager = await ok('/admin/content-relations/resolve', 'POST', { relatedContent: relations })
  assert.deepEqual(
    manager.map((item) => item.available),
    [true, true, true],
  )
  const candidates = await ok('/admin/content-relations?type=project&q=' + encodeURIComponent(project.title))
  assert.equal(candidates.items[0].id, project.id)
  project = await ok(`/admin/projects/${project.id}`, 'PATCH', { revision: project.revision, status: 'withdrawn' })
  assert.equal((await ok(`/posts/${post.id}`, 'GET', undefined, false)).relatedContent.length, 2)
  await ok(`/admin/gallery/${gallery.id}?revision=${gallery.revision}`, 'DELETE')
  const resolved = await ok('/admin/content-relations/resolve', 'POST', {
    relatedContent: [...relations, { type: 'gallery', id: 2147483647 }],
  })
  assert.equal(resolved.find((item) => item.type === 'gallery' && item.id === gallery.id).status, 'deleted')
  assert.equal(resolved.at(-1).status, 'missing')
  post = await savePost({ summary: '已删除目标保留为管理标记' })
  assert.deepEqual(post.relatedContent, relations)
  const newPost = await ok('/admin/posts', 'POST', { title: '另一个入口', contentRaw: '正文' })
  assert.equal(
    (
      await request(`/admin/posts/${newPost.id}`, 'PATCH', {
        title: newPost.title,
        revision: newPost.revision,
        relatedContent: [{ type: 'gallery', id: gallery.id }],
      })
    ).status,
    400,
  )
  post = await savePost({ relatedContent: [] })
  assert.deepEqual(post.relatedContent, [])
  post = await ok(`/admin/posts/${post.id}/revisions/${snapshotVersion}/restore`, 'POST', { revision: post.revision })
  assert.deepEqual(post.relatedContent, relations, '可信历史恢复保留如今失效的原关联')
  assert.equal(post.status, 'draft')
  await em.execute("update post_revision set snapshot=snapshot-'relatedContent' where post_id=? and revision=?", [
    post.id,
    snapshotVersion,
  ])
  post = await ok(`/admin/posts/${post.id}/revisions/${snapshotVersion}/restore`, 'POST', { revision: post.revision })
  assert.deepEqual(post.relatedContent, [], '旧快照缺省空关联，不沿用当前关系')
  // 新旧客户端的缺省空数组不能破坏原提交去重。
  const emptyBody = { requestId: randomUUID(), title: '空关联项目' }
  const first = await ok('/admin/projects', 'POST', emptyBody)
  assert.equal((await ok('/admin/projects', 'POST', { ...emptyBody, relatedContent: [] })).id, first.id)
  const emptyGallery = { requestId: randomUUID(), title: '空关联作品', externalUrl: 'https://example.com/empty.jpg' }
  const firstGallery = await ok('/admin/gallery', 'POST', emptyGallery)
  assert.equal((await ok('/admin/gallery', 'POST', { ...emptyGallery, relatedContent: [] })).id, firstGallery.id)
  console.log('结构化关联隔离验证通过：三域保存、权限、顺序、隐私、历史、缺失目标、版本与媒体引用独立。')
} finally {
  await fixture.close()
}
