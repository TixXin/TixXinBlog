#!/usr/bin/env node
/** @file terminal.mjs @description 在 macOS 可见终端运行完整开发链路；用法：corepack pnpm dev:terminal [--dry-run|--help] */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { workspace, pnpmCommand, readConfig } from './config.mjs'
import { inspectService } from './checks.mjs'

const execute = promisify(execFile)
export const shellQuote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'"
const appleQuote = (value) => '"' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"'

const labels = { api: '后端 API', web: '前端网站' }

export function terminalCommand({ root, node, pnpm, path, service }) {
  if (!Object.hasOwn(labels, service)) throw new Error('服务必须为 api 或 web')
  // 仅传递启动工具路径；配置与凭据由目标终端环境及现有 .env 文件读取。
  return [
    `cd ${shellQuote(root)}`,
    `printf '%s\\n' ${shellQuote(`TixXinBlog | ${labels[service]} · Ctrl+C 仅停止本窗口创建的服务`)}`,
    `/usr/bin/env ${shellQuote('PATH=' + path)} ${shellQuote('npm_execpath=' + pnpm)} ${shellQuote(node)} ${shellQuote(join(root, 'scripts/dev.mjs'))} ${service} --logs`,
  ].join(' && ')
}

export function terminalAppleScript(command, service) {
  if (!Object.hasOwn(labels, service)) throw new Error('服务必须为 api 或 web')
  // do script 不指定已有标签，确保不向用户正在使用的 shell 或进程输入命令。
  return `tell application "Terminal"
  activate
  set devTab to do script ${appleQuote(command)}
  set custom title of devTab to ${appleQuote(`TixXinBlog | ${labels[service]}`)}
  set bounds of front window to ${service === 'api' ? '{40, 60, 1000, 620}' : '{120, 120, 1080, 680}'}
  return id of front window
end tell`
}

export async function openTerminal(command, service) {
  const { stdout } = await execute('/usr/bin/osascript', ['-e', terminalAppleScript(command, service)], {
    cwd: workspace,
    timeout: 15000,
  })
  return stdout.trim()
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  if (args.includes('--help')) {
    console.log('用法：corepack pnpm dev:terminal [--service=all|api|web] [--dry-run]')
    console.log('macOS：前后端各开独立 Terminal.app 窗口；已就绪服务复用。Ctrl+C 仅停止本窗口的服务。')
    console.log('配置读取终端环境和项目 .env 文件；调用方临时业务环境变量不转发。其他系统使用 dev:all。')
    return
  }
  if (args.some((arg) => arg !== '--dry-run' && !/^--service=(all|api|web)$/.test(arg)))
    throw new Error('未知参数；请运行 dev:terminal --help')
  const serviceArgs = args.filter((arg) => arg.startsWith('--service='))
  if (serviceArgs.length > 1) throw new Error('--service 只能指定一次')
  const selected = serviceArgs[0]?.slice('--service='.length) ?? 'all'
  const modes = selected === 'all' ? ['api', 'web'] : [selected]
  if (process.platform !== 'darwin')
    throw new Error('dev:terminal 仅支持 macOS；请在本地终端运行 corepack pnpm dev:all')
  const options = {
    root: workspace,
    node: process.execPath,
    pnpm: pnpmCommand()[1][0],
    path: process.env.PATH ?? '',
  }
  if (args.includes('--dry-run')) {
    for (const service of modes) console.log(terminalCommand({ ...options, service }))
    return
  }
  const config = readConfig()
  // 先检查所有目标端口，避免已知冲突下仍创建另一侧窗口。
  for (const mode of modes) {
    const status = await inspectService(config[mode])
    if (status.state === 'foreign') throw new Error(`${labels[mode]}：${status.detail}`)
  }
  for (const mode of modes) {
    const service = config[mode]
    const status = await inspectService(service)
    if (status.state === 'ready') {
      console.log(`${labels[mode]}：复用 ${service.origin}`)
      continue
    }
    if (status.state !== 'stopped') throw new Error(`${labels[mode]}：${status.detail}；请检查原终端后重试`)
    const id = await openTerminal(terminalCommand({ ...options, service: mode }), mode)
    console.log(`${labels[mode]}：已打开窗口 ${id}，等待服务就绪`)
    const deadline = Date.now() + config.timeout
    while (true) {
      const current = await inspectService(service)
      if (current.state === 'ready') break
      if (current.state === 'foreign' && current.identity) throw new Error(`${labels[mode]}：${current.detail}`)
      if (Date.now() >= deadline) throw new Error(`${labels[mode]}就绪超时，请查看窗口 ${id}；已启动的其他服务保持运行`)
      await delay(500)
    }
    console.log(`${labels[mode]}：已就绪 ${service.origin}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // 不打印包含完整 shell 命令的 execFile 错误对象。
    console.error(`可见终端启动失败：${error.stderr?.trim() || error.message.split('\n')[0]}`)
    process.exitCode = 1
  })
}
