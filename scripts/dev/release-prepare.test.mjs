/** @file release-prepare.test.mjs @description 发版准备纯逻辑：版本比较、升级说明推导、更新日志改写与“只改版本号”判断 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareVersions,
  mergeFragments,
  releaseChangelog,
  unreleasedBody,
  upgradeNotes,
  versionOnlyChange,
  withUnreleased,
} from './release-prepare.mjs'

const changelog = `# 更新日志

## [未发布]

### 新增

- 新功能

## [0.5.2-beta.7] - 2026-11-06

- 旧条目
`
const facts = {
  version: '0.5.2-beta.8',
  latestStable: '0.5.1',
  migrations: [],
  deployFiles: [],
  contentBefore: 19,
  contentAfter: 19,
}

test('版本比较遵循语义化版本，预发布按段比较数值', () => {
  assert.ok(compareVersions('0.5.2-beta.10', '0.5.2-beta.9') > 0)
  assert.ok(compareVersions('0.5.2', '0.5.2-beta.9') > 0)
  assert.ok(compareVersions('0.5.2-beta.1', '0.5.1') > 0)
  assert.ok(compareVersions('0.5.2-alpha.3', '0.5.2-beta.1') < 0)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.throws(() => compareVersions('v1.0', '1.0.0'))
})

test('没有变化的类别写成陈述，有变化但未写说明的列为错误', () => {
  assert.deepEqual(upgradeNotes(facts, '').notes, [
    '测试版，不标记为最新版本：`install.sh` 与 `tixxin update` 默认仍取 0.5.1，需显式执行 `tixxin update 0.5.2-beta.8`',
    '环境文件与编排不变，不含数据库迁移，内容包仍为 v19',
  ])
  const changed = { ...facts, migrations: ['20261106_x.ts'], deployFiles: ['deploy/tixxin'], contentAfter: 20 }
  assert.equal(upgradeNotes(changed, '').errors.length, 3)
  const written = upgradeNotes(changed, '含一项数据库迁移；编排新增变量；内容包导出升级为 v20')
  assert.deepEqual(written.errors, [])
  assert.equal(written.notes.length, 1)
  assert.equal(upgradeNotes({ ...facts, version: '0.6.0' }, '').notes.length, 1)
})

test('「未发布」改写为版本段落并留下空的「未发布」，已有升级说明时插到最前', () => {
  const out = releaseChangelog(changelog, '0.5.2-beta.8', '2026-11-06', ['甲'])
  assert.match(
    out,
    /## \[未发布\]\n\n## \[0\.5\.2-beta\.8\] - 2026-11-06\n\n### 升级说明\n\n- 甲\n\n### 新增\n\n- 新功能\n\n## \[0\.5\.2-beta\.7\]/,
  )
  assert.equal(unreleasedBody(out).body, '')
  const withNotes = changelog.replace('### 新增', '### 升级说明\n\n- 含一项迁移\n\n### 新增')
  assert.match(
    releaseChangelog(withNotes, '0.5.2-beta.8', '2026-11-06', ['甲']),
    /### 升级说明\n\n- 甲\n- 含一项迁移\n/,
  )
  assert.throws(
    () => releaseChangelog(changelog.replace('- 新功能\n', ''), '0.5.2-beta.8', '2026-11-06', []),
    /没有任何条目/,
  )
})

test('只改了 CHANGELOG 与 version 行才算版本提交', () => {
  const diff =
    '--- a/package.json\n+++ b/package.json\n@@ -3 +3 @@\n-  "version": "0.5.2-beta.7",\n+  "version": "0.5.2-beta.8",\n'
  assert.equal(versionOnlyChange(['CHANGELOG.md', 'package.json'], diff), true)
  assert.equal(versionOnlyChange(['CHANGELOG.md', 'package.json', 'src/a.ts'], diff), false)
  assert.equal(versionOnlyChange(['package.json'], diff + '+    "lint": "x",\n'), false)
  assert.equal(versionOnlyChange([], ''), false)
})

test('更新日志片段按固定小节顺序合进「未发布」，同名小节的条目依次拼接', () => {
  const body = '### 修复\n\n- 已有修复'
  const merged = mergeFragments(body, [
    ['changes/a.md', '### 新增\n\n- 片段甲新增\n\n### 升级说明\n\n- 含一项数据库迁移：新增表'],
    ['changes/b.md', '### 新增\n\n- 片段乙新增\n  续行说明\n\n### 修复\n\n- 片段乙修复'],
  ])
  assert.equal(
    merged,
    '### 升级说明\n\n- 含一项数据库迁移：新增表\n\n### 新增\n\n- 片段甲新增\n- 片段乙新增\n  续行说明\n\n### 修复\n\n- 已有修复\n- 片段乙修复',
  )
  assert.throws(() => mergeFragments('', [['changes/c.md', '- 没有小节标题']]), /changes\/c\.md 的条目必须写在/)
})

test('合并后的正文写回「未发布」，空正文时保持空段落', () => {
  const merged = withUnreleased(changelog, '### 新增\n\n- 新功能\n- 片段新增')
  assert.match(merged, /## \[未发布\]\n\n### 新增\n\n- 新功能\n- 片段新增\n\n## \[0\.5\.2-beta\.7\]/)
  const empty = withUnreleased('# 更新日志\n\n## [未发布]\n\n## [0.1.0] - 2026-01-01\n', '')
  assert.equal(empty, '# 更新日志\n\n## [未发布]\n\n## [0.1.0] - 2026-01-01\n')
})

test('版本提交删除的片段文件不影响“只改版本号”判断', () => {
  const diff = '-  "version": "0.5.2-beta.8",\n+  "version": "0.5.2-beta.9",'
  assert.equal(versionOnlyChange(['CHANGELOG.md', 'package.json', 'changes/rss.md'], diff), true)
  assert.equal(versionOnlyChange(['CHANGELOG.md', 'scripts/x.mjs'], diff), false)
})
