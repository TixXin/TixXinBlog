/**
 * @file inventory.mjs
 * @description 使用已安装Sass和PostCSS提取实际动效规则，保留源码行与状态上下文
 */
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const root='D:/Projects/TixXinBlog',front=`${root}/src/frontend/web-blog`,out=`${root}/docs/motion-audit`
const require=createRequire(`${front}/package.json`)
const sass=require('sass')
const postcss=require(`${root}/node_modules/.pnpm/postcss@8.5.28/node_modules/postcss`)
const hashes=JSON.parse(readFileSync(`${out}/evidence/source-hashes.json`)).hashes
const regex=/(?:\btransition(?:-[\w-]+)?\s*:|\banimation(?:-[\w-]+)?\s*:|@keyframes|<Transition\b|<TransitionGroup\b|<NuxtPage\b|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|clearTimeout|clearInterval|IntersectionObserver|ResizeObserver|MutationObserver|scrollTo\(|scrollIntoView\(|startViewTransition|\.animate\(|will-change\s*:|prefers-reduced-motion|useSortable|onBeforeEnter|onAfterLeave|transitionend|animationend)/
const all=[],hits=[],failures=[]
for(const rel of Object.keys(hashes)){
  const file=`${root}/${rel}`,text=readFileSync(file,'utf8'),lines=text.split('\n')
  const localHits=[]
  lines.forEach((s,i)=>{if(regex.test(s)){const item={file:rel,line:i+1,text:s.trim(),context:lines.slice(Math.max(0,i-3),i+7).join('\n')};hits.push(item);localHits.push(item)}})
  if(!localHits.length)continue
  const entry={file:rel,description:text.match(/@description\s+([^\r\n]+)/)?.[1]||'',hits:localHits,rules:[],transitions:[],keyframes:[],js:[]}
  const styles=file.endsWith('.scss')?[{css:text,line:1}]:[...text.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)].map(m=>({css:m[2],line:text.slice(0,m.index).split('\n').length+1,scss:m[1].includes('scss')}))
  for(const s of styles){
    try{
      const source=(file.endsWith('.scss')?'':`@use 'tokens' as *;\n`)+s.css
      const css=sass.compileString(source,{url:pathToFileURL(file),loadPaths:[`${front}/app/assets/styles`],logger:{warn(){},debug(){}}}).css
      const ast=postcss.parse(css)
      ast.walkAtRules(/keyframes$/,r=>entry.keyframes.push({name:r.params,css:r.toString()}))
      ast.walkRules(rule=>{
        const declarations={};rule.nodes?.filter(n=>n.type==='decl').forEach(d=>declarations[d.prop]=d.value)
        if(!Object.keys(declarations).some(k=>/^(transition|animation|will-change)/.test(k)))return
        const parents=[];let parent=rule.parent;while(parent&&parent.type!=='root'){if(parent.type==='atrule')parents.unshift(`@${parent.name} ${parent.params}`);parent=parent.parent}
        if(parents.some(p=>p.includes('keyframes')))return
        const related=[];ast.walkRules(other=>{if(other!==rule&&other.selector.split(/[,\s]+/).some(sel=>rule.selector.includes(sel.replace(/-(enter|leave)-(active|from|to)/g,''))&&sel.length>7)&&other.nodes?.some(n=>n.type==='decl'&&['transform','opacity','filter','z-index','height','width'].includes(n.prop)))related.push({selector:other.selector,values:Object.fromEntries(other.nodes.filter(n=>n.type==='decl'&&['transform','opacity','filter','z-index','height','width'].includes(n.prop)).map(d=>[d.prop,d.value]))})})
        entry.rules.push({selector:rule.selector,conditions:parents,declarations,related:related.slice(0,18)})
      })
    }catch(e){failures.push({file:rel,message:e.message.slice(0,600)})}
  }
  for(const m of text.matchAll(/<(TransitionGroup|Transition|NuxtPage)\b([\s\S]*?)>/g))entry.transitions.push({line:text.slice(0,m.index).split('\n').length,tag:m[0],following:text.slice(m.index+m[0].length,m.index+m[0].length+280)})
  entry.js=localHits.filter(h=>/requestAnimationFrame|setTimeout|setInterval|Observer|scrollTo\(|scrollIntoView\(|startViewTransition|\.animate\(|useSortable|animationend|transitionend/.test(h.text))
  all.push(entry)
}
writeFileSync(`${out}/evidence/source-motion-hits.json`,JSON.stringify(hits,null,2))
writeFileSync(`${out}/evidence/source-motion-hits.txt`,hits.map(h=>`${h.file}:${h.line}: ${h.text}`).join('\n'))
writeFileSync(`${out}/evidence/inventory-rules.json`,JSON.stringify({files:all,compileFailures:failures},null,2))
let md='## 逐文件规则附录\n\n以下覆盖扫描命中的全部文件；使用本机实际安装的 Sass 编译静态规则。包含工具类定义、复用入口和非视觉调度命中，不能把命中数量当作独立动画数量。属性值来自当前源码；运行条件、是否可中断及实测结论参见正文机制台账和 findings.json。\n\n'
for(const [i,e] of all.entries()){
  md+=`### F${String(i+1).padStart(3,'0')} ${e.file.replace('src/frontend/web-blog/','')}\n\n${e.description}\n\n实现：[源码](${root}/${e.file}:${e.hits[0].line})。\n\n`
  if(e.rules.length){md+='|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|\n|---|---|---|\n';for(const r of e.rules)md+=`|\`${r.selector.replaceAll('|','\\|').replaceAll('\n',' ')}\`|${r.conditions.join(' / ')||'常规样式；状态选择器触发'}|${Object.entries(r.declarations).map(([k,v])=>`${k}: ${v}`).join('; ').replaceAll('|','\\|')}|\n`;md+='\n'}
  if(e.transitions.length)md+='Vue 进入/退出配置：\n\n'+e.transitions.map(t=>'```vue\n'+t.tag+'\n'+t.following.trimEnd()+'\n```').join('\n\n')+'\n\n'
  if(e.js.length)md+='JS 调度/观察器位置：'+e.js.map(h=>`[${h.line}](${root}/${e.file}:${h.line}) \`${h.text.replaceAll('`','')}\``).join('；')+'。\n\n'
  if(e.keyframes.length)md+='关键帧（位移、缩放、透明度及其他实际变化）：\n\n```css\n'+e.keyframes.map(k=>k.css).join('\n')+'\n```\n\n'
}
writeFileSync(`${out}/evidence/inventory-appendix.md`,md)
console.log(JSON.stringify({files:all.length,hits:hits.length,rules:all.reduce((n,e)=>n+e.rules.length,0),transitions:all.reduce((n,e)=>n+e.transitions.length,0),failures}))
