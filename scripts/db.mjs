/** @file db.mjs @description 开发数据管理入口：无参数进入交互菜单，带参数等价于既有 db:dev 命令 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { join } from 'node:path'
import { workspace, readEnvironment, pnpmCommand, redact } from './dev/config.mjs'
import { commandFor, describe, findEntry, withConfirmation, ENTRIES, GROUPS } from './db/menu.mjs'

const write = (message) => process.stdout.write(message + '\n')
const apiDirectory = join(workspace, 'src/backend/server-main')
const env = readEnvironment(apiDirectory, ['.env.local', '.env'])
const hide = (text) => redact(text, env)

function target() {
  try {
    const url = new URL(env.DATABASE_URL)
    return { label: `${url.host}${url.pathname}`, database: url.pathname.slice(1) }
  } catch {
    return { label: '未配置 DATABASE_URL', database: '' }
  }
}
function runScript(command, { capture = false } = {}) {
  const [node, [entry]] = pnpmCommand()
  const args = [
    entry,
    ...(capture ? ['--silent'] : []),
    '--filter',
    'server-main',
    'run',
    command.script,
    ...command.args,
  ]
  return new Promise((resolve) => {
    const child = spawn(node, args, {
      cwd: workspace,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    })
    let output = ''
    child.stdout?.on('data', (chunk) => {
      output += chunk
    })
    child.on('error', () => resolve({ code: 1, output }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}
// 数据集与数据域名单来自后端目录命令，菜单不另行维护一份名单。
async function catalog() {
  const result = await runScript(commandFor('list'), { capture: true })
  if (result.code !== 0) throw new Error('读取数据目录失败，请先运行 corepack pnpm dev:check 核对后端依赖与配置')
  return JSON.parse(result.output)
}
function usage() {
  write('用法：corepack pnpm db           进入交互菜单（需要可交互终端）')
  write('      corepack pnpm db <命令>    等价于 corepack pnpm db:dev <命令>')
  write('')
  for (const group of GROUPS) {
    write(`${group}`)
    for (const entry of ENTRIES.filter((item) => item.group === group))
      write(`  ${entry.id.padEnd(18)} ${entry.label}${entry.danger ? '（破坏性）' : entry.write ? '（写入）' : ''}`)
  }
}
// Ctrl+C 与 Ctrl+D 视为退出菜单，不打印堆栈也不留下半截命令。
class Interrupted extends Error {}
async function ask(rl, text) {
  try {
    return await rl.question(text)
  } catch {
    throw new Interrupted()
  }
}
async function choose(rl, title, options) {
  write('')
  write(title)
  options.forEach((option, index) => write(`  ${String(index + 1).padStart(2)}. ${option.label}`))
  const answer = (await ask(rl, '输入编号，直接回车返回：')).trim()
  if (!answer) return null
  const index = Number(answer)
  if (!Number.isInteger(index) || index < 1 || index > options.length) {
    write('编号无效。')
    return choose(rl, title, options)
  }
  return options[index - 1]
}
async function collect(rl, entry, data) {
  const options = {}
  for (const name of entry.needs ?? []) {
    if (name === 'dataset') {
      const picked = await choose(
        rl,
        '选择数据集：',
        data.datasets.map((item) => ({ label: `${item.id}（${item.count} 条）${item.scope}`, value: item.id })),
      )
      if (!picked) return null
      options.dataset = picked.value
    } else if (name === 'domain') {
      const picked = await choose(
        rl,
        '选择数据域：',
        data.domains.map((item) => ({ label: `${item.id} · ${item.entry}`, value: item.id })),
      )
      if (!picked) return null
      options.domain = picked.value
    } else {
      const answer = (await ask(rl, `输入${name === 'directory' ? '备份目录' : name}：`)).trim()
      if (!answer) return null
      options[name] = answer
    }
  }
  for (const name of entry.optional ?? []) {
    const answer = (await ask(rl, `可选${name === 'search' ? '搜索词' : name}，直接回车跳过：`)).trim()
    if (answer) options[name] = answer
  }
  return options
}
async function execute(rl, entry, options, database) {
  const command = commandFor(entry.id, options)
  write('')
  write(`执行：${describe(command)}`)
  const preview = await runScript(command)
  if (!command.write || preview.code !== 0) return
  write('')
  write(`以上为预览。确认后将写入 ${target().label}`)
  if (entry.danger) {
    write(`${entry.label}；该操作不可撤销，请先确认已有可用备份。`)
    const typed = (await ask(rl, `输入 ${entry.id} 继续，直接回车取消：`)).trim()
    if (typed !== entry.id) return write('已取消。')
  }
  const confirmed = (await ask(rl, `输入数据库名 ${database} 确认执行，直接回车取消：`)).trim()
  if (!confirmed) return write('已取消。')
  const applied = await runScript(withConfirmation(command, confirmed))
  write(applied.code === 0 ? '已执行。' : '未执行完成，数据库保持原状。')
}
async function menu() {
  const { label, database } = target()
  write(`目标数据库：${label}`)
  write('写入命令默认只预览，确认后才会执行；破坏性操作需要额外输入动作名。')
  const data = await catalog()
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.on('SIGINT', () => rl.close())
  try {
    for (;;) {
      const group = await choose(
        rl,
        '选择操作类型：',
        GROUPS.map((item) => ({ label: item, value: item })),
      )
      if (!group) return write('已退出。')
      const entry = await choose(
        rl,
        `${group.value}：`,
        ENTRIES.filter((item) => item.group === group.value).map((item) => ({
          label: `${item.label}${item.danger ? '（破坏性）' : item.write ? '（写入）' : ''}`,
          value: item.id,
        })),
      )
      if (!entry) continue
      const definition = findEntry(entry.value)
      const options = await collect(rl, definition, data)
      if (!options) continue
      await execute(rl, definition, options, database)
    }
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error
    write('')
    write('已退出。')
  } finally {
    rl.close()
  }
}
try {
  const args = process.argv.slice(2)
  if (args.length) {
    const result = await runScript({ script: 'db:dev', args })
    process.exitCode = result.code
  } else if (process.stdin.isTTY && process.stdout.isTTY) {
    await menu()
  } else {
    write('当前终端不可交互，请改用命令参数。')
    usage()
    process.exitCode = 1
  }
} catch (error) {
  write(hide(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
