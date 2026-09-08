/**
 * @file audit-runner.mjs
 * @description 动效审查的隔离浏览器采样：页面、主题、过渡、性能和中断证据
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
const root='D:/Projects/TixXinBlog'
const work=`${root}/.codex/motion-audit`
const out=`${root}/docs/motion-audit/evidence`
const require=createRequire(`${work}/frontend/package.json`)
const {chromium,expect}=require('@playwright/test')
const state=JSON.parse(readFileSync(`${work}/state.json`,'utf8'))
if(state.status!=='ready')throw Error('隔离环境未启动')
const suite=process.argv[2]||'smoke'
const browser=await chromium.launch({headless:true})
const results=[]
const labels={nexus:'Nexus 三栏',aurora:'Aurora 双栏',dock:'Dock 浮岛'}
mkdirSync(`${out}/${suite}`,{recursive:true})
writeFileSync(`${out}/environment.json`,JSON.stringify({at:new Date().toISOString(),os:os.version(),platform:os.platform(),cpu:os.cpus()[0]?.model,cores:os.cpus().length,ramGB:Math.round(os.totalmem()/2**30),node:process.version,browser:browser.version(),mode:'独立Chromium headless；用户应用内浏览器另行检查',prod:state.prod,dev:state.dev,physicalRefreshRate:'未读取；rAF采样单独报告'},null,2))
function collector(){
  const data={events:[],longtasks:[],shifts:[],errors:[]}
  window.__motionAudit=data
  for(const type of ['animationstart','animationend','animationcancel','transitionrun','transitionend','transitioncancel'])document.addEventListener(type,e=>{
    if(data.events.length<15000)data.events.push({at:performance.now(),type,name:e.animationName||e.propertyName,target:e.target.className,elapsed:e.elapsedTime})
  },true)
  for(const type of ['longtask','layout-shift'])try{new PerformanceObserver(list=>{
    for(const e of list.getEntries()){
      if(type==='longtask')data.longtasks.push({at:e.startTime,duration:e.duration})
      else data.shifts.push({at:e.startTime,value:e.value,recentInput:e.hadRecentInput,sources:e.sources?.map(s=>({node:s.node?.className,previous:s.previousRect,current:s.currentRect}))})
    }
  }).observe({type,buffered:true})}catch{}
}
async function context(options={}){
  const c=await browser.newContext({baseURL:state.prod,viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'no-preference',...options})
  await c.addInitScript(collector)
  const p=await c.newPage();p.setDefaultTimeout(9000)
  p.on('pageerror',e=>results.push({type:'pageerror',message:e.message,url:p.url()}))
  return {c,p}
}
async function shot(p,name){await p.screenshot({path:`${out}/${suite}/${name}.png`,animations:'allow',timeout:10000});return `${suite}/${name}.png`}
async function ready(p){await expect(p.locator('.loading-screen:visible')).toHaveCount(0,{timeout:45000});await p.waitForTimeout(500);await expect(p.locator('.loading-screen:visible')).toHaveCount(0,{timeout:45000})}
async function info(p){return p.evaluate(()=>({url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,color:document.documentElement.className,mainChars:document.querySelector('main')?.innerText.length||0,mainStart:document.querySelector('main')?.innerText.slice(0,180),inert:[...document.querySelectorAll('[inert]')].map(e=>({tag:e.tagName,id:e.id,cls:e.className})),bodyOverflow:document.body.style.overflow,dialogs:[...document.querySelectorAll('[role="dialog"]')].map(e=>({label:e.getAttribute('aria-label'),opacity:getComputedStyle(e).opacity})),clones:document.querySelectorAll('.sidebar-leaving-clone').length,sidebar:[...document.querySelectorAll('#right-sidebar-target>*')].map(e=>({cls:e.className,visibility:getComputedStyle(e).visibility})),focus:document.activeElement?.outerHTML.slice(0,240),animations:document.getAnimations().map(a=>({name:a.animationName||a.transitionProperty||'WAAPI',state:a.playState,target:a.effect?.target?.className,timing:a.effect?.getTiming(),keyframes:a.effect?.getKeyframes()})),metrics:window.__motionAudit}))}
async function run(name,fn){const start=Date.now();try{const detail=await fn();results.push({name,status:'observed',elapsedMs:Date.now()-start,detail});console.log('OBSERVED '+name)}catch(e){results.push({name,status:'interrupted',elapsedMs:Date.now()-start,error:e.message.slice(0,1600)});console.log('INTERRUPTED '+name+' '+e.message.split('\n')[0])}writeFileSync(`${out}/${suite}/results.json`,JSON.stringify(results,null,2))}
async function appearance(p){const e=p.getByRole('button',{name:'界面设置',exact:true});if(!await e.isVisible())await p.getByRole('button',{name:'更多导航',exact:true}).click();await e.click();await expect(p.getByRole('dialog',{name:'界面设置',exact:true})).toBeVisible()}
async function theme(p,id){await appearance(p);await p.getByRole('button',{name:labels[id]+' 布局主题',exact:true}).click();await expect(p.locator('.theme-'+id)).toBeVisible();await ready(p);if(await p.getByRole('button',{name:'关闭界面设置',exact:true}).isVisible())await p.getByRole('button',{name:'关闭界面设置',exact:true}).click();if(await p.getByRole('dialog',{name:'更多导航',exact:true}).isVisible())await p.keyboard.press('Escape');await p.waitForTimeout(350)}
async function login(p){await p.goto('/admin/login');await ready(p);await p.getByRole('textbox',{name:'用户名',exact:true}).fill(state.username);await p.getByRole('textbox',{name:'密码',exact:true}).fill(state.password);await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/admin');await ready(p)}
async function resetEvents(p){await p.evaluate(()=>{window.__motionAudit.events=[];window.__motionAudit.longtasks=[];window.__motionAudit.shifts=[]})}
async function frames(p,name,action){await resetEvents(p);const started=Date.now();const snaps=[];await action();for(const wait of [0,80,160,320,700]){if(wait)await p.waitForTimeout(wait);snaps.push({at:Date.now()-started,shot:await shot(p,`${name}-${wait}`),state:await info(p)})}return snaps}

try{
if(suite==='smoke'){
  const {c,p}=await context()
  const paths=['/','/archive','/articles/106','/projects','/gallery','/flash','/moments','/tabs','/links','/guestbook','/about','/admin/login']
  for(const [i,path] of paths.entries())await run(`route ${path}`,async()=>{await p.goto(path);await ready(p);return {image:await shot(p,`${String(i+1).padStart(2,'0')}-${path.replaceAll('/','-')||'home'}`),state:await info(p)}})
  await run('authenticated admin routes',async()=>{await login(p);const pages=[];for(const path of ['/admin','/admin/posts','/admin/posts/new','/admin/posts/106','/admin/moments/new','/admin/flashes','/admin/comments','/admin/taxonomy','/admin/media','/admin/site','/admin/account','/admin/audit','/admin/maintenance']){await p.goto(path);await ready(p);pages.push({path,image:await shot(p,'admin'+path.replaceAll('/','-')),state:await info(p)})}return pages})
  await c.close()
}
if(suite==='matrix'){
  for(const id of ['nexus','aurora','dock'])for(const reduce of [false,true])for(const [width,color] of [[1440,'dark'],[390,'light']]){
    const {c,p}=await context({viewport:{width,height:width===390?844:1000},colorScheme:color,reducedMotion:reduce?'reduce':'no-preference'})
    await c.addCookies([{name:'tixxin-blog-layout-theme',value:id,url:state.prod}]);await c.addInitScript(c=>localStorage.setItem('nuxt-color-mode',c),color)
    await run(`${id} ${width} ${color} ${reduce?'reduce':'normal'}`,async()=>{
      await p.goto('/');await ready(p)
      const home={image:await shot(p,`${id}-${width}-${color}-${reduce}-home`),state:await info(p)}
      const settings=await frames(p,`${id}-${width}-${reduce}-settings`,()=>appearance(p))
      await p.keyboard.press('Escape');await p.waitForTimeout(400)
      await p.goto('/gallery');await ready(p)
      const photo=p.locator('.gallery-grid__cell button').first()
      const actual=await photo.count()?photo:p.getByRole('button',{name:/雪山日出/})
      const box=await frames(p,`${id}-${width}-${reduce}-lightbox`,()=>actual.click())
      await p.keyboard.press('Escape');await p.waitForTimeout(400)
      return {home,settings,box,closed:await info(p)}
    });await c.close()
  }
}
if(suite==='interactions'){
  const {c,p}=await context();await p.goto('/');await ready(p)
  await run('pagination and continuous enter',async()=>{
    const next=await frames(p,'pagination',()=>p.getByRole('button',{name:'下一页',exact:true}).click())
    await p.getByRole('button',{name:'连续加载',exact:true}).click();await p.waitForTimeout(800)
    await resetEvents(p)
    await p.locator('.post-list-viewport').evaluate(e=>e.scrollTo({top:e.scrollHeight,behavior:'instant'}));await p.waitForTimeout(1600)
    return {next,continuous:{image:await shot(p,'continuous'),state:await info(p),count:await p.locator('.post-item').count()}}
  })
  await run('search result navigation and back',async()=>{
    await p.goto('/');await ready(p);await p.getByRole('button',{name:'搜索站内文章、标签...',exact:true}).click();await p.getByRole('textbox',{name:'搜索文章、项目和友链',exact:true}).fill('分页样本 105');await expect(p.locator('.search-modal__item')).toHaveCount(1)
    const found=await shot(p,'search-results');const transition=await frames(p,'search-route',()=>p.getByRole('textbox',{name:'搜索文章、项目和友链',exact:true}).press('Enter'));await p.goBack();await p.waitForTimeout(800);return {found,transition,returned:await info(p)}
  })
  for(const preset of ['纵向滑动','轻柔滑动','淡入淡出','关闭动画'])await run('page preset '+preset,async()=>{
    await p.goto('/');await ready(p);await appearance(p);await p.getByRole('heading',{name:'主内容切换',exact:true}).locator('..').locator('..').getByRole('button',{name:preset,exact:true}).click();await p.keyboard.press('Escape');await p.waitForTimeout(350)
    return frames(p,'route-'+preset,()=>p.getByRole('link',{name:'归档',exact:true}).click())
  })
  await run('rapid navigation and back forward',async()=>{
    await p.goto('/');await ready(p);await resetEvents(p)
    for(let i=0;i<5;i++){await p.getByRole('link',{name:'归档',exact:true}).click({force:true});await p.waitForTimeout(30);await p.getByRole('link',{name:'项目',exact:true}).click({force:true});await p.waitForTimeout(30);await p.getByRole('link',{name:'主页',exact:true}).click({force:true})}
    await p.waitForTimeout(1000);const end=await info(p);await p.goBack();await p.waitForTimeout(700);await p.goForward();await p.waitForTimeout(700);return {end,history:await info(p),image:await shot(p,'rapid-end')}
  })
  await run('repeated modal focus cleanup',async()=>{
    await p.goto('/');await ready(p);const checks=[]
    for(let i=0;i<12;i++){await appearance(p);await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');await p.keyboard.press('Escape');await p.waitForTimeout(350);checks.push(await p.evaluate(()=>({inert:document.querySelectorAll('[inert]').length,overflow:document.body.style.overflow,focus:document.activeElement?.getAttribute('aria-label')})))}
    return checks
  })
  await run('slow and failed list requests recover',async()=>{
    await p.goto('/');await ready(p);await p.route('**/api/v1/posts?**',async r=>{await new Promise(res=>setTimeout(res,1700));await r.continue()})
    const slow=await frames(p,'slow-list',()=>p.getByRole('button',{name:'下一页',exact:true}).click());await p.unroute('**/api/v1/posts?**');await p.waitForTimeout(1900)
    await p.route('**/api/v1/posts?**',r=>r.abort());await p.getByRole('button',{name:'下一页',exact:true}).click();await p.waitForTimeout(1600);const failed={image:await shot(p,'failed-list'),state:await info(p)};await p.unroute('**/api/v1/posts?**');await p.getByRole('button',{name:/重试/}).click();await p.waitForTimeout(1000);return {slow,failed,recovered:await info(p)}
  })
  await c.close()
}
if(suite==='scroll-boundary'||suite==='scroll-final'){
  const {c,p}=await context();const fixture=JSON.parse(readFileSync(`${out}/supplement/results.json`)).find(r=>r.name.startsWith('seed')).detail
  await run('Nexus return top wheel interruption',async()=>{
    await p.goto('/articles/'+fixture.articleId);await ready(p);await p.mouse.move(650,500);await p.mouse.wheel(0,1800);await p.waitForTimeout(700)
    const positions=()=>p.locator('.article-viewport').evaluate(e=>({top:e.scrollTop,height:e.scrollHeight,visible:e.clientHeight}))
    const before=await positions();const controls=await p.locator('button:visible').evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label'),text:e.textContent?.slice(0,30)})))
    const top=p.getByRole('button',{name:'返回顶部',exact:true}).filter({visible:true}).first();if(!await top.count())return {before,controls,limitation:'没有可见回顶入口；未执行中断动作',image:await shot(p,'nexus-scrolled')}
    await top.click();await p.waitForTimeout(40);await p.mouse.move(650,500);await p.mouse.wheel(0,350);await p.waitForTimeout(700);const interrupted=await positions();const canRepeat=await top.isVisible();if(canRepeat)await top.click();await p.waitForTimeout(1400);const atTop=await positions();return {before,interrupted,canRepeat,atTop,image:await shot(p,'nexus-returned')}
  });await c.close()
}
if(suite==='advanced'){
  const {c,p}=await context();await p.goto('/');await ready(p);const client=await c.newCDPSession(p)
  await run('layers and color animation trace',async()=>{
    let layers=[];client.on('LayerTree.layerTreeDidChange',e=>layers=e.layers||[]);await client.send('LayerTree.enable');await p.waitForTimeout(300)
    const snapshots=[]
    const capture=async label=>{const reasons=[];for(const l of layers.filter(x=>x.drawsContent)){try{const r=await client.send('LayerTree.compositingReasons',{layerId:l.layerId});reasons.push({width:l.width,height:l.height,reasons:r.compositingReasonIds})}catch{}}snapshots.push({label,count:layers.length,contentLayers:layers.filter(x=>x.drawsContent).length,reasons})}
    await capture('nexus idle');await appearance(p);await p.waitForTimeout(400);await capture('settings open')
    for(const preset of ['圆形展开','模糊深度']){
      await p.getByRole('button',{name:preset,exact:true}).click();await resetEvents(p);await client.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing',transferMode:'ReturnAsStream'})
      for(let i=0;i<4;i++){await p.getByRole('button',{name:i%2?'深色':'浅色',exact:true}).click();await p.waitForTimeout(700)}
      const done=new Promise(res=>client.once('Tracing.tracingComplete',res));await client.send('Tracing.end');const {stream}=await done;let trace='';for(;;){const x=await client.send('IO.read',{handle:stream});trace+=x.data;if(x.eof)break}await client.send('IO.close',{handle:stream});writeFileSync(`${out}/advanced/${preset}-trace.json`,trace);await capture(preset+' settled')
    }
    await p.keyboard.press('Escape');await p.waitForTimeout(500);await theme(p,'aurora');await capture('aurora idle');return {snapshots,image:await shot(p,'aurora-layers')}
  })
  await run('Dock compact TOC visible target',async()=>{
    const fixture=JSON.parse(readFileSync(`${out}/supplement/results.json`)).find(r=>r.name.startsWith('seed')).detail
    await theme(p,'dock');await p.goto('/articles/'+fixture.articleId);await ready(p);await p.getByRole('button',{name:'文章目录',exact:true}).click();await p.locator('a[href^="#"]:visible').filter({hasText:'审查章节 12'}).click();await p.waitForTimeout(650);return {image:await shot(p,'dock-toc'),state:await info(p),heading:await p.evaluate(()=>({hash:location.hash,top:[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('审查章节 12'))?.getBoundingClientRect().top}))}
  })
  await run('scroll interruption and end boundaries',async()=>{
    await p.mouse.move(650,550);await p.mouse.wheel(0,400);await p.waitForTimeout(300);const before=await p.evaluate(()=>scrollY)
    const button=p.getByRole('button',{name:'返回顶部',exact:true}).filter({visible:true}).first();await button.click();await p.waitForTimeout(35);await p.mouse.wheel(0,500);await p.waitForTimeout(650);return {before,afterInterruption:await p.evaluate(()=>scrollY),state:await info(p)}
  })
  await c.close()
}
if(suite==='responsive'){
  for(const id of ['nexus','aurora','dock'])for(const [width,color,reduce]of [[768,'dark',false],[1024,'light',true],[1440,'light',false],[390,'dark',true]]){
    const {c,p}=await context({viewport:{width,height:900},colorScheme:color,reducedMotion:reduce?'reduce':'no-preference'});await c.addCookies([{name:'tixxin-blog-layout-theme',value:id,url:state.prod}]);await c.addInitScript(color=>localStorage.setItem('nuxt-color-mode',color),color)
    await run(`${id} ${width} ${color} ${reduce}`,async()=>{await p.goto('/');await ready(p);const home={image:await shot(p,`${id}-${width}-${color}-${reduce}`),state:await info(p)};await appearance(p);await p.keyboard.press('Escape');await p.waitForTimeout(400);if(await p.getByRole('dialog',{name:'更多导航',exact:true}).isVisible())await p.keyboard.press('Escape');return {home,end:await info(p)}});await c.close()
  }
}
if(suite==='failure'){
  const {c,p}=await context({baseURL:state.dev});const blocked=[],errors=[]
  p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text().slice(0,700))})
  await p.route('**/themes/dock/**',r=>{blocked.push(r.request().url());return r.abort()})
  await run('cold dock module unavailable',async()=>{
    await p.goto('/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(8000);const failed={image:await shot(p,'module-failure'),state:await info(p),blocked:[...blocked],errors:[...errors]}
    let themeAttempt='入口不可操作'
    if(await p.getByRole('button',{name:'界面设置',exact:true}).isEnabled()){try{await appearance(p);await p.getByRole('button',{name:'Dock 浮岛 布局主题',exact:true}).click();await p.waitForTimeout(1500);themeAttempt=await info(p)}catch(e){themeAttempt=e.message.slice(0,300)}}
    await p.unroute('**/themes/dock/**');await p.reload();await ready(p);return {failed,themeAttempt,recovered:{image:await shot(p,'module-restored'),state:await info(p)}}
  });await c.close()
}
if(suite==='search-key'){
  for(const method of ['keyboard','mouse']){
    const {c,p}=await context();await p.goto('/');await ready(p)
    await run(`search result ${method}`,async()=>{
      await p.getByRole('button',{name:'搜索站内文章、标签...',exact:true}).click();await p.getByRole('textbox',{name:'搜索文章、项目和友链',exact:true}).fill('分页样本 105');await expect(p.locator('.search-modal__item')).toHaveCount(1)
      await p.evaluate(()=>{window.__keyLog=[];for(const type of ['keydown','keyup','click','focusin'])document.addEventListener(type,e=>window.__keyLog.push({type,key:e.key,at:performance.now(),target:e.target.outerHTML?.slice(0,260)}),true)})
      const snaps=await frames(p,method,()=>method==='keyboard'?p.getByRole('textbox',{name:'搜索文章、项目和友链',exact:true}).press('Enter'):p.locator('.search-modal__item').click());return {snaps,events:await p.evaluate(()=>window.__keyLog)}
    });await c.close()
  }
}
if(suite==='reading'||suite==='reading-spa'){
  const fixture=JSON.parse(readFileSync(`${out}/supplement/results.json`)).find(r=>r.name.startsWith('seed')).detail
  const {c,p}=await context({reducedMotion:'reduce'});await p.goto('/');await ready(p)
  for(const id of ['nexus','aurora','dock'])await run('reading '+id,async()=>{
    await p.goto('/');await ready(p);if(!await p.locator('.theme-'+id).count())await theme(p,id)
    await p.goto('/articles/'+fixture.articleId);await ready(p);await expect(p.locator('.article-reading-content')).toBeVisible()
    await p.locator('.article-reading-content').evaluate(e=>{let root=e.parentElement;while(root&&!(root.scrollHeight>root.clientHeight+30&&['auto','scroll'].includes(getComputedStyle(root).overflowY)))root=root.parentElement;if(root)root.scrollTop=1800;else window.scrollTo({top:1800,behavior:'instant'})});await p.waitForTimeout(600)
    const positions=()=>p.evaluate(()=>({window:scrollY,roots:[...document.querySelectorAll('[class*="viewport"]')].filter(e=>e.scrollHeight>e.clientHeight+30).map(e=>({cls:e.className,top:e.scrollTop})),progress:document.querySelector('.reading-progress__bar')?.getAttribute('style')}))
    const before=await positions();await p.getByRole('link',{name:'项目',exact:true}).click();await ready(p);await p.goBack();await ready(p);const returned=await positions()
    const anchor=p.locator('a[href^="#"]').filter({hasText:'审查章节 12'}).first()
    if(!await anchor.isVisible()){const entry=p.getByRole('button',{name:'文章目录',exact:true});if(await entry.isVisible())await entry.click()}
    let heading=null
    if(await anchor.isVisible()){await anchor.click();await p.waitForTimeout(500);heading=await p.evaluate(()=>({hash:location.hash,rect:[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('审查章节 12'))?.getBoundingClientRect().toJSON()}))}
    const image=await shot(p,'reading-'+id);await p.keyboard.press('Escape');await p.mouse.click(650,500);const beforeKey=await positions();await p.keyboard.press('j');await p.waitForTimeout(500);return {before,returned,heading,image,beforeKey,afterKey:await positions(),state:await info(p)}
  })
  await c.close()
}
if(suite==='supplement'){
  const {c,p}=await context({reducedMotion:'reduce'});await p.goto('/');await ready(p)
  await run('auth subview corrected target',async()=>{
    await p.goto('/flash');await ready(p);const open=await frames(p,'auth-open',()=>p.getByRole('button',{name:/正在浏览博主的公开闪念/}).click());await p.getByRole('button',{name:'登录帮助',exact:true}).click();await p.waitForTimeout(450);const help={image:await shot(p,'auth-help'),state:await info(p)};await p.getByRole('button',{name:'返回登录',exact:true}).click();await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(300);return {open,help,closed:await info(p)}
  })
  let articleId,flashId
  await run('seed disposable long article and flash images',async()=>{
    const response=await p.request.post('/api/v1/auth/login',{data:{username:state.username,password:state.password},headers:{Origin:state.prod}});if(!response.ok())throw Error('隔离fixture认证失败 '+response.status());const access=(await response.json()).data.accessToken
    const headers={Authorization:`Bearer ${access}`,Origin:state.prod}
    const body={title:'动效审查长文',summary:'仅隔离测试',status:'published',folder:'示例专栏',category:'tech',contentRaw:Array.from({length:18},(_,i)=>`## 审查章节 ${i+1}\n\n`+('用于检查目录定位、阅读进度与历史滚动恢复。'.repeat(24))).join('\n\n'),tags:['示例标签']}
    const article=await p.request.post('/api/v1/admin/posts',{data:body,headers});if(!article.ok())throw Error('长文创建失败 '+article.status());articleId=(await article.json()).data.id
    const flash=await p.request.post('/api/v1/admin/flashes',{data:{content:'动效审查图片闪念',images:[state.prod+'/avatar-photo.webp',state.prod+'/avatar-photo.webp?second'],tags:['动效'],type:'memo'},headers});if(!flash.ok())throw Error('闪念创建失败 '+flash.status());flashId=(await flash.json()).data.id
    return {articleId,flashId,database:'本轮程序创建的随机隔离库；结束销毁'}
  })
  await run('flash image lightbox keyboard and failure',async()=>{
    await p.goto('/flash/'+flashId);await ready(p);const open=await frames(p,'flash-lightbox',()=>p.getByRole('button',{name:'预览图片：1',exact:true}).click());await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);const next=await info(p);await p.keyboard.press('Escape');await p.waitForTimeout(400);return {open,next,closed:await info(p)}
  })
  await run('long reading scroll anchors interruption and history',async()=>{
    const samples=[]
    for(const id of ['nexus','aurora','dock']){
      await p.goto('/articles/'+articleId);await ready(p);await theme(p,id);await p.waitForTimeout(300)
      const vp=p.locator('.article-scrollbar .custom-scrollbar__viewport');const roots=await p.locator('[class*="viewport"]').evaluateAll(es=>es.filter(e=>e.scrollHeight>e.clientHeight+40).map(e=>({cls:e.className,height:e.clientHeight,scrollHeight:e.scrollHeight})))
      const scroll=p.locator('.article-reading-content').locator('..');await p.locator('.article-reading-content').evaluate(e=>{let root=e.parentElement;while(root&&!(root.scrollHeight>root.clientHeight+30&&['auto','scroll'].includes(getComputedStyle(root).overflowY)))root=root.parentElement;if(root)root.scrollTop=Math.min(1800,root.scrollHeight-root.clientHeight);else window.scrollTo({top:1800,behavior:'instant'})});await p.waitForTimeout(500)
      const before=await p.evaluate(()=>({root:[...document.querySelectorAll('[class*="viewport"]')].map(e=>({cls:e.className,top:e.scrollTop})),window:scrollY,progress:document.querySelector('.reading-progress__bar')?.getAttribute('style')}));const image=await shot(p,'reading-'+id)
      const anchor=p.locator('.toc-item a,.toc-link,a[href^="#"]').filter({hasText:'审查章节 12'}).first()
      let anchorState=null
      if(await anchor.isVisible()){await anchor.click();await p.waitForTimeout(400);anchorState=await p.evaluate(()=>({hash:location.hash,heading:[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('审查章节 12'))?.getBoundingClientRect().toJSON()}))}
      await p.goto('/projects');await ready(p);await p.goBack();await p.waitForTimeout(1000);samples.push({id,roots,before,image,anchorState,returned:await info(p),positions:await p.locator('[class*="viewport"]').evaluateAll(es=>es.map(e=>({cls:e.className,top:e.scrollTop})))})
    }
    return samples
  })
  await run('touch context drawer at narrow viewport',async()=>{
    const mobile=await browser.newContext({baseURL:state.prod,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const page=await mobile.newPage();await page.goto('/');await ready(page);await page.getByRole('button',{name:'筛选文章',exact:true}).tap();await page.getByRole('button',{name:'关闭筛选文章',exact:true}).tap();await page.waitForTimeout(300);const image=await shot(page,'touch-context');const final=await info(page);await mobile.close();return {image,final}
  })
  await c.close()
}
if(suite==='ab'){
  const f=`${work}/frontend/app/layouts/default.vue`,original=readFileSync(f,'utf8')
  try{
    for(const noWrapper of [false,true]){
      writeFileSync(f,noWrapper?original.replace(':transition="contentTransition"',':transition="false"'):original)
      for(let repetition=0;repetition<3;repetition++){
        const {c,p}=await context({baseURL:state.dev,reducedMotion:'reduce'})
        await run(`isolated dev transitionFalse=${noWrapper} repeat=${repetition}`,async()=>{
          await p.goto('/');await ready(p);const boxes={};for(const name of ['归档','项目','主页'])boxes[name]=await p.getByRole('link',{name,exact:true}).boundingBox()
          for(let i=0;i<5;i++)for(const name of ['归档','项目','主页']){const b=boxes[name];await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.waitForTimeout(30)}
          await p.waitForTimeout(4000);return {state:await info(p),image:await shot(p,`ab-${noWrapper}-${repetition}`)}
        });await c.close()
      }
    }
  }finally{writeFileSync(f,original)}
}
if(suite==='components'){
  const {c,p}=await context({reducedMotion:'reduce'});await p.goto('/');await ready(p)
  await run('login modal subview motion',async()=>{
    await p.goto('/flash');await ready(p);const open=await frames(p,'auth-open',()=>p.getByRole('button',{name:'立即登录',exact:true}).click());await p.getByRole('button',{name:'登录帮助',exact:true}).click();await p.waitForTimeout(500);const help={image:await shot(p,'auth-help'),state:await info(p)};await p.keyboard.press('Escape');await p.waitForTimeout(350);return {open,help,closed:await info(p)}
  })
  await run('moments like comment lightbox topic detail',async()=>{
    await p.goto('/moments');await ready(p);await resetEvents(p);await p.getByRole('button',{name:'点赞',exact:true}).first().click();await p.waitForTimeout(650);const liked={image:await shot(p,'moment-liked'),state:await info(p)}
    await p.locator('.moment-card__actions').first().locator('button').first().click();await p.waitForTimeout(400);const comments=await info(p)
    const photo=p.locator('.moment-card__image-wrap').first();await photo.scrollIntoViewIfNeeded();const lightbox=await frames(p,'moment-lightbox',()=>photo.click());await p.keyboard.press('ArrowRight');await p.keyboard.press('Escape');await p.waitForTimeout(350)
    await p.locator('.moment-card__time').first().click();await p.waitForTimeout(800);const detail={image:await shot(p,'moment-detail'),state:await info(p)}
    await p.goto('/moments');await ready(p);await p.locator('.moment-card__topic-tag').first().click();await p.waitForTimeout(800);return {liked,comments,lightbox,detail,topic:{image:await shot(p,'moment-topic'),state:await info(p)}}
  })
  await run('bookmark add settings nested import and drag',async()=>{
    await login(p);await p.goto('/tabs');await ready(p);await p.getByRole('button',{name:'添加',exact:true}).click();const dialog=p.getByRole('dialog').filter({hasText:'添加书签'});await dialog.getByRole('textbox',{name:'名称',exact:true}).fill('动效审查书签');await dialog.getByRole('textbox',{name:'网址',exact:true}).fill('https://example.com/motion-audit');const add=await frames(p,'bookmark-add',()=>dialog.getByRole('button',{name:'添加',exact:true}).click())
    const bm=p.locator('.tab-bm');const dragBefore=await bm.allTextContents();if(await bm.count()>1){const a=await bm.first().boundingBox(),b=await bm.nth(1).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await p.waitForTimeout(250);await p.mouse.up();await p.waitForTimeout(500)}const dragAfter=await bm.allTextContents()
    await p.getByRole('button',{name:'设置',exact:true}).click();await p.getByRole('dialog',{name:'标签页设置'}).getByRole('button',{name:'数据',exact:true}).click();const nested=await frames(p,'bookmark-import',()=>p.getByRole('button',{name:/导入数据/}).click());await p.keyboard.press('Escape');await p.waitForTimeout(300);const firstClose=await info(p);await p.keyboard.press('Escape');await p.waitForTimeout(350);return {add,dragBefore,dragAfter,nested,firstClose,closed:await info(p)}
  })
  await run('isolated flash loading comments lightbox and detail',async()=>{
    await p.goto('/flash');await ready(p);await p.getByRole('textbox',{name:'闪念正文',exact:true}).fill('动效审查闪念：仅隔离数据库');const published=await frames(p,'flash-publish',()=>p.getByRole('button',{name:'发布闪念',exact:true}).click());const card=p.locator('.fnc').filter({hasText:'动效审查闪念：仅隔离数据库'});await expect(card).toBeVisible();const id=(await card.getAttribute('id')).replace('flash-note-','');await card.getByRole('button',{name:'评论',exact:true}).click();await p.waitForTimeout(350);const comments=await info(p);await p.getByRole('button',{name:'搜索闪念',exact:true}).click();await p.getByRole('textbox',{name:'搜索闪念内容或标签',exact:true}).fill('动效审查');await p.waitForTimeout(500);await p.keyboard.press('Escape');await p.goto('/flash/'+id);await ready(p);return {published,comments,detail:{image:await shot(p,'flash-detail'),state:await info(p)},id}
  })
  await c.close()
}
if(suite==='race'){
  for(const [preset,reduce,gap] of [['纵向滑动',false,30],['纵向滑动',false,120],['纵向滑动',false,300],['关闭动画',false,30],['关闭动画',false,120],['关闭动画',true,30]]){
    const {c,p}=await context({reducedMotion:reduce?'reduce':'no-preference'});await p.goto('/');await ready(p)
    await run(`real pointer ${preset} reduce=${reduce} gap=${gap}`,async()=>{
      await appearance(p);await p.getByRole('heading',{name:'主内容切换',exact:true}).locator('..').locator('..').getByRole('button',{name:preset,exact:true}).click();await p.keyboard.press('Escape');await p.waitForTimeout(400)
      const boxes={};for(const name of ['归档','项目','主页'])boxes[name]=await p.getByRole('link',{name,exact:true}).boundingBox()
      for(let i=0;i<5;i++)for(const name of ['归档','项目','主页']){const b=boxes[name];await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.waitForTimeout(gap)}
      await p.waitForTimeout(5000);const final={state:await info(p),image:await shot(p,`pointer-${preset}-${reduce}-${gap}`)}
      await appearance(p);const settingsWorks=await p.getByRole('dialog',{name:'界面设置',exact:true}).isVisible();await p.keyboard.press('Escape');await p.waitForTimeout(400)
      await p.getByRole('link',{name:'关于',exact:true}).click();await p.waitForTimeout(1600);return {final,settingsWorks,afterNextNavigation:await info(p)}
    });await c.close()
  }
}
if(suite==='edge'){
  const {c,p}=await context();await p.goto('/');await ready(p)
  await run('cancelled navigation restores sidebar',async()=>{
    const baseline=await info(p)
    const supported=await p.evaluate(()=>{const app=document.querySelector('#__nuxt')?.__vue_app__;const router=app?.config.globalProperties.$router;if(!router)return false;window.__removeAuditGuard=router.beforeEach(to=>to.path==='/archive'?false:undefined);return true})
    if(!supported)throw Error('未获取路由实例，取消导航注入未执行')
    await p.getByRole('link',{name:'归档',exact:true}).click();await p.waitForTimeout(800)
    const cancelled={image:await shot(p,'cancelled-sidebar'),state:await info(p)}
    await p.evaluate(()=>window.__removeAuditGuard());await p.reload();await ready(p)
    return {baseline,cancelled}
  })
  await run('reduced settings search and pagination still animate',async()=>{
    await p.emulateMedia({reducedMotion:'reduce'});await resetEvents(p)
    await appearance(p);await p.waitForTimeout(400);await p.keyboard.press('Escape');await p.waitForTimeout(400)
    await p.getByRole('button',{name:'搜索站内文章、标签...',exact:true}).click();await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(300)
    await p.getByRole('button',{name:'下一页',exact:true}).click();await p.waitForTimeout(700)
    return {image:await shot(p,'reduced-pagination'),state:await info(p)}
  })
  await run('broken image reveal timing',async()=>{
    await p.route('**/images.unsplash.com/**',r=>r.abort());await p.goto('/gallery');await ready(p)
    const output={image:await shot(p,'gallery-images-fail'),state:await info(p),images:await p.locator('.gallery-grid img').evaluateAll(es=>es.map(e=>({complete:e.complete,width:e.naturalWidth,animation:getComputedStyle(e).animationName}))) };await p.unroute('**/images.unsplash.com/**');return output
  })
  await run('reduce guestbook new message and count-up',async()=>{
    await p.goto('/guestbook');await ready(p);await resetEvents(p)
    await p.getByRole('textbox',{name:'演示留言内容',exact:true}).fill('动效审查：仅本页演示')
    await p.getByRole('button',{name:'添加演示留言',exact:true}).click()
    const identity=p.getByRole('textbox',{name:'昵称 *',exact:true})
    if(await identity.isVisible()){await identity.fill('动效审查');await p.getByRole('button',{name:'确认身份',exact:true}).click()}
    await p.waitForTimeout(600)
    return {image:await shot(p,'reduced-message'),state:await info(p)}
  })
  await run('tooltip keyboard escape and scroll',async()=>{
    await p.goto('/');await ready(p);await p.getByRole('button',{name:'连续加载',exact:true}).focus();await p.waitForTimeout(250)
    const before=await p.getByRole('tooltip').allTextContents();await p.keyboard.press('Escape');await p.waitForTimeout(200);const after=await p.getByRole('tooltip').allTextContents();return {before,after,image:await shot(p,'tooltip-escape')}
  })
  await run('mobile breakpoints drawer and navigation',async()=>{
    const checks=[]
    for(const width of [320,375,767,768,1023,1024,1439,1440,1920]){
      await p.setViewportSize({width,height:900});await p.goto('/');await ready(p);await appearance(p);await p.keyboard.press('Escape');await p.waitForTimeout(300);if(await p.getByRole('dialog',{name:'更多导航',exact:true}).isVisible())await p.keyboard.press('Escape')
      checks.push({width,image:await shot(p,'breakpoint-'+width),state:await info(p),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})
    }
    return checks
  })
  await c.close()
}
if(suite==='development'){
  for(const [name,url] of [['user-dev','http://localhost:3456'],['isolated-dev',state.dev]]){
    const {c,p}=await context({baseURL:url})
    await run(name+' entry reload navigation',async()=>{
      const start=Date.now();await p.goto('/');await ready(p);const first={ms:Date.now()-start,image:await shot(p,name+'-entry'),state:await info(p)}
      await p.reload();await ready(p);const repeat=await info(p);await p.getByRole('link',{name:'归档',exact:true}).click();await p.waitForTimeout(900);await p.getByRole('link',{name:'主页',exact:true}).click();await p.waitForTimeout(900);return {first,repeat,end:await info(p)}
    })
    if(name==='isolated-dev'){
      for(const [file,edit] of [
        ['app/components/common/AppearanceDrawer.vue',s=>s.replace('<style lang="scss" scoped>','<style lang="scss" scoped>\n.appearance-drawer { --motion-audit-hmr: 1; }')],
        ['app/components/common/AppearanceDrawer.vue',s=>s.replace('<script setup lang="ts">','<script setup lang="ts">\nvoid "motion-audit-script-hmr"')],
        ['themes/nexus/app/components/RootLayout.vue',s=>s.replace('class="page-root theme-nexus"','class="page-root theme-nexus" data-motion-audit="hmr"')],
      ])await run('HMR '+file+' '+edit.toString().slice(0,70),async()=>{
        await p.goto('/');await ready(p);await appearance(p)
        const f=`${work}/frontend/${file}`,original=readFileSync(f,'utf8');const changed=edit(original);if(changed===original)throw Error('HMR替换未命中')
        try{writeFileSync(f,changed);await p.waitForTimeout(2200);const during={image:await shot(p,'hmr-'+results.length),state:await info(p)};await p.keyboard.press('Escape');await p.waitForTimeout(500);return {during,closed:await info(p)}}finally{writeFileSync(f,original);await p.waitForTimeout(1700)}
      })
      await run('configuration restart reconnect',async()=>{
        const f=`${work}/frontend/nuxt.config.ts`,original=readFileSync(f,'utf8')
        try{writeFileSync(f,original+'\n// 动效审查：触发独立开发服务配置重载\n');await p.waitForTimeout(12000);await p.reload();await ready(p);await appearance(p);await p.keyboard.press('Escape');await p.waitForTimeout(400);return {image:await shot(p,'dev-reconnect'),state:await info(p)}}finally{writeFileSync(f,original);await p.waitForTimeout(8000)}
      })
    }
    await c.close()
  }
}
if(suite==='performance'||suite==='listener'){
  const {c,p}=await context();await p.goto('/');await ready(p);const client=await c.newCDPSession(p)
  await client.send('Performance.enable')
  if(suite==='performance')await run('repeated modal and route resource counters',async()=>{
    await client.send('HeapProfiler.collectGarbage');const before=await client.send('Memory.getDOMCounters');const heapBefore=await client.send('Performance.getMetrics')
    const checkpoints=[]
    for(let i=0;i<30;i++){
      await appearance(p);await p.keyboard.press('Escape');await p.waitForTimeout(300)
      if(i%5===0){await p.getByRole('link',{name:'归档',exact:true}).click();await p.waitForTimeout(500);await p.getByRole('link',{name:'主页',exact:true}).click();await p.waitForTimeout(500);await client.send('HeapProfiler.collectGarbage');checkpoints.push({i,counters:await client.send('Memory.getDOMCounters')})}
    }
    await p.waitForTimeout(2500);await client.send('HeapProfiler.collectGarbage');return {before,heapBefore,checkpoints,after:await client.send('Memory.getDOMCounters'),heapAfter:await client.send('Performance.getMetrics'),state:await info(p)}
  })
  await run('color toggles media listener lifetime',async()=>{
    await appearance(p);await p.getByRole('button',{name:'无动画',exact:true}).click();await p.waitForTimeout(300)
    await p.evaluate(()=>{
      const add=MediaQueryList.prototype.addEventListener,remove=MediaQueryList.prototype.removeEventListener,ids=new WeakMap();let id=0;window.__mediaLedger={added:[],removed:[]}
      MediaQueryList.prototype.addEventListener=function(type,listener,...rest){if(!ids.has(listener))ids.set(listener,++id);window.__mediaLedger.added.push({id:ids.get(listener),type,media:this.media});return add.call(this,type,listener,...rest)}
      MediaQueryList.prototype.removeEventListener=function(type,listener,...rest){window.__mediaLedger.removed.push({id:ids.get(listener),type,media:this.media});return remove.call(this,type,listener,...rest)}
    })
    await client.send('HeapProfiler.collectGarbage');const before=await client.send('Memory.getDOMCounters')
    for(let i=0;i<30;i++){await p.getByRole('button',{name:i%2?'深色':'浅色',exact:true}).click();await p.waitForTimeout(30)}
    await p.keyboard.press('Escape');await p.waitForTimeout(600);await client.send('HeapProfiler.collectGarbage');const ledger=await p.evaluate(()=>window.__mediaLedger);return {before,after:await client.send('Memory.getDOMCounters'),ledger}
  })
  if(suite==='performance')for(const cpu of [1,4])await run('frame sample CPU '+cpu,async()=>{
    await client.send('Emulation.setCPUThrottlingRate',{rate:cpu});await resetEvents(p)
    await client.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing',transferMode:'ReturnAsStream'})
    const sampling=p.evaluate(()=>new Promise(resolve=>{let last=performance.now();const start=last,intervals=[];function frame(now){intervals.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(frame);else resolve({duration:now-start,intervals})}requestAnimationFrame(frame)}))
    await appearance(p);await p.waitForTimeout(450);await p.keyboard.press('Escape');await p.waitForTimeout(350);await p.getByRole('link',{name:'归档',exact:true}).click();await p.waitForTimeout(700);await p.getByRole('link',{name:'主页',exact:true}).click()
    const frame=await sampling;const complete=new Promise(resolve=>client.once('Tracing.tracingComplete',resolve));await client.send('Tracing.end');const {stream}=await complete;let trace='';for(;;){const chunk=await client.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break}await client.send('IO.close',{handle:stream});writeFileSync(`${out}/performance/cpu-${cpu}-trace.json`,trace)
    return {cpu,frame,state:await info(p),trace:`performance/cpu-${cpu}-trace.json`}
  })
  await c.close()
}
if(suite==='themes'){
  const {c,p}=await context();await p.goto('/');await ready(p)
  for(const preset of ['圆形展开','平滑渐变','模糊深度','无动画'])await run('color preset '+preset,async()=>{
    await appearance(p);await p.getByRole('button',{name:preset,exact:true}).click();const snapshots=await frames(p,'color-'+preset,()=>p.getByRole('button',{name:'浅色',exact:true}).click());await p.getByRole('button',{name:'深色',exact:true}).click();await p.waitForTimeout(700);await p.keyboard.press('Escape');await p.waitForTimeout(350);return snapshots
  })
  await run('follow system live',async()=>{await appearance(p);await p.getByRole('button',{name:'跟随系统',exact:true}).click();await p.waitForTimeout(700);await p.emulateMedia({colorScheme:'light'});await p.waitForTimeout(500);const light=await info(p);await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(500);const dark=await info(p);await p.keyboard.press('Escape');return {light,dark}})
  for(const id of ['aurora','dock','nexus'])await run('layout switch '+id,async()=>{const snap=await frames(p,'layout-'+id,()=>theme(p,id));return {snap,end:await info(p)}})
  await run('view transition unsupported fallback',async()=>{await p.evaluate(()=>{document.startViewTransition=undefined});await appearance(p);await p.getByRole('button',{name:'浅色',exact:true}).click();await p.waitForTimeout(500);const result=await info(p);await p.keyboard.press('Escape');return result})
  await p.reload();await ready(p)
  await run('rapid keyboard color changes',async()=>{await appearance(p);await p.getByRole('button',{name:'圆形展开',exact:true}).click();await resetEvents(p);for(let i=0;i<8;i++)await p.getByRole('button',{name:i%2?'深色':'浅色',exact:true}).press('Enter');await p.waitForTimeout(900);const end=await info(p);await p.keyboard.press('Escape');return end})
  await run('reduced motion Aurora carousel',async()=>{await theme(p,'aurora');await p.emulateMedia({reducedMotion:'reduce'});await p.goto('/');await ready(p);const samples=[];for(let i=0;i<4;i++){samples.push(await p.locator('.aurora-hero__bg').evaluateAll(es=>es.map(e=>({image:e.style.backgroundImage,transform:getComputedStyle(e).transform,transition:getComputedStyle(e).transition}))));await p.waitForTimeout(1100)}return {samples,image:await shot(p,'aurora-reduced-rotation'),state:await info(p)}})
  await c.close()
}
}finally{await browser.close();writeFileSync(`${out}/${suite}/results.json`,JSON.stringify(results,null,2))}
