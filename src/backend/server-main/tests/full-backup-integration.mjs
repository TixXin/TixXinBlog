/**
 * @file full-backup-integration.mjs
 * @description 隔离数据的一致快照、并发写入、校验拒绝及无网络容器完整恢复演练。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
import {
  backendRoot,
  createFullBackup,
  verifyFullBackup,
  restoreFullBackup,
  verifyRestoredApplication,
} from '../scripts/full-backup.mjs'
const { submissionHash } = createRequire(import.meta.url)('../dist/modules/moment/moment-values.js')

const fixture = await createBrowserTestApp('http://localhost')
const verificationRoot = resolve(backendRoot, '../../..', '.artifacts', 'backup-restore')
const target = resolve(verificationRoot, `verification-${randomUUID()}`)
if (!target.startsWith(verificationRoot + sep)) throw new Error('恢复演练产物路径越界')
let restored
try {
  const login = await fetch(`${fixture.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  const token = (await login.json()).data.accessToken
  const image = new FormData()
  image.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'restore-example.png',
  )
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: image,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  async function createPost(title) {
    const response = await fetch(`${fixture.origin}/api/v1/admin/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, contentRaw: `![恢复图片](${asset.url})`, status: 'published' }),
    })
    assert.equal(response.status, 201)
    return (await response.json()).data
  }
  const sourcePost = await createPost('完整恢复校验文章')
  const commented = await fetch(`${fixture.origin}/api/v1/posts/${sourcePost.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-verification' },
    body: JSON.stringify({ author: '恢复访客', content: '恢复评论内容', avatar: asset.url }),
  })
  assert.equal(commented.status, 201)
  const flash = await fetch(`${fixture.origin}/api/v1/admin/flashes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '恢复闪念内容', images: [asset.url], isDraft: true }),
  })
  assert.equal(flash.status, 201)
  const momentRequestId = randomUUID()
  const momentResponse = await fetch(`${fixture.origin}/api/v1/admin/moments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '完整恢复朋友圈',
      images: [asset.url],
      linkedArticleId: sourcePost.id,
      status: 'published',
      requestId: momentRequestId,
    }),
  })
  assert.equal(momentResponse.status, 201)
  const moment = (await momentResponse.json()).data
  const like = await fetch(`${fixture.origin}/api/v1/moments/${moment.id}/like`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-moment-visitor' },
    body: JSON.stringify({ liked: true }),
  })
  assert.equal(like.status, 200)
  const momentComment = await fetch(`${fixture.origin}/api/v1/moments/${moment.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-moment-visitor' },
    body: JSON.stringify({
      content: '完整恢复动态评论',
      author: '恢复访客',
      avatar: asset.url,
      requestId: randomUUID(),
    }),
  })
  assert.equal(momentComment.status, 201)
  const guestResponse = await fetch(`${fixture.origin}/api/v1/guestbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-guestbook-visitor' },
    body: JSON.stringify({ content: '完整恢复留言', author: '小林', avatar: asset.url, requestId: randomUUID() }),
  })
  assert.equal(guestResponse.status, 201)
  const guest = (await guestResponse.json()).data
  const guestReply = await fetch(`${fixture.origin}/api/v1/admin/guestbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: '完整恢复博主答复', replyToId: guest.id, requestId: randomUUID() }),
  })
  assert.equal(guestReply.status, 201)
  const reaction = await fetch(`${fixture.origin}/api/v1/guestbook/${guest.id}/reactions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'restore-guestbook-visitor' },
    body: JSON.stringify({ emoji: '👍', reacted: true }),
  })
  assert.equal(reaction.status, 200)
  await delay(1100)
  const photoRequestId = randomUUID()
  const galleryResponse = await fetch(`${fixture.origin}/api/v1/admin/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      requestId: photoRequestId,
      mediaId: asset.id,
      title: '清晨的石桥',
      description: '完整保留的作品说明',
      category: '城市',
      takenOn: '2019-10-08',
      location: '',
      device: '',
      status: 'published',
      sortOrder: 10,
    }),
  })
  assert.equal(galleryResponse.status, 201)
  const photo = (await galleryResponse.json()).data
  const sourceSite = await fetch(`${fixture.origin}/api/v1/site`)
  const oldContext = sourceSite.headers.get('x-content-context')
  assert(oldContext, '恢复前必须从站点配置读取真实内容上下文')
  const settingsResponse = await fetch(`${fixture.origin}/api/v1/admin/gallery/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      revision: 0,
      gear: [{ icon: 'lucide:camera', name: '随行相机', description: '工作室器材记录' }],
    }),
  })
  assert.equal(settingsResponse.status, 200)
  const ledgerEm = fixture.testOrm.em.fork()
  const [photoRow] = await ledgerEm.execute('select * from gallery_photo where id=?', [photo.id])
  await ledgerEm.execute(
    'insert into development_fixture (key,dataset,kind,resource_id,snapshot_hash,created_at) values (?,?,?,?,?,now())',
    [
      'gallery-restore:photo',
      'gallery-restore-v1',
      'gallery',
      String(photo.id),
      submissionHash(Object.fromEntries(Object.entries(photoRow).filter(([key]) => key !== 'updated_at'))),
    ],
  )
  assert.equal(photoRow.request_id, photoRequestId)
  await delay(1100)
  const restoredProjects = []
  for (const values of [
    {
      title: '资料整理台',
      description: '保留已归档但仍公开的项目。'.padEnd(5000, '。'),
      coverMediaId: asset.id,
      progress: 'archived',
      status: 'published',
      sortOrder: 17,
      tags: [
        { label: 'TypeScript', color: 'blue' },
        { label: 'Vue', color: 'emerald' },
      ],
      links: [
        { kind: 'source', href: 'https://github.com/vuejs/core' },
        { kind: 'docs', href: 'https://vuejs.org/Guide/?tag=A&tag=B&q='.padEnd(2048, 'x') },
      ],
    },
    {
      title: '纸上记录',
      description: '',
      coverMediaId: null,
      progress: 'dev',
      status: 'draft',
      sortOrder: 0,
      tags: [],
      links: [],
    },
    {
      title: '一段路程',
      description: '暂时收起的作品。',
      coverMediaId: asset.id,
      progress: 'active',
      status: 'withdrawn',
      sortOrder: -3,
      tags: [{ label: 'Node.js', color: 'emerald' }],
      links: [],
    },
    {
      title: '已收起的计划',
      description: '',
      coverMediaId: asset.id,
      progress: 'dev',
      status: 'draft',
      sortOrder: 0,
      tags: [],
      links: [],
    },
  ]) {
    const requestId = randomUUID()
    const response = await fetch(`${fixture.origin}/api/v1/admin/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...values, requestId }),
    })
    assert.equal(response.status, 201)
    const project = (await response.json()).data
    if (values.title === '已收起的计划') {
      const removed = await fetch(
        `${fixture.origin}/api/v1/admin/projects/${project.id}?revision=${project.revision}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      )
      assert.equal(removed.status, 200)
    }
    const [row] = await ledgerEm.execute('select * from project where id=?', [project.id])
    assert.equal(row.request_id, requestId)
    await ledgerEm.execute(
      'insert into development_fixture (key,dataset,kind,resource_id,snapshot_hash,created_at) values (?,?,?,?,?,now())',
      [
        `project-restore:${project.id}`,
        'project-restore-v1',
        'project',
        String(project.id),
        submissionHash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at'))),
      ],
    )
    restoredProjects.push(project)
  }
  assert.equal(restoredProjects.length, 4)
  await delay(1100)
  const restoredLinks = []
  for (const values of [
    {
      name: '山间札记'.padEnd(80, '记'),
      description: '记录真实的写作与分享。'.padEnd(300, '。'),
      url: 'https://example.com/Docs/Guide?tag=A&tag=B&signature=AbC&q='.padEnd(2040, 'x') + '#Section',
      logoMediaId: asset.id,
      logoUrl: null,
      status: 'published',
      isFeatured: true,
      sortOrder: 17,
    },
    {
      name: '纸上花园',
      description: '',
      url: 'https://example.org/Notes?tag=A&tag=B#Intro',
      logoMediaId: null,
      logoUrl: 'https://assets.example.org/Logo.PNG?version=A&version=B&q='.padEnd(2048, 'x'),
      status: 'draft',
      isFeatured: false,
      sortOrder: 0,
    },
    {
      name: '一段旅途',
      description: '暂时收起的友链。',
      url: 'https://example.net/Notes/',
      logoMediaId: asset.id,
      logoUrl: null,
      status: 'withdrawn',
      isFeatured: true,
      sortOrder: -3,
    },
    {
      name: '已收起的书页',
      description: '',
      url: 'https://example.org/closed',
      logoMediaId: asset.id,
      logoUrl: null,
      status: 'draft',
      isFeatured: false,
      sortOrder: 0,
    },
    {
      name: '留白之间',
      description: '不用图标也能认真表达。',
      url: 'https://plain.example/Notes',
      logoMediaId: null,
      logoUrl: null,
      status: 'published',
      isFeatured: false,
      sortOrder: 0,
    },
  ]) {
    const requestId = randomUUID()
    const response = await fetch(`${fixture.origin}/api/v1/admin/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...values, requestId }),
    })
    assert.equal(response.status, 201)
    const link = (await response.json()).data
    if (values.name === '已收起的书页') {
      const removed = await fetch(`${fixture.origin}/api/v1/admin/links/${link.id}?revision=${link.revision}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(removed.status, 200)
    }
    const [row] = await ledgerEm.execute('select * from friend_link where id=?', [link.id])
    assert.equal(row.request_id, requestId)
    await ledgerEm.execute(
      'insert into development_fixture (key,dataset,kind,resource_id,snapshot_hash,created_at) values (?,?,?,?,?,now())',
      [
        `link-restore:${link.id}`,
        'link-restore-v1',
        'link',
        String(link.id),
        submissionHash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at'))),
      ],
    )
    restoredLinks.push(link)
  }
  await delay(1100)
  const linkRules = ['友链由博主维护，不自动申请或抓取站点。', '保留清楚的站点介绍。'.padEnd(300, '。')]
  const rulesResponse = await fetch(`${fixture.origin}/api/v1/admin/links/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ revision: 0, rules: linkRules }),
  })
  assert.equal(rulesResponse.status, 200)
  // 使用真实内容包复制制造同址草稿，完整备份必须同时保留原公开友链和不可见副本。
  const linkExport = await fetch(`${fixture.origin}/api/v1/admin/backup/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mediaIncluded: false }),
  })
  assert.equal(linkExport.status, 201)
  const copyBundle = await linkExport.json()
  for (const field of ['posts', 'flashes', 'moments', 'guestbook', 'gallery', 'projects']) copyBundle[field] = []
  copyBundle.links = copyBundle.links.filter((link) => link.sourceId === restoredLinks[0].id)
  const copyForm = new FormData()
  copyForm.append('file', new Blob([JSON.stringify(copyBundle)], { type: 'application/json' }), 'same-address.json')
  copyForm.append('requestId', randomUUID())
  copyForm.append('strategy', 'copy')
  copyForm.append('includeSettings', 'false')
  const copyPreview = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: copyForm,
  })
  assert.equal(copyPreview.status, 201)
  const copyPlan = (await copyPreview.json()).data
  assert.equal(copyPlan.plan.counts.links, 1)
  const copied = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/${copyPlan.ticket}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ acknowledgement: '导入为新草稿', confirmation: copyPlan.confirmation }),
  })
  assert.equal(copied.status, 201)
  const copiedId = (await copied.json()).data.result.links[0].id
  const [copiedRow] = await ledgerEm.execute('select * from friend_link where id=?', [copiedId])
  assert.equal(copiedRow.status, 'draft')
  assert.equal(copiedRow.url, restoredLinks[0].url)
  assert.equal(copiedRow.request_id, null)
  await ledgerEm.execute(
    'insert into development_fixture (key,dataset,kind,resource_id,snapshot_hash,created_at) values (?,?,?,?,?,now())',
    [
      `link-restore:${copiedId}`,
      'link-restore-v1',
      'link',
      String(copiedId),
      submissionHash(Object.fromEntries(Object.entries(copiedRow).filter(([key]) => key !== 'updated_at'))),
    ],
  )
  const backup = await createFullBackup({
    output: join(target, 'backup'),
    onProgress: (value) => process.stdout.write(`备份阶段：${value.stage}\n`),
    onSnapshot: async () => {
      await createPost('快照之后的新文章')
    },
  })
  assert.equal(backup.manifest.counts.post, 107)
  assert.equal(backup.manifest.counts.moment, 1)
  assert.equal(backup.manifest.counts.moment_comment, 1)
  assert.equal(backup.manifest.counts.moment_like, 1)
  assert.equal(backup.manifest.counts.guestbook_message, 2)
  assert.equal(backup.manifest.counts.guestbook_reaction, 1)
  assert.equal(backup.manifest.counts.gallery_photo, 1)
  assert.equal(backup.manifest.counts.gallery_settings, 1)
  assert.equal(backup.manifest.counts.project, 4)
  assert.equal(backup.manifest.counts.friend_link, 6)
  assert.equal(backup.manifest.counts.link_settings, 1)
  assert.equal(backup.manifest.counts.development_fixture, 11)
  assert.equal(backup.manifest.counts.media_reference, 13)
  assert.equal(
    Number((await fixture.testOrm.em.fork().execute('select count(*)::int as count from post'))[0].count),
    108,
  )
  assert.equal(backup.manifest.media.length, 1)
  await verifyFullBackup(backup.directory)
  const mediaFile = join(backup.directory, 'media', backup.manifest.media[0].key)
  const valid = await readFile(mediaFile)
  await writeFile(mediaFile, Buffer.concat([valid, Buffer.from('tamper')]))
  await assert.rejects(verifyFullBackup(backup.directory), /校验失败/)
  await writeFile(mediaFile, valid)
  restored = await restoreFullBackup(backup.directory, { output: join(target, 'restored') })
  assert.equal(restored.report.counts.post, 107)
  assert.equal(restored.report.counts.moment, 1)
  assert.equal(restored.report.counts.moment_comment, 1)
  assert.equal(restored.report.counts.moment_like, 1)
  assert.equal(restored.report.counts.guestbook_message, 2)
  assert.equal(restored.report.counts.guestbook_reaction, 1)
  assert.equal(restored.report.counts.gallery_photo, 1)
  assert.equal(restored.report.counts.gallery_settings, 1)
  assert.equal(restored.report.counts.project, 4)
  assert.equal(restored.report.counts.friend_link, 6)
  assert.equal(restored.report.counts.link_settings, 1)
  assert.equal(restored.report.counts.development_fixture, 11)
  assert.deepEqual(restored.report.linkIntegrity, {
    links: 6,
    settings: 1,
    managedLogos: 4,
    externalLogos: 1,
    mediaReferences: 3,
    fixtures: 6,
    verified: true,
  })
  assert.deepEqual(restored.report.projectIntegrity, {
    projects: 4,
    withCover: 3,
    mediaReferences: 2,
    fixtures: 4,
    verified: true,
  })
  assert.deepEqual(restored.report.galleryIntegrity, {
    photos: 1,
    settings: 1,
    mediaReferences: 1,
    fixtures: 1,
    verified: true,
  })
  assert.equal(restored.report.mediaFiles, 1)
  assert.equal(restored.report.rowDigestsVerified, true)
  assert.equal(restored.report.network, 'none')
  assert.equal(restored.report.revokedRestoredSessions, true)
  assert.equal(restored.report.requireFreshContentContext, true)
  const application = process.env.RESTORE_API_IMAGE
    ? await verifyRestoredApplication(restored, process.env.RESTORE_API_IMAGE, process.env.JWT_ACCESS_SECRET, token, {
        username: fixture.username,
        password: fixture.password,
        oldContext,
      })
    : undefined
  if (application) {
    assert.equal(application.publicGalleryPhotos, 1)
    assert.equal(application.galleryGearVerified, true)
    assert.equal(application.freshLoginVerified, true)
    assert.equal(application.galleryAdminVerified, true)
    assert.equal(application.galleryOldContextRejected, true)
    assert.equal(application.galleryFreshWriteAllowed, true)
    assert.equal(application.publicProjects, 1)
    assert.equal(application.projectMetadataVerified, true)
    assert.equal(application.projectAdminVerified, true)
    assert.equal(application.projectOldContextRejected, true)
    assert.equal(application.projectFreshWriteAllowed, true)
    assert.equal(application.publicLinks, 2)
    assert.equal(application.linkMetadataVerified, true)
    assert.equal(application.linkAdminVerified, true)
    assert.equal(application.linkOldContextRejected, true)
    assert.equal(application.linkFreshWriteAllowed, true)
  }
  const report = {
    ...restored.report,
    application,
    isolatedResourcesRemoved: true,
    backupAndRestoredMediaRemoved: true,
    verification: [
      '并发写入不进入既有快照',
      '数据库全部表行数与内容摘要一致',
      '媒体字节校验一致',
      '篡改文件拒绝恢复',
      '恢复不影响源库',
      '旧会话撤销与上下文轮换',
      '朋友圈正文、文章关系、评论、点赞及提交去重记录完整恢复',
      '留言、回复关系、回应、媒体引用及提交去重记录完整恢复',
      '图库作品、拍摄时间、器材配置、媒体关联、提交去重及样本归属账本完整恢复',
      '项目进展、发布与删除状态、标签和链接、可选封面、提交去重及归属账本完整恢复',
      '友链URL语义、同址草稿副本、规则、推荐与状态、媒体/外部Logo、提交去重及归属账本完整恢复',
    ],
  }
  await restored.cleanup()
  restored = null
  await rm(join(target, 'backup'), { recursive: true, force: true })
  await rm(join(target, 'restored'), { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await writeFile(join(target, 'verification-report.json'), JSON.stringify(report, null, 2))
  process.stdout.write(`完整恢复演练通过：${join(target, 'verification-report.json')}\n`)
} finally {
  await restored?.cleanup()
  await fixture.close()
  // 成功和失败都清理本次专有子目录，仅保留无凭据的文字验收报告。
  await rm(join(target, 'backup'), { recursive: true, force: true })
  await rm(join(target, 'restored'), { recursive: true, force: true })
}
