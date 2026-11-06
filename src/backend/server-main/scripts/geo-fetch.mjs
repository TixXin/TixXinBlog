/**
 * @file geo-fetch.mjs
 * @description 下载访问统计用的离线地区库（ip2region xdb）到 GEO_DATA_DIRECTORY（缺省为后端目录下的 .geo/）。
 *   版本与 SHA256 固定在 geo-data.json，生产镜像的 Dockerfile 使用同一组值；已存在且校验一致的文件跳过。
 *   用法：corepack pnpm --filter server-main geo:fetch
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, 'geo-data.json'), 'utf8'))
const directory = resolve(process.env.GEO_DATA_DIRECTORY || join(here, '..', '.geo'))
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

mkdirSync(directory, { recursive: true })
for (const [name, expected] of Object.entries(data.files)) {
  const target = join(directory, name)
  if (existsSync(target) && sha256(readFileSync(target)) === expected) {
    console.log(`✓ ${name} 已是固定版本`)
    continue
  }
  const url = `https://raw.githubusercontent.com/lionsoul2014/ip2region/${data.commit}/data/${name}`
  console.log(`下载 ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载 ${name} 失败：HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const actual = sha256(buffer)
  if (actual !== expected) throw new Error(`${name} 校验失败：期望 ${expected}，实际 ${actual}`)
  writeFileSync(`${target}.partial`, buffer)
  renameSync(`${target}.partial`, target)
  console.log(`✓ ${name}（${(buffer.length / 1048576).toFixed(1)}MB）`)
}
console.log(`地区库目录：${directory}`)
