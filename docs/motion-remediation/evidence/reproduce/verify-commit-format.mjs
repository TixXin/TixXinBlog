/** @file verify-commit-format.mjs @description 对比提交钩子整理前后的源码和编译结构，不将格式变化混入产品修复 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const root = 'D:/Projects/TixXinBlog', work = `${root}/.codex/motion-fixes`
const require = createRequire(`${root}/src/frontend/web-blog/package.json`)
const ts = require('typescript'), prettier = require('prettier'), vue = createRequire(require.resolve('vue/package.json'))('@vue/compiler-sfc')
const proof = JSON.parse(readFileSync(`${work}/evidence/source-proof.json`))
const options = await prettier.resolveConfig(`${root}/src/frontend/web-blog/nuxt.config.ts`)
const hash = value => createHash('sha256').update(value).digest('hex')
const js = source => {
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } })
  const tree = ts.createSourceFile('compare.js', result.outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)
  const structure = node => {
    if (ts.isParenthesizedExpression(node)) return structure(node.expression)
    const children = []
    ts.forEachChild(node, child => { children.push(structure(child)) })
    return { kind: node.kind, text: node.kind !== ts.SyntaxKind.SourceFile && typeof node.text === 'string' ? node.text : undefined, children }
  }
  return structure(tree)
}
const compiled = (source, file) => {
  if (!file.endsWith('.vue')) return { script: js(source) }
  const { descriptor, errors } = vue.parse(source, { filename: file })
  assert.equal(errors.length, 0)
  const template = descriptor.template && vue.compileTemplate({ source: descriptor.template.content, filename: file, id: 'format-comparison', compilerOptions: { whitespace: 'condense' } })
  assert.equal(template?.errors.length ?? 0, 0)
  return { script: js([descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')), template: js(template?.code ?? ''), styles: descriptor.styles.map(style => style.content.trim()) }
}
const current = {}, differences = []
for (const [file, expected] of Object.entries(proof.current)) {
  const path = `${root}/src/frontend/web-blog/${file}`, now = readFileSync(path, 'utf8')
  current[file] = hash(now)
  if (current[file] === expected) continue
  const before = readFileSync(`${work}/frontend/${file}`, 'utf8')
  // 部分验证副本配置含专用覆盖；当前发现的格式差异均不应位于这些配置。
  assert.equal(hash(before), expected, `验证前副本不匹配：${file}`)
  assert.equal(await prettier.format(before, { ...options, filepath: path }), await prettier.format(now, { ...options, filepath: path }), `存在格式以外的修改：${file}`)
  assert.deepEqual(compiled(before, file), compiled(now, file), `编译结构变化：${file}`)
  differences.push({ file, tested: expected, committed: current[file], formattedEqual: true, compiledEqual: true })
}
const record = { at: new Date().toISOString(), testedFiles: Object.keys(proof.current).length, unchanged: Object.keys(proof.current).length - differences.length, differences, current }
writeFileSync(`${work}/evidence/post-commit-source.json`, JSON.stringify(record, null, 2))
console.log(JSON.stringify({ files: record.testedFiles, unchanged: record.unchanged, formattingOnly: differences.map(item => item.file), compiledEqual: true }))
