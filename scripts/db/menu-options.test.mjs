/** @file menu-options.test.mjs @description 数据菜单的参数、备份路由与不可变性回归，只检查纯命令描述 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commandFor, describe, findEntry, withConfirmation, ENTRIES, GROUPS } from './menu.mjs'

test('菜单分组保持展示顺序，每个唯一条目都能按完整标识查到', () => {
  assert.deepEqual(GROUPS, ['查看', '补充样本', '清理', '重建', '容量数据', '账号与配置', '备份'])
  assert.equal(new Set(ENTRIES.map((entry) => entry.id)).size, ENTRIES.length)
  for (const entry of ENTRIES) {
    assert.equal(findEntry(entry.id), entry)
    assert(GROUPS.includes(entry.group))
  }
  for (const group of GROUPS) assert(ENTRIES.some((entry) => entry.group === group))
})

test('条目查找拒绝近似标识，并在错误中提供完整可用目录', () => {
  const available = ENTRIES.map((entry) => entry.id).join('、')
  for (const id of ['STATUS', ' status ', 'backup', '']) {
    assert.throws(() => findEntry(id), {
      message: `未知的数据管理条目：${id}；可用：${available}`,
    })
  }
})

test('全部必填参数拒绝非字符串与纯空白，不产生半成品命令', () => {
  const required = [
    ['check-domain', 'domain'],
    ['seed-dataset', 'dataset'],
    ['remove-dataset', 'dataset'],
    ['volume-seed', 'scale'],
    ['backup-verify', 'directory'],
  ]
  for (const [id, name] of required) {
    for (const value of [undefined, null, false, 1, [], {}, '\t\n ']) {
      assert.throws(() => commandFor(id, { [name]: value }), {
        message: `条目 ${id} 需要提供 ${name}`,
      })
    }
  }
})

test('可选搜索词的空值不生成参数，含空格和 shell 字符的内容按单个参数保留', () => {
  for (const search of [undefined, '']) {
    assert.deepEqual(commandFor('check-domain', { domain: 'posts', search }).args, ['check-data', '--domain', 'posts'])
  }
  const search = ' 中文搜索 \' " $(literal) `literal` ; & | '
  const options = Object.freeze({ domain: 'posts', search })
  assert.deepEqual(commandFor('check-domain', options).args, ['check-data', '--domain', 'posts', '--search', search])
  assert.deepEqual(options, { domain: 'posts', search })
})

test('创建与校验备份使用精确脚本和独立参数，不接受数据库写入确认', () => {
  const directory = '.artifacts/backup/2026-10-18'
  const commands = [
    { id: 'backup-create', script: 'backup:full', args: [], write: false, danger: false },
    {
      id: 'backup-verify',
      script: 'backup:verify',
      args: ['--directory', directory],
      write: false,
      danger: false,
    },
  ]
  for (const expected of commands) {
    const command = commandFor(expected.id, expected.id === 'backup-verify' ? { directory } : {})
    assert.deepEqual(command, expected)
    assert.throws(() => withConfirmation(command, 'tixxinblog_dev'), {
      message: `条目 ${expected.id} 是只读命令，不需要确认参数`,
    })
    assert.deepEqual(command, expected)
  }
  assert.equal(describe(commands[0]), 'corepack pnpm --filter server-main run backup:full')
  assert.equal(
    describe(commands[1]),
    'corepack pnpm --filter server-main run backup:verify --directory .artifacts/backup/2026-10-18',
  )
})

test('备份目录保留空格、中文和特殊字符，菜单不替换路径或添加确认参数', () => {
  const directory = './备份目录/ 归档 \' " $(literal) `literal` ; & | '
  const options = Object.freeze({ directory })
  const command = commandFor('backup-verify', options)
  assert.deepEqual(command.args, ['--directory', directory])
  assert.deepEqual(options, { directory })
  for (const [id, values] of [
    ['backup-create', { directory }],
    ['backup-verify', { directory, output: './其他目录' }],
    ['backup-verify', { directory, apply: true }],
    ['backup-verify', { directory, confirm: 'tixxinblog_dev' }],
  ]) {
    const extra = Object.keys(values).find((name) => id === 'backup-create' || name !== 'directory')
    assert.throws(() => commandFor(id, values), { message: `条目 ${id} 不接受 ${extra}` })
  }
})

test('命令参数每次独立生成，修改一次预览不会污染目录或后续预览', () => {
  const cases = [
    ['seed-all', {}],
    ['check-domain', { domain: 'posts', search: '近期文章' }],
    ['backup-create', {}],
    ['backup-verify', { directory: './归档' }],
  ]
  for (const [id, options] of cases) {
    const original = commandFor(id, options)
    const changed = commandFor(id, options)
    assert.notEqual(changed, original)
    assert.notEqual(changed.args, original.args)
    changed.args.push('--apply')
    assert.deepEqual(commandFor(id, options), original)
  }
})

test('确认返回新命令并去除数据库名两端空白，保留原预览和危险标记', () => {
  const preview = commandFor('clear-content')
  Object.freeze(preview.args)
  Object.freeze(preview)
  const confirmed = withConfirmation(preview, ' \t tixxinblog_dev \n')
  assert.deepEqual(confirmed, {
    id: 'clear-content',
    script: 'db:dev',
    args: ['clear-content', '--apply', '--confirm', 'tixxinblog_dev'],
    write: true,
    danger: true,
  })
  assert.notEqual(confirmed, preview)
  assert.notEqual(confirmed.args, preview.args)
  assert.deepEqual(preview.args, ['clear-content'])
  const second = withConfirmation(preview, 'another_local_db')
  assert.deepEqual(second.args, ['clear-content', '--apply', '--confirm', 'another_local_db'])
  assert.deepEqual(confirmed.args, ['clear-content', '--apply', '--confirm', 'tixxinblog_dev'])
})

test('确认拒绝非字符串数据库名，失败后仍保留未确认的预览', () => {
  const preview = commandFor('remove-dataset', { dataset: 'gallery-v1' })
  const before = structuredClone(preview)
  for (const database of [undefined, null, false, 1, [], {}, '\t\n ']) {
    assert.throws(() => withConfirmation(preview, database), { message: '确认需要输入目标数据库名' })
    assert.deepEqual(preview, before)
  }
})
