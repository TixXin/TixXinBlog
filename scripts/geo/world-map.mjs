/**
 * @file world-map.mjs
 * @description 生成后台访问统计地图用的国界数据 src/frontend/web-blog/public/geo/world.json。
 *   来源：Natural Earth 5.1.1 `ne_10m_admin_0_countries_chn`（中国视角，公有领域），固定到下面的提交。
 *   处理：港澳并入 CN（与 ip2region 的归类一致，台湾在该视角中已属中国），去掉南极洲与没有 ISO 代码的区域，
 *   按 ISO 3166-1 alpha-2 合并，用 mapshaper 简化到 2% 并保留小岛，坐标保留两位小数，只留 name（ISO 代码）字段。
 *   只在需要更新地图时手动运行，安装、构建与测试不依赖它：node scripts/geo/world-map.mjs
 *   需要网络（GitHub 与 npm）；mapshaper 通过 npx 临时下载，不加入项目依赖。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'
const NAME = 'ne_10m_admin_0_countries_chn'
const MAPSHAPER = 'mapshaper@0.7.101'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = join(root, 'src/frontend/web-blog/public/geo/world.json')

const work = mkdtempSync(join(tmpdir(), 'tixxin-world-map-'))
try {
  for (const extension of ['shp', 'shx', 'dbf', 'prj']) {
    const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${COMMIT}/10m_cultural/${NAME}.${extension}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`下载 ${url} 失败：HTTP ${response.status}`)
    writeFileSync(join(work, `${NAME}.${extension}`), Buffer.from(await response.arrayBuffer()))
  }
  // 在临时目录外运行 npx，避免下载的数据目录影响模块解析
  execFileSync(
    'npx',
    [
      '--yes',
      MAPSHAPER,
      join(work, `${NAME}.shp`),
      'encoding=utf8',
      '-each',
      'iso = (ISO_A2_EH === "HK" || ISO_A2_EH === "MO") ? "CN" : (/^[A-Z]{2}$/.test(ISO_A2_EH) ? ISO_A2_EH : "")',
      '-filter',
      'iso !== "" && iso !== "AQ"',
      '-dissolve',
      'iso',
      '-simplify',
      '2%',
      'keep-shapes',
      '-filter-fields',
      'iso',
      '-rename-fields',
      'name=iso',
      '-o',
      output,
      'format=geojson',
      'precision=0.01',
    ],
    { cwd: tmpdir(), stdio: 'inherit' },
  )
  console.log(`已生成 ${output}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
