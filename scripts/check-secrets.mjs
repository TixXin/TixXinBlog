/**
 * @file check-secrets.mjs
 * @description 扫描待交付文件中的常见明文凭据，仅报告文件和行号，不输出秘密
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
const patterns = [
  /ctx7sk-[a-zA-Z0-9_-]{20,}/,
  /(?:ghp|gho|github_pat)_[a-zA-Z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]
const failures = []
for (const file of new Set(files)) {
  if (/^(?:node_modules|\.git)\//.test(file)) continue
  let source
  try {
    if (!statSync(file).isFile() || statSync(file).size > 5 * 1024 * 1024) continue
    source = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  source.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) failures.push(`${file}:${index + 1}`)
  })
}
if (failures.length) {
  process.stderr.write(`发现疑似明文凭据，请移入本机环境：\n${failures.join('\n')}\n`)
  process.exitCode = 1
} else process.stdout.write('秘密扫描通过：待交付文件未发现已知凭据格式\n')
