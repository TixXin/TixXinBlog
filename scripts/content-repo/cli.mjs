#!/usr/bin/env node
/**
 * @file cli.mjs
 * @description 内容仓库命令行：把后台导出的内容包展开成可用 Git 管理的目录（export），
 *              把目录重新打成内容包（pack），或只校验目录能否打包（check）。
 *              只读写命令行指定的本机文件，不访问后端与网络。用法见 docs/content-repo.md。
 * @author TixXin
 * @since 2026-11-05
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { MANIFEST, filesToPack, packToFiles } from './layout.mjs'

/** 工具管理的顶层条目；仓库里的其他文件（README、.git、CI 配置等）不读也不删 */
const MANAGED = [
  MANIFEST,
  'site.yaml',
  'guestbook.yaml',
  'gallery.yaml',
  'projects.yaml',
  'links.yaml',
  'prompts.yaml',
  'subscriptions.yaml',
  'posts',
  'flashes',
  'moments',
  'media',
]
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024

function usage() {
  return `用法：
  corepack pnpm content:repo export --pack <内容包.json> --out <仓库目录>
  corepack pnpm content:repo pack --dir <仓库目录> --out <内容包.json> [--force]
  corepack pnpm content:repo check --dir <仓库目录>`
}

function walk(root, path, files) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = join(path, entry.name)
    if (entry.isDirectory()) walk(root, full, files)
    else if (entry.isFile()) files.set(relative(root, full).split(sep).join('/'), readFileSync(full))
  }
}

export function readRepo(dir) {
  const root = resolve(dir)
  if (!existsSync(join(root, MANIFEST))) throw new Error(`${root} 没有 ${MANIFEST}，不是内容仓库`)
  const files = new Map()
  for (const name of MANAGED) {
    const full = join(root, name)
    if (!existsSync(full)) continue
    if (statSync(full).isDirectory()) walk(root, full, files)
    else files.set(name, readFileSync(full))
  }
  return files
}

export function writeRepo(dir, files) {
  const root = resolve(dir)
  if (existsSync(root)) {
    const entries = readdirSync(root).filter((name) => !name.startsWith('.'))
    if (entries.length && !existsSync(join(root, MANIFEST)))
      throw new Error(`${root} 不是空目录，也不是内容仓库；为避免覆盖，请换一个目录`)
    // 重新导出时先清掉本工具管理的条目，后台已删除的内容才会在 Git 里显示为删除
    for (const name of MANAGED) rmSync(join(root, name), { recursive: true, force: true })
  }
  for (const [path, content] of files) {
    const full = join(root, ...path.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
}

function summary(pack) {
  const count = (key) => (Array.isArray(pack[key]) ? pack[key].length : 0)
  return `v${pack.version}：文章 ${count('posts')}、闪念 ${count('flashes')}、朋友圈 ${count('moments')}、留言 ${count('guestbook')}、图库 ${count('gallery')}、项目 ${count('projects')}、友链 ${count('links')}、提示词 ${count('prompts')}、订阅 ${count('subscriptions')}、媒体 ${count('media')}`
}

export function main(argv) {
  const [command, ...rest] = argv
  const { values } = parseArgs({
    args: rest,
    options: { pack: { type: 'string' }, out: { type: 'string' }, dir: { type: 'string' }, force: { type: 'boolean' } },
  })
  if (command === 'export') {
    if (!values.pack || !values.out) throw new Error(usage())
    const pack = JSON.parse(readFileSync(values.pack, 'utf8'))
    const files = packToFiles(pack)
    // 写出前先确认能无损转回，避免留下一个打不回去的仓库
    filesToPack(files)
    writeRepo(values.out, files)
    return `已导出到 ${resolve(values.out)}（${files.size} 个文件）：${summary(pack)}`
  }
  if (command === 'pack') {
    if (!values.dir || !values.out) throw new Error(usage())
    if (existsSync(values.out) && !values.force) throw new Error(`${values.out} 已存在；确认覆盖请加 --force`)
    const pack = filesToPack(readRepo(values.dir))
    const json = JSON.stringify(pack)
    if (Buffer.byteLength(json) > MAX_PACKAGE_BYTES)
      throw new Error('内容包超过 50 MiB 上限，后台无法导入；请改用完整备份')
    writeFileSync(values.out, json)
    return `已生成 ${resolve(values.out)}：${summary(pack)}。请在后台“内容维护”上传预览后再迁入。`
  }
  if (command === 'check') {
    if (!values.dir) throw new Error(usage())
    return `可以打包：${summary(filesToPack(readRepo(values.dir)))}`
  }
  throw new Error(usage())
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(main(process.argv.slice(2)))
  } catch (error) {
    console.error(`[content:repo] ${error.message}`)
    process.exit(1)
  }
}
