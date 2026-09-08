/**
 * @file performance.mjs
 * @description 同一负载、设备与浏览器的整改前后性能采样，每种CPU条件重复三轮
 */
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import os from 'node:os'
const work='D:/Projects/TixXinBlog/.codex/motion-fixes',state=JSON.parse(readFileSync(`${work}/state.json`))
if(state.status!=='ready')throw Error('隔离环境未就绪')
const stage=process.argv[2]
if(!['before','after'].includes(stage))throw Error('指定before或after')
const require=createRequire(`${work}/frontend/package.json`),{chromium,expect}=require('@playwright/test')
const browser=await chromium.launch(),baseURL=stage==='before'?state.before:state.prod
const noBlur=process.argv.includes('--no-blur')
const output=`${work}/evidence/performance-${stage}${noBlur?'-no-blur':''}`;mkdirSync(output,{recursive:true})
const results=[]
function percentile(values,fraction){return values[Math.floor((values.length-1)*fraction)]}
try{
 for(const cpu of [1,4])for(let repetition=1;repetition<=3;repetition++){
  const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'no-preference'})
  await context.addInitScript(()=>{
   Math.random=()=>0.5
   window.motionPerformance={longtasks:[],shifts:[]}
   for(const type of ['longtask','layout-shift'])new PerformanceObserver(list=>{
    for(const entry of list.getEntries())if(type==='longtask')window.motionPerformance.longtasks.push({start:entry.startTime,duration:entry.duration});else window.motionPerformance.shifts.push({start:entry.startTime,value:entry.value,input:entry.hadRecentInput})
   }).observe({type,buffered:true})
  })
  const page=await context.newPage();page.setDefaultTimeout(20000)
  try{
   await page.goto('/');await expect(page.locator('.post-item')).toHaveCount(15);await expect(page.locator('.loading-screen:visible')).toHaveCount(0);await page.waitForTimeout(900)
   await page.getByRole('link',{name:'归档',exact:true}).click();await expect(page.locator('main')).toContainText('文章归档');await page.waitForTimeout(500)
   await page.getByRole('link',{name:'主页',exact:true}).click();await expect(page.locator('.post-item')).toHaveCount(15);await page.waitForTimeout(600)
   if(noBlur)await page.addStyleTag({content:'.appearance-drawer__overlay { backdrop-filter: none !important; }'})
   const client=await context.newCDPSession(page)
   await client.send('Emulation.setCPUThrottlingRate',{rate:cpu})
   await page.evaluate(()=>{window.motionPerformance.longtasks=[];window.motionPerformance.shifts=[]})
   await client.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing',transferMode:'ReturnAsStream'})
   const frames=page.evaluate(()=>new Promise(resolve=>{
    let last=performance.now();const start=last,intervals=[]
    const frame=now=>{intervals.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(frame);else resolve({start,duration:now-start,intervals})};requestAnimationFrame(frame)
   }))
   await page.getByRole('button',{name:'界面设置',exact:true}).click();await page.waitForTimeout(450)
   await page.getByRole('button',{name:'关闭界面设置',exact:true}).click();await page.waitForTimeout(350)
   await page.getByRole('link',{name:'归档',exact:true}).click();await page.waitForTimeout(700)
   await page.getByRole('link',{name:'主页',exact:true}).click()
   const frame=await frames,values=frame.intervals.slice(1).sort((a,b)=>a-b)
   const completed=new Promise(resolve=>client.once('Tracing.tracingComplete',resolve));await client.send('Tracing.end');const {stream}=await completed
   let trace='';for(;;){const item=await client.send('IO.read',{handle:stream});trace+=item.data;if(item.eof)break}await client.send('IO.close',{handle:stream})
   const file=`cpu-${cpu}-run-${repetition}.json`;writeFileSync(`${output}/${file}`,trace)
   const costs={}
   for(const event of JSON.parse(trace).traceEvents)if(event.ph==='X'&&['Paint','Layout','UpdateLayoutTree','FunctionCall'].includes(event.name)){const value=costs[event.name]??={count:0,ms:0,max:0};value.count++;value.ms+=(event.dur||0)/1000;value.max=Math.max(value.max,(event.dur||0)/1000)}
   const performance=await page.evaluate(()=>window.motionPerformance)
   const record={stage,cpu,repetition,browser:browser.version(),viewport:'1440x1000',frame,p50:percentile(values,.5),p95:percentile(values,.95),max:values.at(-1),performance,costs,trace:file}
   results.push(record);writeFileSync(`${output}/results.json`,JSON.stringify({machine:{cpu:os.cpus()[0].model,ram:os.totalmem(),os:os.version()},results},null,2))
   console.log(JSON.stringify({stage,cpu,repetition,p95:record.p95,max:record.max,paint:costs.Paint?.ms,longtasks:performance.longtasks.length}))
  }finally{await context.close()}
 }
}finally{await browser.close()}
