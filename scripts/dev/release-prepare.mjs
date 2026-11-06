/**
 * @file release-prepare.mjs
 * @description 发版准备：校验新版本号、同步三处 package.json、把 CHANGELOG「未发布」整理成版本段落并补齐可从改动推出的升级说明，
 *              只用 `git commit -- <文件>` 提交这几个文件；可选接着 push:main 并打附注标签。
 *              用法：corepack pnpm release:prepare <版本> [--date YYYY-MM-DD] [--dry-run] [--push] [--tag]
 *                --dry-run  只打印将写入的版本段落与检查结果，不改文件
 *                --push     提交后运行 push:main（含 check:local）
 *                --tag      推送后打 v<版本> 附注标签并推送，触发 Release；只用于预发布，正式版等 CI 全绿后手动打标签
 *              另供 check:local 使用：node scripts/dev/release-prepare.mjs --version-only <基准>，
 *              相对基准只改了 CHANGELOG.md 与各 package.json 的 version 行时返回 0。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const VERSION_FILES = [
  'package.json',
  'src/backend/server-main/package.json',
  'src/frontend/web-blog/package.json',
]
const CONTENT_TYPES = 'src/backend/server-main/src/modules/backup/content-package.types.ts'
const MIGRATIONS = 'src/backend/server-main/src/migrations/'
const DEPLOY_PATHS = ['deploy/', 'compose.production.yaml', '.env.example', 'src/backend/server-main/.env.example']
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/

/** 语义化版本比较；预发布标识按点分段，数字段按数值比较，正式版高于同号预发布 */
export function compareVersions(a, b) {
  const [ma, mb] = [VERSION.exec(a), VERSION.exec(b)]
  if (!ma || !mb) throw new Error(`版本号格式不对：${!ma ? a : b}`)
  for (let i = 1; i <= 3; i++) if (+ma[i] !== +mb[i]) return +ma[i] - +mb[i]
  if (!ma[4] || !mb[4]) return (ma[4] ? -1 : 0) - (mb[4] ? -1 : 0)
  const [pa, pb] = [ma[4].split('.'), mb[4].split('.')]
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    const [na, nb] = [/^\d+$/.test(pa[i]), /^\d+$/.test(pb[i])]
    if (na && nb && +pa[i] !== +pb[i]) return +pa[i] - +pb[i]
    if (na !== nb) return na ? -1 : 1
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}
export const isPrerelease = (version) => VERSION.exec(version)?.[4] !== undefined

/** 「未发布」段落的正文（不含标题），以及它在全文中的位置 */
export function unreleasedBody(changelog) {
  const start = changelog.indexOf('## [未发布]')
  if (start < 0) throw new Error('CHANGELOG.md 缺少「## [未发布]」段落')
  const bodyStart = changelog.indexOf('\n', start) + 1
  const next = changelog.indexOf('\n## [', bodyStart)
  const bodyEnd = next < 0 ? changelog.length : next + 1
  return { start, bodyStart, bodyEnd, body: changelog.slice(bodyStart, bodyEnd).trim() }
}

/**
 * 推出升级说明：没有变化的类别写成确定的陈述；有变化的类别要求「未发布」里已经写了说明，否则列为错误。
 * facts: { version, latestStable, migrations: string[], deployFiles: string[], contentBefore, contentAfter }
 */
export function upgradeNotes(facts, body) {
  const notes = [],
    errors = []
  if (isPrerelease(facts.version))
    notes.push(
      `测试版，不标记为最新版本：\`install.sh\` 与 \`tixxin update\` 默认仍取 ${facts.latestStable ?? '最近的正式版'}，需显式执行 \`tixxin update ${facts.version}\``,
    )
  const unchanged = []
  if (facts.deployFiles.length) {
    if (!/环境|编排/.test(body))
      errors.push(`环境文件或编排有改动（${facts.deployFiles.join('、')}），请在「未发布」写明升级影响`)
  } else unchanged.push('环境文件与编排不变')
  if (facts.migrations.length) {
    if (!/迁移/.test(body))
      errors.push(`新增数据库迁移（${facts.migrations.join('、')}），请在「未发布」的升级说明里写明`)
  } else unchanged.push('不含数据库迁移')
  if (facts.contentAfter !== facts.contentBefore) {
    if (!body.includes(`v${facts.contentAfter}`))
      errors.push(`内容包从 v${facts.contentBefore} 升到 v${facts.contentAfter}，请在「未发布」写明兼容范围`)
  } else unchanged.push(`内容包仍为 v${facts.contentAfter}`)
  if (unchanged.length) notes.push(unchanged.join('，'))
  return { notes, errors }
}

/** 把「未发布」改写成版本段落，留下空的「未发布」；自动说明插在已有「升级说明」最前面，没有时新建该小节 */
export function releaseChangelog(changelog, version, date, notes) {
  const { start, bodyEnd, body } = unreleasedBody(changelog)
  if (!/^- /m.test(body)) throw new Error('「未发布」没有任何条目，没有可发布的内容')
  const bullets = notes.map((note) => `- ${note}`).join('\n')
  let section = body
  if (bullets) {
    section = /^### 升级说明\n/m.test(body)
      ? body.replace(/^### 升级说明\n\n/m, `### 升级说明\n\n${bullets}\n`)
      : `### 升级说明\n\n${bullets}\n\n${body}`
  }
  const head = changelog.slice(0, start)
  return `${head}## [未发布]\n\n## [${version}] - ${date}\n\n${section}\n\n${changelog.slice(bodyEnd).replace(/^\n+/, '')}`
}

/** check:local 用：改动只涉及 CHANGELOG.md 与各 package.json 的 version 行 */
export function versionOnlyChange(files, packageDiff) {
  if (!files.length || !files.every((file) => file === 'CHANGELOG.md' || VERSION_FILES.includes(file))) return false
  const lines = packageDiff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  return lines.every((line) => /^[+-]\s*"version": "[^"]+",?$/.test(line))
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const lines = (text) => text.split('\n').filter(Boolean)

function versionOnlyCli(base) {
  const files = [
    ...new Set([
      ...lines(git('diff', '--name-only', base)),
      ...lines(git('ls-files', '--others', '--exclude-standard')),
    ]),
  ]
  return versionOnlyChange(files, git('diff', '-U0', base, '--', ...VERSION_FILES)) ? 0 : 1
}

function contentVersion(ref) {
  const text = ref ? git('show', `${ref}:${CONTENT_TYPES}`) : readFileSync(join(root, CONTENT_TYPES), 'utf8')
  return Number(/version: (\d+)/.exec(text)?.[1])
}

/** 自上一个标签以来、类型为 feat/fix/perf 却没有改 CHANGELOG 的提交，提醒核对是否漏写 */
function commitsWithoutChangelog(last) {
  return lines(git('log', '--format=%h%x09%s', `${last}..HEAD`)).filter((line) => {
    const [sha, subject] = line.split('\t')
    return (
      /^(feat|fix|perf)(\(|:|!)/.test(subject) &&
      !lines(git('show', '--name-only', '--format=', sha)).includes('CHANGELOG.md')
    )
  })
}

function parseArgs(argv) {
  const options = { version: '', date: '', dryRun: false, push: false, tag: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--push') options.push = true
    else if (arg === '--tag') options.tag = options.push = true
    else if (arg === '--date' && /^\d{4}-\d{2}-\d{2}$/.test(argv[i + 1] ?? '')) options.date = argv[++i]
    else if (!options.version && VERSION.test(arg)) options.version = arg
    else throw new Error(`未知参数：${arg}；用法见文件头`)
  }
  if (!options.version) throw new Error('缺少版本号，例如 0.5.2-beta.9')
  // 正式版要等版本提交在 main 上的 CI 全绿才能打标签，推送后立刻打标签做不到，交给人确认 CI 后手动打
  if (options.tag && !isPrerelease(options.version))
    throw new Error('正式版不支持 --tag：先用 --push，等该提交 CI 全绿后再 git tag -a v<版本> 并推送')
  return options
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败`)
}

function main(argv) {
  if (argv[0] === '--version-only') return versionOnlyCli(argv[1] ?? 'origin/main')
  const options = parseArgs(argv)
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('只在 main 上准备发版')
  if (git('diff', '--name-only', 'HEAD', '--', 'CHANGELOG.md', ...VERSION_FILES))
    throw new Error('CHANGELOG.md 或 package.json 有未提交改动（可能是其他会话的），先处理再发版')
  const tags = lines(git('tag', '-l', 'v*'))
    .map((tag) => tag.slice(1))
    .filter((tag) => VERSION.test(tag))
    .sort(compareVersions)
  const last = tags.at(-1)
  if (last && compareVersions(options.version, last) <= 0)
    throw new Error(`新版本 ${options.version} 必须大于上一个标签 v${last}`)
  const current = VERSION_FILES.map((file) => JSON.parse(readFileSync(join(root, file), 'utf8')).version)
  if (new Set(current).size !== 1) throw new Error(`三处 package.json 版本不一致：${current.join(' / ')}`)

  const base = last ? `v${last}` : git('rev-list', '--max-parents=0', 'HEAD')
  const facts = {
    version: options.version,
    latestStable: tags.filter((tag) => !isPrerelease(tag)).at(-1),
    migrations: lines(git('diff', '--name-only', '--diff-filter=A', `${base}..HEAD`, '--', MIGRATIONS))
      .map((file) => file.slice(MIGRATIONS.length))
      .filter((name) => !name.startsWith('.')),
    deployFiles: lines(git('diff', '--name-only', `${base}..HEAD`, '--', ...DEPLOY_PATHS)),
    contentBefore: last ? contentVersion(base) : contentVersion(),
    contentAfter: contentVersion(),
  }
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  const { notes, errors } = upgradeNotes(facts, unreleasedBody(changelog).body)
  const missing = last ? commitsWithoutChangelog(base) : []
  if (missing.length)
    console.warn(
      `提醒：以下提交没有改 CHANGELOG.md，核对「未发布」是否已覆盖：\n${missing.map((line) => `  ${line}`).join('\n')}`,
    )
  if (errors.length) throw new Error(errors.join('\n'))
  const date = options.date || today()
  const next = releaseChangelog(changelog, options.version, date, notes)
  if (options.dryRun) {
    const from = next.indexOf(`## [${options.version}]`)
    console.log(next.slice(from, next.indexOf('\n## [', from + 1)).trim())
    return 0
  }
  writeFileSync(join(root, 'CHANGELOG.md'), next)
  for (const file of VERSION_FILES) {
    const path = join(root, file)
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(`"version": "${current[0]}"`, `"version": "${options.version}"`),
    )
  }
  const kind = isPrerelease(options.version) ? '测试版' : '正式版'
  const message = `chore(release): 准备 v${options.version}\n\n${kind} ${options.version}：${notes.at(-1) ?? '升级说明见更新日志'}。\n更新日志「未发布」整理为版本段落，三处 package.json 同步版本号。\n`
  execFileSync('git', ['commit', '-q', '-F', '-', '--', 'CHANGELOG.md', ...VERSION_FILES], {
    cwd: root,
    input: message,
  })
  console.log(`✓ 已提交 ${git('rev-parse', '--short', 'HEAD')} chore(release): 准备 v${options.version}`)
  if (options.push) run('corepack', ['pnpm', 'push:main'])
  if (options.tag) {
    const sha = git('rev-parse', 'HEAD')
    run('git', ['tag', '-a', `v${options.version}`, '-m', `v${options.version}`, sha])
    run('git', ['push', 'origin', `v${options.version}`])
    console.log(`✓ 已推送标签 v${options.version}，Release 工作流开始运行`)
  }
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exitCode = 1
  }
}
