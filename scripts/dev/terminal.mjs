#!/usr/bin/env node
/** @file terminal.mjs @description 在 macOS 可见终端运行完整开发链路；用法：corepack pnpm dev:terminal [--dry-run|--help] */
import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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

export function terminalCommand({ root, node, pnpm, path, service, logPath }) {
  if (!Object.hasOwn(labels, service)) throw new Error('服务必须为 api 或 web')
  // 仅传递启动工具路径；配置与凭据由目标终端环境及现有 .env 文件读取。
  const command = [
    `cd ${shellQuote(root)}`,
    `printf '%s\\n' ${shellQuote(`TixXinBlog | ${labels[service]} · Ctrl+C 仅停止本窗口创建的服务`)}`,
    `/usr/bin/env ${shellQuote('PATH=' + path)} ${shellQuote('npm_execpath=' + pnpm)} ${shellQuote(node)} ${shellQuote(join(root, 'scripts/dev.mjs'))} ${service} --logs`,
  ].join(' && ')
  // 仅记录本次启动命令的标准输出；tee 忽略 SIGINT，让原启动器完成 Ctrl+C 清理后再结束日志流。
  return logPath ? `( ${command} ) 2>&1 | /usr/bin/tee -a -i ${shellQuote(logPath)}` : command
}

export async function terminalBounds(service) {
  if (!Object.hasOwn(labels, service)) throw new Error('服务必须为 api 或 web')
  // 优先首块副屏；索引 0 为主屏，不随当前焦点窗口改变。保留多屏的负坐标。
  const { stdout } = await execute(
    '/usr/bin/osascript',
    [
      '-l',
      'JavaScript',
      '-e',
      `ObjC.import('AppKit');
const screens = $.NSScreen.screens;
const frame = screens.objectAtIndex(screens.count > 1 ? 1 : 0).visibleFrame;
const primaryHeight = screens.objectAtIndex(0).frame.size.height;
JSON.stringify({ left: frame.origin.x, top: primaryHeight - frame.origin.y - frame.size.height, width: frame.size.width, height: frame.size.height });`,
    ],
    { cwd: workspace, timeout: 10000 },
  )
  const area = JSON.parse(stdout)
  if (![area.left, area.top, area.width, area.height].every(Number.isFinite) || area.width < 300 || area.height < 300)
    throw new Error('无法确定可用屏幕范围，未调整终端窗口')
  const margin = 12
  const gap = 12
  // 副屏菜单栏自动隐藏时 visibleFrame 可能包含顶部区域，Terminal 仍会强制避让。
  const topInset = 32
  const height = Math.min(560, Math.floor((area.height - topInset - margin - gap) / 2))
  const width = Math.min(960, area.width - margin * 2)
  const left = Math.round(area.left + margin)
  const top = Math.round(area.top + topInset + (service === 'web' ? height + gap : 0))
  return [left, top, left + width, top + height]
}

export function terminalAppleScript(command, service, bounds) {
  if (!Object.hasOwn(labels, service)) throw new Error('服务必须为 api 或 web')
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite))
    throw new Error('终端窗口坐标无效')
  const title = appleQuote(`TixXinBlog | ${labels[service]}`)
  // 服务结束后窗口保留错误输出；下次启动前只关闭同一服务且已无运行进程的旧窗口，避免窗口堆积。
  // 先取窗口 id 再逐个关闭：按序号遍历时关闭会使后续序号前移而漏关。
  // do script 不指定已有标签，确保不向用户正在使用的 shell 或进程输入命令。
  return `tell application "Terminal"
  repeat with staleId in (get id of every window)
    try
      set staleWindow to window id staleId
      set staleTab to selected tab of staleWindow
      if custom title of staleTab is ${title} and busy of staleTab is false then close staleWindow
    end try
  end repeat
  activate
  set devTab to do script ${appleQuote(command)}
  set custom title of devTab to ${title}
  set bounds of front window to {${bounds.join(', ')}}
  return id of front window
end tell`
}

export async function openTerminal(command, service) {
  const bounds = await terminalBounds(service)
  const { stdout } = await execute('/usr/bin/osascript', ['-e', terminalAppleScript(command, service, bounds)], {
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
    console.log('窗口默认在首块副屏左侧上下排列；没有副屏时使用主屏。')
    console.log('配置读取终端环境和项目 .env 文件；调用方临时业务环境变量不转发。其他系统使用 dev:all。')
    console.log('启动命令输出写入 .artifacts/dev-terminal/；--dry-run 只预览，不创建日志文件。')
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
  const logDirectory = join(workspace, '.artifacts/dev-terminal')
  const launchId = `${Date.now()}-${process.pid}`
  const logPathFor = (service) => join(logDirectory, `${launchId}-${service}.log`)
  if (args.includes('--dry-run')) {
    for (const service of modes) console.log(terminalCommand({ ...options, service, logPath: logPathFor(service) }))
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
    const logPath = logPathFor(mode)
    mkdirSync(logDirectory, { recursive: true, mode: 0o700 })
    writeFileSync(logPath, '', { flag: 'wx', mode: 0o600 })
    console.log(`${labels[mode]}：启动日志 ${logPath}`)
    const id = await openTerminal(terminalCommand({ ...options, service: mode, logPath }), mode)
    console.log(`${labels[mode]}：已打开窗口 ${id}，等待服务就绪`)
    const deadline = Date.now() + config.timeout
    while (true) {
      const current = await inspectService(service)
      if (current.state === 'ready') break
      if (current.state === 'foreign' && current.identity) throw new Error(`${labels[mode]}：${current.detail}`)
      if (Date.now() >= deadline)
        throw new Error(`${labels[mode]}就绪超时，请查看启动日志 ${logPath} 或窗口 ${id}；已启动的其他服务保持运行`)
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
