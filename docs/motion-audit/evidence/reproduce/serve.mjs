/**
 * @file serve.mjs
 * @description 动效审查专用隔离后端、生产预览和开发副本，退出时清理本次测试库
 */
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './backend/tests/test-app.mjs'
const base='D:/Projects/TixXinBlog/.codex/motion-audit'
const require=createRequire(import.meta.url)
require('./backend/dist/config/environment.js').loadLocalEnvironment('D:/Projects/TixXinBlog/src/backend/server-main')
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
const prodPort=await port(),devPort=await port()
const prod=`http://127.0.0.1:${prodPort}`,dev=`http://127.0.0.1:${devPort}`
const fixture=await createBrowserTestApp(prod)
const children=[]
let closing=false
const logs={}
async function close(){
  if(closing)return
  closing=true
  for(const child of children){if(child.exitCode===null&&child.signalCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended}}
  await fixture.close()
  writeFileSync(`${base}/state.json`,JSON.stringify({status:'closed',prod,dev}))
  process.exit()
}
process.once('SIGINT',close);process.once('SIGTERM',close)
try{
  const env={...process.env,NUXT_API_BASE_URL:fixture.origin+'/api/v1',NUXT_PUBLIC_API_BASE_URL:'/api/v1',NUXT_PUBLIC_USE_MOCK_REPO:'false',NUXT_PUBLIC_POST_USE_MOCK_REPO:'false',HOST:'127.0.0.1'}
  for(const [name,args,extra] of [
    ['production',['.output/server/index.mjs'],{NODE_ENV:'production',PORT:String(prodPort)}],
    ['development',['node_modules/nuxt/bin/nuxt.mjs','dev','--port',String(devPort),'--host','127.0.0.1'],{NODE_ENV:'development'}],
  ]){
    const child=spawn(process.execPath,args,{cwd:`${base}/frontend`,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']})
    children.push(child);logs[name]=''
    for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{logs[name]+=d;writeFileSync(`${base}/${name}-server.log`,logs[name])})
  }
  for(const origin of [prod,dev]){
    let ok=false
    for(let i=0;i<100;i++){
      try{ok=(await fetch(origin+'/api/v1/posts?pageSize=1',{signal:AbortSignal.timeout(1500)})).ok}catch{}
      if(ok)break
      await delay(500)
    }
    if(!ok)throw new Error('服务未就绪 '+origin)
  }
  writeFileSync(`${base}/state.json`,JSON.stringify({status:'ready',prod,dev,username:fixture.username,password:fixture.password}))
  console.log(JSON.stringify({status:'ready',prod,dev}))
  process.stdin.resume();process.stdin.on('data',d=>{if(d.toString().includes('close'))void close()})
}catch(e){console.error(e.message);await close()}
