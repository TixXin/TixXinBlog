/** @file session-ledger.test.mjs @description 多会话台账：认领表解析与改写、通配匹配、归属推断、共享文件识别与重启目标挑选 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendClaim,
  claimOwners,
  expandBraces,
  finishClaims,
  globToRegExp,
  inferOwner,
  isSharedFile,
  parseClaims,
} from './session-ledger.mjs'
import { findOwnedSession, isWorkspaceSupervisor } from './restart.mjs'

const board = `# 多代理协作看板

## 认领表

| 任务 | 负责人 | 状态 | 会改的文件/目录 |
| --- | --- | --- | --- |
| 旧任务 | Gemini（agy） | 已合入 abc123 | \`src/backend/server-main/src/modules/backup/**\` |
| 后台 UI | 主会话 | 进行中（2026-11-06） | \`app/pages/admin/**\`、\`app/components/admin/{Moment,Guestbook}*.vue\`、\`i18n/locales/*/admin-*.json\` |
| 订阅 | 订阅会话 | 进行中 | \`src/shared/subscription-domain/\`、\`CHANGELOG.md\` |

## 交接与请求
`

test('只解析认领表的数据行，区分进行中与已完成', () => {
  const claims = parseClaims(board)
  assert.deepEqual(
    claims.map(({ owner, active, paths }) => [owner, active, paths.length]),
    [
      ['Gemini（agy）', false, 1],
      ['主会话', true, 3],
      ['订阅会话', true, 2],
    ],
  )
})

test('通配支持 **、*、花括号与目录，并允许相对子项目的写法匹配完整路径', () => {
  assert.deepEqual(expandBraces('a/{b,c}/d{1,2}'), ['a/b/d1', 'a/b/d2', 'a/c/d1', 'a/c/d2'])
  assert.equal(globToRegExp('app/pages/admin/**').test('src/frontend/web-blog/app/pages/admin/posts/index.vue'), true)
  assert.equal(
    globToRegExp('i18n/locales/*/admin-*.json').test('src/frontend/web-blog/i18n/locales/zh-CN/admin-system.json'),
    true,
  )
  assert.equal(
    globToRegExp('i18n/locales/*/admin-*.json').test('src/frontend/web-blog/i18n/locales/zh-CN/misc.json'),
    false,
  )
  assert.equal(
    globToRegExp('src/shared/subscription-domain/').test('src/shared/subscription-domain/spending.cjs'),
    true,
  )
  assert.equal(globToRegExp('scripts/dev').test('scripts/dev/session.mjs'), true)
  assert.equal(globToRegExp('CHANGELOG.md').test('docs/CHANGELOG.md.bak'), false)
})

test('文件归属只看进行中的认领，多人认领时无法唯一推断', () => {
  const claims = parseClaims(board)
  assert.deepEqual(claimOwners('src/frontend/web-blog/app/components/admin/MomentListItem.vue', claims), ['主会话'])
  assert.deepEqual(claimOwners('src/backend/server-main/src/modules/backup/content-package.ts', claims), [])
  assert.equal(inferOwner(['src/shared/subscription-domain/dates.cjs', 'CHANGELOG.md'], claims), '订阅会话')
  assert.equal(inferOwner(['CHANGELOG.md', 'src/frontend/web-blog/app/pages/admin/index.vue'], claims), null)
  assert.equal(inferOwner(['README.md'], claims), null)
})

test('追加认领与结束认领只改认领表，不动其他段落', () => {
  const added = appendClaim(board, {
    task: '多会话工具 | 脚本',
    owner: 'rss-release',
    paths: ['scripts/dev/**'],
    date: '2026-11-06',
  })
  const claims = parseClaims(added)
  assert.deepEqual(claims.at(-1), {
    index: claims.at(-1).index,
    task: '多会话工具 ／ 脚本',
    owner: 'rss-release',
    status: '进行中（2026-11-06）',
    paths: ['scripts/dev/**'],
    active: true,
  })
  assert.match(added, /\n\n## 交接与请求\n/)
  const finished = finishClaims(added, { owner: 'rss-release', result: '已完成（2026-11-06）：abc' })
  assert.equal(finished.changed, 1)
  assert.equal(parseClaims(finished.markdown).at(-1).active, false)
  assert.equal(finishClaims(added, { owner: '主会话', task: '不存在' }).changed, 0)
})

test('共享文件覆盖语言包、清单、更新日志与文档', () => {
  for (const file of [
    'src/frontend/web-blog/i18n/locales/en/admin-media.json',
    'package.json',
    'CHANGELOG.md',
    'docs/api.md',
  ])
    assert.equal(isSharedFile(file), true, file)
  assert.equal(isSharedFile('src/frontend/web-blog/app/pages/links.vue'), false)
})

test('重启只挑本仓库 dev.mjs 启动、模式一致的最新记录', () => {
  const workspace = '/Users/x/TixXinBlog'
  assert.equal(isWorkspaceSupervisor(`/bin/node ${workspace}/scripts/dev.mjs web --logs`, workspace), true)
  assert.equal(isWorkspaceSupervisor('/bin/node /Users/x/Other/scripts/dev.mjs web --logs', workspace), false)
  assert.equal(isWorkspaceSupervisor(`/bin/node ${workspace}/scripts/dev.mjs check`, workspace), false)
  const sessions = [
    { pid: 1, mode: 'web', startedAt: 10 },
    { pid: 2, mode: 'web', startedAt: 20 },
    { pid: 3, mode: 'api', startedAt: 30 },
  ]
  assert.equal(findOwnedSession(sessions, 'web', () => true).pid, 2)
  assert.equal(findOwnedSession(sessions, 'web', (pid) => pid === 1).pid, 1)
  assert.equal(
    findOwnedSession(sessions, 'web', () => false),
    undefined,
  )
})
