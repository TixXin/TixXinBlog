/**
 * @file validate-runtime.mjs
 * @description 隔离开发环境的启动/运行期资源失败、热更新和恢复验证
 */
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const work='D:/Projects/TixXinBlog/.codex/motion-fixes',state=JSON.parse(readFileSync(`${work}/state.json`))
if(state.status!=='ready')throw Error('隔离环境未启动')
process.kill(state.ownerPid,0)
const require=createRequire(`${work}/frontend/package.json`),{chromium,expect}=require('@playwright/test')
const suite=process.argv[2]||'faults',output=`${work}/evidence/${suite}`
mkdirSync(output,{recursive:true})
const browser=await chromium.launch(),results=[]
const context=await browser.newContext({baseURL:state.dev,viewport:{width:1440,height:1000}}),page=await context.newPage()
page.setDefaultTimeout(15000)
async function ready(p=page){await expect(p.locator('html')).toHaveClass(/app-client-ready/,{timeout:30000});await expect(p.locator('.loading-screen:visible')).toHaveCount(0)}
async function check(name,fn){try{const detail=await fn();results.push({name,status:'passed',detail});console.log('PASS '+name)}catch(e){results.push({name,status:'failed',error:e.message});console.log('FAIL '+name+' '+e.message.split('\n')[0])}writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2))}
async function shot(name,p=page){await p.waitForTimeout(650);await p.screenshot({path:`${output}/${name}.png`,animations:'allow'});return `${suite}/${name}.png`}
async function inspect(p=page){return p.evaluate(()=>({url:location.href,title:document.title,cards:document.querySelectorAll('.post-item').length,inert:document.querySelectorAll('#__nuxt[inert]').length,dialogs:document.querySelectorAll('[role="dialog"]').length,overflow:document.body.style.overflow,focus:document.activeElement?.getAttribute('aria-label')}))}
try{
 if(suite==='faults'){
  await check('非当前主题不进入启动依赖，运行期失败保留当前布局且可导航',async()=>{
   const blocked=[]
   await page.route('**/themes/dock/**',route=>{blocked.push(route.request().url());return route.abort()})
   await page.goto('/');await ready()
   // Vite在其他会话访问主题后可能附带已收集的CSS；这些失败不得阻断当前应用。
   const startupBlocked = [...blocked]
   expect(startupBlocked.filter(url=>!url.includes('type=style'))).toHaveLength(0)
   await expect(page.locator('.post-item')).toHaveCount(15)
   await page.getByRole('button',{name:'界面设置',exact:true}).click()
   await page.getByRole('button',{name:'Dock 浮岛 布局主题',exact:true}).click()
   await expect(page.getByText(/主题加载失败，当前布局已保留/)).toBeVisible()
   expect(blocked.length).toBeGreaterThan(0)
   await expect(page.locator('.theme-nexus')).toBeVisible()
   await page.getByRole('link',{name:'归档',exact:true}).click()
   await expect(page.locator('main')).toContainText('文章归档')
   const failed=await shot('optional-failure')
   await page.unroute('**/themes/dock/**');await page.goto('/');await ready()
   await page.getByRole('button',{name:'界面设置',exact:true}).click();await page.getByRole('button',{name:'Dock 浮岛 布局主题',exact:true}).click()
   await expect(page.locator('.theme-dock')).toBeVisible();await ready()
   return {startupBlocked,blocked,failed,recovered:await inspect()}
  })
  await check('当前主题失败保留只读SSR内容，刷新后恢复',async()=>{
   const isolated=await browser.newContext({baseURL:state.dev,viewport:{width:1440,height:1000}}),p=await isolated.newPage();const blocked=[]
   try{
    await p.route('**/themes/nexus/**',route=>{blocked.push(route.request().url());return route.abort()})
    await p.goto('/');await expect(p.locator('.theme-static-content')).toBeVisible({timeout:20000})
    await expect(p.locator('.theme-static-content .post-item')).toHaveCount(15)
    await expect(p.locator('.theme-static-content button:not([disabled])')).toHaveCount(0)
    expect(blocked.length).toBeGreaterThan(0)
    const failed=await shot('required-failure',p)
    await p.unroute('**/themes/nexus/**')
    await p.getByRole('link',{name:'刷新重试',exact:true}).first().click();await ready(p)
    await expect(p.locator('.theme-static-content')).toHaveCount(0)
    await p.getByRole('button',{name:'界面设置',exact:true}).click();await expect(p.getByRole('dialog',{name:'界面设置'})).toBeVisible()
    return {blocked,failed,recovered:await inspect(p)}
   }finally{await isolated.close()}
  })
  await check('入口脚本失败时独立恢复提示可用，SSR文章仍可读',async()=>{
   const reader=await browser.newContext({baseURL:state.prod,javaScriptEnabled:false}),r=await reader.newPage();await r.goto('/')
   const entry=await r.locator('script[type="module"][src]').first().getAttribute('src');expect(entry).toBeTruthy();await expect(r.locator('.loading-screen:visible')).toHaveCount(0);await expect(r.locator('.post-item')).toHaveCount(15);await reader.close()
   const isolated=await browser.newContext({baseURL:state.prod,viewport:{width:1440,height:1000}}),p=await isolated.newPage();const blocked=[]
   try{
    await p.route(url=>url.pathname===new URL(entry,state.prod).pathname,route=>{blocked.push(route.request().url());return route.abort()})
    await p.goto('/');await expect(p.locator('.loading-screen__recovery')).toBeVisible({timeout:16000});expect(blocked.length).toBeGreaterThan(0)
    await expect(p.locator('.post-item')).toHaveCount(15)
    expect(await p.locator('.loading-screen').evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none')
    const failed=await shot('entry-failure',p)
    await p.unrouteAll();await p.locator('.loading-screen__recovery a').click();await ready(p)
    return {entry,blocked,failed,recovered:await inspect(p)}
   }finally{await isolated.close()}
  })
 }
 if(suite==='hmr'){
  await page.goto('/');await ready()
  for(const [label,file,edit] of [
   ['css','app/components/common/AppearanceDrawer.vue',s=>s.replace('<style lang="scss" scoped>','<style lang="scss" scoped>\n.appearance-drawer { --motion-hmr-check: 1; }')],
   ['component','app/components/common/AppearanceDrawer.vue',s=>s.replace('<script setup lang="ts">','<script setup lang="ts">\nvoid "motion-component-check"')],
   ['layout','themes/nexus/app/components/RootLayout.vue',s=>s.replace('class="page-root theme-nexus"','class="page-root theme-nexus" data-motion-hmr="checked"')],
   ['modal-composable','app/composables/useModalFocus.ts',s=>s+'\n// 动效验收：热替换活动模态焦点模块\n'],
   ['motion-composable','app/composables/useMotionPreference.ts',s=>s+'\n// 动效验收：热替换共享偏好模块\n'],
  ])await check('HMR '+label,async()=>{
   await page.goto('/');await ready();await page.getByRole('button',{name:'界面设置',exact:true}).click()
   const path=`${work}/frontend-dev/${file}`,original=readFileSync(path,'utf8'),changed=edit(original);expect(changed).not.toBe(original)
   try{
    writeFileSync(path,changed);await page.waitForTimeout(2200)
    if(await page.getByRole('dialog',{name:'界面设置'}).count())await page.getByRole('button',{name:'关闭界面设置',exact:true}).click()
    await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
    await page.getByRole('link',{name:'归档',exact:true}).click();await expect(page.locator('main')).toContainText('文章归档')
    return {image:await shot(label),state:await inspect()}
   }finally{writeFileSync(path,original);await page.waitForTimeout(1200)}
  })
  await check('共享主题子组件热更新后新SSR请求也使用新模板',async()=>{
   await context.addCookies([{name:'tixxin-blog-layout-theme',value:'dock',url:state.dev}])
   await page.goto('/about');await ready()
   const path=`${work}/frontend-dev/app/components/layout/StatusFooter.vue`,original=readFileSync(path,'utf8')
   const errors=[]
   const listener=message=>{if(/Hydration|\[Vue warn\]/.test(message.text()))errors.push(message.text())}
   page.on('console',listener)
   try{
    writeFileSync(path,original.replace('class="footer__status"','class="footer__status" data-motion-hmr="fresh-ssr"'))
    await page.waitForTimeout(1400);await page.reload();await ready()
    await expect(page.locator('.footer__status')).toHaveAttribute('data-motion-hmr','fresh-ssr')
    expect(errors).toEqual([])
    const updated=await shot('footer-fresh-ssr')
    writeFileSync(path,original);await page.waitForTimeout(1400);await page.reload();await ready()
    await expect(page.locator('.footer__status[data-motion-hmr]')).toHaveCount(0)
    expect(errors).toEqual([])
    return {updated,errors,state:await inspect()}
   }finally{writeFileSync(path,original);page.off('console',listener);await context.addCookies([{name:'tixxin-blog-layout-theme',value:'nexus',url:state.dev}])}
  })
  await check('文章请求作用域热更新后可继续导航',async()=>{
   await context.addCookies([{name:'tixxin-blog-layout-theme',value:'nexus',url:state.dev}])
   await page.goto('/articles/105');await ready()
   await page.getByRole('button',{name:'界面设置',exact:true}).click()
   const path=`${work}/frontend-dev/app/composables/usePageRequestScope.ts`,original=readFileSync(path,'utf8')
   try{
    writeFileSync(path,original+'\n// 验收：页面请求所有者热替换\n');await page.waitForTimeout(2200)
    if(await page.getByRole('dialog',{name:'界面设置'}).count())await page.keyboard.press('Escape')
    await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
    await page.getByRole('link',{name:'归档',exact:true}).click();await expect(page.locator('main')).toContainText('文章归档')
    return {image:await shot('page-request-scope'),state:await inspect()}
   }finally{writeFileSync(path,original);await page.waitForTimeout(1200)}
  })
  await check('配置重启后重新连接',async()=>{
   const path=`${work}/frontend-dev/nuxt.config.ts`,original=readFileSync(path,'utf8')
   try{writeFileSync(path,original+'\n// 动效验收：配置重载\n');await page.waitForTimeout(10000);await page.reload();await ready();await page.getByRole('link',{name:'主页',exact:true}).click();await expect(page.locator('.post-item')).toHaveCount(15);return {image:await shot('reconnect'),state:await inspect()}}finally{writeFileSync(path,original)}
  })
 }
}finally{await browser.close();writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='failed')?1:0}
