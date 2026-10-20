/** @file terminal-pure.test.mjs @description 终端命令纯函数回归：仅生成文本，不运行 shell 或打开终端 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shellQuote, terminalAppleScript, terminalCommand } from './terminal.mjs'

test('shell 参数始终作为单个字面值，保留空值、中文、空白及替换字符', () => {
  for (const [input, expected] of [
    ['', "''"],
    ['博客 目录', "'博客 目录'"],
    ['line\nnext\tend', "'line\nnext\tend'"],
    ['$(command); `command` | & * " \\', "'$(command); `command` | & * \" \\'"],
    [0, "'0'"],
  ]) {
    assert.equal(shellQuote(input), expected)
  }
})

test('shell 参数中的连续单引号逐个转义', () => {
  assert.equal(shellQuote("a'b''c"), "'a'\\''b'\\'''\\''c'")
})

test('生成 AppleScript 时转义命令中的双引号及反斜杠', () => {
  const script = terminalAppleScript('printf "%s" "C:\\博客\\目录"', 'web', [-1920, 32, -960, 592])
  assert.equal(
    script.split('\n').find((line) => line.includes('set devTab')),
    '  set devTab to do script "printf \\"%s\\" \\"C:\\\\博客\\\\目录\\""',
  )
  assert(script.includes('set custom title of devTab to "TixXinBlog | 前端网站"'))
  // 新窗口按新标签反查，不依赖 front window：Terminal 不在前台或处于全屏空间时 front window 可能不是新窗口
  assert(script.includes('set devWindow to first window whose tabs contains devTab'))
  assert(script.includes('set bounds of devWindow to {-1920, 32, -960, 592}'))
  assert(!script.includes('front window'))
  assert(!script.includes('后端 API'))
})

test('终端命令和 AppleScript 均拒绝未知或继承属性服务名', () => {
  for (const service of ['', 'all', 'toString', '__proto__', 'api; exit', undefined]) {
    assert.throws(() => terminalCommand({ service }), /服务必须为 api 或 web/)
    assert.throws(() => terminalAppleScript('echo ok', service, [0, 0, 100, 100]), /服务必须为 api 或 web/)
  }
})

test('窗口坐标必须为四个有限数字，拒绝非数组、非数字和无穷值', () => {
  for (const bounds of [
    undefined,
    null,
    { 0: 0, 1: 0, 2: 100, 3: 100, length: 4 },
    [],
    [0, 0, 100],
    [0, 0, 100, 100, 200],
    [0, 0, '100', 100],
    [0, 0, NaN, 100],
    [0, 0, 100, Infinity],
    [0, 0, -Infinity, 100],
    [0, undefined, 100, 100],
  ]) {
    assert.throws(() => terminalAppleScript('echo ok', 'api', bounds), /终端窗口坐标无效/)
  }
})

test('窗口坐标拒绝稀疏数组，防止生成缺失坐标的 AppleScript', () => {
  const missingCoordinate = [0, 0, 100, 100]
  delete missingCoordinate[1]
  for (const bounds of [new Array(4), missingCoordinate]) {
    assert.throws(() => terminalAppleScript('echo ok', 'api', bounds), /终端窗口坐标无效/)
  }
})
