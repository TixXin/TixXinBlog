/**
 * @file e2e-specs.mjs
 * @description 按改动文件挑选本地浏览器回归 spec，供 check:local --e2e 使用：改动过的 spec 照跑；
 *   改动影响全站外壳或构建产物（构建配置、分块规则、根组件、布局、插件、主题、全局样式、补丁、锁文件）时，
 *   即使没有改动 spec 也加跑一组冒烟 spec，覆盖主题切换、切页与水合、首页、搜索弹窗与焦点。完整回归仍交给 CI。
 *   用法：git diff --name-only ... | node scripts/ci/e2e-specs.mjs
 *   输出：选中的 spec 文件名（每行一个），以及以 # 开头的提示行。
 * @author TixXin
 * @since 2026-11-05
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const web = 'src/frontend/web-blog/'

/** 影响全站外壳或构建产物的文件 */
export const SHELL_PATTERN = new RegExp(
  `^(?:${web}(?:nuxt\\.config\\.ts|clientChunking\\.ts|package\\.json|app/app\\.vue|app/error\\.vue|app/layouts/|app/plugins/|app/assets/styles/|themes/|theme-contracts/)|patches/|pnpm-lock\\.yaml$)`,
)

/** 冒烟 spec：主题切换、切页竞态与水合历史、首页、搜索弹窗、焦点与无障碍 */
export const SMOKE_SPECS = [
  'theme-persistence.spec.ts',
  'page-navigation-races.spec.ts',
  'hydration-history.spec.ts',
  'blog.spec.ts',
  'discovery-search.spec.ts',
  'accessibility.spec.ts',
]

/** 返回 { specs, notes }：改动过的 spec 在前，冒烟 spec 在后，去重 */
export function selectE2eSpecs(files) {
  const specs = new Set()
  const notes = []
  for (const file of files) {
    const spec = file.match(new RegExp(`^${web}tests/e2e/([^/]+\\.spec\\.ts)$`))?.[1]
    if (spec) specs.add(spec)
  }
  const shell = files.filter((file) => SHELL_PATTERN.test(file))
  if (shell.length) {
    for (const spec of SMOKE_SPECS) specs.add(spec)
    notes.push(
      `改动影响全站外壳或构建产物（${shell.slice(0, 3).join('、')}${shell.length > 3 ? ' 等' : ''}），加跑冒烟 spec`,
    )
  }
  return { specs: [...specs], notes }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readFileSync(0, 'utf8').split('\n').filter(Boolean)
  const { specs, notes } = selectE2eSpecs(files)
  for (const note of notes) process.stdout.write(`# ${note}\n`)
  // 已删除的 spec 不再运行
  for (const spec of specs)
    if (existsSync(new URL(`../../${web}tests/e2e/${spec}`, import.meta.url))) process.stdout.write(`${spec}\n`)
}
