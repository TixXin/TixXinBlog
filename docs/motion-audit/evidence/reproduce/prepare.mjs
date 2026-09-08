/**
 * @file prepare.mjs
 * @description 动效审查：保存源码指纹与动效命中清单，建立隔离构建副本
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
const root = 'D:/Projects/TixXinBlog'
const temp = `${root}/.codex/motion-audit`
const evidence = `${root}/docs/motion-audit/evidence`
mkdirSync(evidence, { recursive: true })
const skip = new Set(['node_modules', '.nuxt', '.nuxt-production', '.output', '.git', 'dist', 'coverage', '.cache'])
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => skip.has(e.name) || e.name.startsWith('.env') ? [] :
    e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)])
}
const front = `${root}/src/frontend/web-blog`
const hashes = {}
const hits = []
const pattern = /\b(?:transition(?:-[\w-]+)?\s*:|animation(?:-[\w-]+)?\s*:|@keyframes|<Transition|<NuxtPage|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|clearTimeout|clearInterval|IntersectionObserver|ResizeObserver|MutationObserver|scrollTo\(|scrollIntoView\(|startViewTransition|\.animate\(|will-change\s*:|prefers-reduced-motion|useSortable|onBeforeEnter|onAfterLeave|transitionend|animationend)/
for (const f of walk(front)) {
  if (!/\.(vue|ts|scss|mjs|json)$/.test(f) || /[\\/]tests[\\/]/.test(f)) continue
  const txt = readFileSync(f,'utf8')
  const rel = path.relative(root,f).replaceAll('\\','/')
  hashes[rel] = createHash('sha256').update(txt).digest('hex')
  const lines=txt.split('\n')
  lines.forEach((s,i)=>{ if(pattern.test(s)) hits.push({file:rel,line:i+1,text:s.trim(),context:lines.slice(Math.max(0,i-3),i+5).join('\n')}) })
}
writeFileSync(`${evidence}/source-hashes.json`, JSON.stringify({at:new Date().toISOString(),hashes},null,2))
writeFileSync(`${evidence}/source-motion-hits.json`, JSON.stringify(hits,null,2))
writeFileSync(`${evidence}/source-motion-hits.txt`, hits.map(h=>`${h.file}:${h.line}: ${h.text}`).join('\n'))
writeFileSync(`${evidence}/worktree-before.txt`,execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}))
for (const [name,source] of [['frontend',front],['backend',`${root}/src/backend/server-main`]]) {
  const dest = `${temp}/${name}`
  if (existsSync(dest)) throw new Error(`副本已存在，禁止覆盖：${dest}`)
  cpSync(source,dest,{recursive:true,filter:p=>!p.split(/[\\/]/).some(x=>skip.has(x)||x.startsWith('.env'))})
  symlinkSync(`${source}/node_modules`, `${dest}/node_modules`, 'junction')
}
// 显式隔离生成目录与 Vite 缓存，不改变产品实现。
const cfg=`${temp}/frontend/nuxt.config.ts`
writeFileSync(cfg,readFileSync(cfg,'utf8').replace(/buildDir:.*?,\n/,`workspaceDir: '${temp}/frontend',\n  buildDir: '${temp}/frontend/.nuxt-audit',\n`).replace('vite: {',`vite: {\n    cacheDir: '${temp}/frontend/.vite-audit',`))
const todo=`${front}/todo.md`
let text=readFileSync(todo,'utf8').replaceAll('\r\n','\n')
text=text.replace('总任务数：58','总任务数：59').replace('进行中：0','进行中：1').replace('完成率：100%','完成率：98.3%').replace('## 当前进行中\n\n暂无。','## 当前进行中\n\n- [~] 全站动效系统审查：动效台账、三主题与多端实测、开发热更新专项、性能与减少动态效果验证，交付 `docs/motion-audit/` 报告及整改提示词。')
writeFileSync(todo,text)
console.log(JSON.stringify({sourceFiles:Object.keys(hashes).length,motionHits:hits.length,motionFiles:new Set(hits.map(h=>h.file)).size,temp}))
