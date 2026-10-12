#!/usr/bin/env node
/** @file terminal.mjs @description 在 macOS 可见终端运行完整开发链路；用法：corepack pnpm dev:terminal [--dry-run|--help] */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { workspace, pnpmCommand } from './config.mjs'

const execute = promisify(execFile)
export const shellQuote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'"
const appleQuote = (value) => '"' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"'

export function terminalCommand({ root, node, pnpm, path }) {
  // 仅传递启动工具路径；配置与凭据由目标终端环境及现有 .env 文件读取。
  return [
    `cd ${shellQuote(root)}`,
    `printf '%s\\n' ${shellQuote('TixXinBlog | 前后端开发 · Ctrl+C 停止本次服务；复用服务与数据库保持运行')}`,
    `/usr/bin/env ${shellQuote('PATH=' + path)} ${shellQuote('npm_execpath=' + pnpm)} ${shellQuote(node)} ${shellQuote(join(root, 'scripts/dev.mjs'))} all --logs`,
  ].join(' && ')
}

export function terminalAppleScript(command) {
  // do script 不指定已有标签，确保不向用户正在使用的 shell 或进程输入命令。
  return `tell application "Terminal"
  activate
  set devTab to do script ${appleQuote(command)}
  set custom title of devTab to "TixXinBlog | 前后端开发"
  set bounds of front window to {40, 60, 1080, 780}
  return id of front window
end tell`
}

export async function openTerminal(command) {
  const { stdout } = await execute('/usr/bin/osascript', ['-e', terminalAppleScript(command)], {
    cwd: workspace,
    timeout: 15000,
  })
  return stdout.trim()
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  if (args.includes('--help')) {
    console.log('用法：corepack pnpm dev:terminal [--dry-run]')
    console.log('macOS：新建 Terminal.app 窗口运行 dev:all，并同步显示脱敏日志。Ctrl+C 停止，窗口保留。')
    console.log('配置读取终端环境和项目 .env 文件；调用方临时业务环境变量不转发。其他系统使用 dev:all。')
    return
  }
  if (args.some((arg) => arg !== '--dry-run')) throw new Error('未知参数；请运行 dev:terminal --help')
  if (process.platform !== 'darwin')
    throw new Error('dev:terminal 仅支持 macOS；请在本地终端运行 corepack pnpm dev:all')
  const command = terminalCommand({
    root: workspace,
    node: process.execPath,
    pnpm: pnpmCommand()[1][0],
    path: process.env.PATH ?? '',
  })
  if (args.includes('--dry-run')) {
    console.log(command)
    return
  }
  const id = await openTerminal(command)
  console.log(`已打开 Terminal.app 窗口 ${id}；这仅确认窗口创建，服务就绪请运行 corepack pnpm dev:check。`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // 不打印包含完整 shell 命令的 execFile 错误对象。
    console.error(`可见终端启动失败：${error.stderr?.trim() || error.message.split('\n')[0]}`)
    process.exitCode = 1
  })
}
