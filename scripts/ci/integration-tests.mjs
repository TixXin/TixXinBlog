/**
 * @file integration-tests.mjs
 * @description 按改动文件挑选后端 HTTP 集成测试，供 check:local 在推送前本地运行；测试清单取自 server-main 的 test:integration，与 CI 保持一致。
 *   用法：git diff --name-only ... | node scripts/ci/integration-tests.mjs [--all]
 *   输出：选中的测试文件名（每行一个），以及以 # 开头的提示行。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const backend = 'src/backend/server-main/'
/** 模块名与测试名前缀不一致的映射；其余模块按“测试名以模块名开头”匹配 */
const aliases = {
  operations: ['notifications-integration.mjs'],
  post: ['overview-integration.mjs', 'discovery-search-integration.mjs'],
  // 内容包导入导出覆盖各领域，任一领域的备份测试都可能受影响
  backup: [/-backup-integration\.mjs$/, 'backup-integration.mjs', 'unicode-content-integration.mjs'],
}
/** 影响全部接口的公共代码：至少跑通用集成测试，并提示用 --all 跑全量 */
const sharedPattern = new RegExp(
  `^${backend}src/(common/|entities/|migrations/|config/|app\\.module\\.ts$|bootstrap\\.ts$|main\\.ts$)`,
)

/** 从 test:integration 脚本解析出 CI 实际运行的集成测试文件，保持原有顺序 */
export function integrationTests(script) {
  return script
    .split('&&')
    .map((part) => part.trim())
    .filter((part) => /^node tests\/[\w-]+\.mjs$/.test(part))
    .map((part) => part.slice('node tests/'.length))
}

function matches(test, rule) {
  return typeof rule === 'string' ? test === rule : rule.test(test)
}

/** 返回 { tests, notes }：tests 按 CI 顺序排列，notes 为给使用者的提示 */
export function selectIntegrationTests(files, available, { all = false } = {}) {
  if (all) return { tests: [...available], notes: [] }
  const selected = new Set(),
    notes = []
  let shared = false
  for (const file of files) {
    const module = file.match(new RegExp(`^${backend}src/modules/([^/]+)/`))?.[1]
    if (module) {
      for (const test of available)
        if (test.startsWith(`${module}-`) || (aliases[module] ?? []).some((rule) => matches(test, rule)))
          selected.add(test)
      continue
    }
    const test = file.match(new RegExp(`^${backend}tests/([\\w-]+\\.mjs)$`))?.[1]
    if (test && available.includes(test)) selected.add(test)
    else if (test) shared = true // 测试辅助文件（如 test-app.mjs）影响多个测试
    if (sharedPattern.test(file)) shared = true
  }
  if (shared) {
    selected.add('integration.mjs')
    notes.push('改动涉及公共代码、实体、迁移或测试辅助文件，只跑了通用集成测试；需要全量时加 --all')
  }
  return { tests: available.filter((test) => selected.has(test)), notes }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageJson = JSON.parse(readFileSync(new URL(`../../${backend}package.json`, import.meta.url), 'utf8'))
  const available = integrationTests(packageJson.scripts['test:integration'])
  const files = readFileSync(0, 'utf8').split('\n').filter(Boolean)
  const { tests, notes } = selectIntegrationTests(files, available, { all: process.argv.includes('--all') })
  for (const note of notes) process.stdout.write(`# ${note}\n`)
  for (const test of tests) process.stdout.write(`${test}\n`)
}
