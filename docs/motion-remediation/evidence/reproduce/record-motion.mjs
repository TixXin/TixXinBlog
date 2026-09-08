/**
 * @file record-motion.mjs
 * @description 保存三主题真实正常路由动画的视频、连续帧及活动动画证据
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const work = 'D:/Projects/TixXinBlog/.codex/motion-fixes', state = JSON.parse(readFileSync(`${work}/state.json`))
if (state.status !== 'ready') throw Error('隔离环境未启动')
process.kill(state.ownerPid, 0)
const require = createRequire(`${work}/frontend/package.json`), { chromium, expect } = require('@playwright/test')
const output = `${work}/evidence/normal-motion`
mkdirSync(output, { recursive: true })
const browser = await chromium.launch(), results = []
try {
  for (const layout of ['nexus', 'aurora', 'dock']) {
    const context = await browser.newContext({ baseURL: state.prod, viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', recordVideo: { dir: output, size: { width: 1440, height: 1000 } } })
    const page = await context.newPage()
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: state.prod }])
      await page.goto('/')
      await expect(page.locator('html')).toHaveClass(/app-client-ready/)
      await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
      await page.evaluate(() => {
        window.motionSamples = []
        const start = performance.now()
        const sample = now => {
          window.motionSamples.push({ ms: now - start, url: location.pathname, clone: document.querySelectorAll('[data-page-motion-clone]').length, animations: document.getAnimations().filter(animation => animation.effect?.target instanceof Element && animation.effect.target.closest('.page-motion-host')).map(animation => ({ state: animation.playState, duration: animation.effect.getTiming().duration, currentTime: animation.currentTime, keyframes: animation.effect.getKeyframes() })) })
          if (now - start < 1800) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      await page.getByRole('link', { name: '归档', exact: true }).click()
      const frames = []
      for (let frame = 0; frame < 4; frame++) {
        await page.waitForTimeout(frame ? 60 : 10)
        const timestamp = await page.evaluate(() => performance.now())
        await page.screenshot({ path: `${output}/${layout}-${frame}.png`, animations: 'allow' })
        frames.push({ frame, timestamp })
      }
      await expect(page.locator('main')).toContainText('文章归档')
      await expect(page.locator('[data-page-motion-clone]')).toHaveCount(0)
      await page.waitForTimeout(1800)
      const samples = await page.evaluate(() => window.motionSamples)
      expect(samples.some(sample => sample.clone && sample.animations.some(animation => animation.state === 'running'))).toBe(true)
      await context.close()
      const video = `${layout}.webm`
      await page.video().saveAs(`${output}/${video}`)
      results.push({ layout, status: 'passed', frames, samples, video })
      console.log(`PASS ${layout} 正常进入/离场视频`)
    } catch (error) { results.push({ layout, status: 'failed', error: error.message }); console.log(`FAIL ${layout}: ${error.message}`); await context.close() }
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2))
  }
} finally { await browser.close(); process.exitCode = results.some(result => result.status === 'failed') ? 1 : 0 }
