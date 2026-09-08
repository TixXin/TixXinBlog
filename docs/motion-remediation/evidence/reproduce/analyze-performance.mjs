/** @file analyze-performance.mjs @description 汇总实际性能样本并定位最大的渲染任务 */
import { readFileSync } from 'node:fs'
const work = 'D:/Projects/TixXinBlog/.codex/motion-fixes/evidence'
for (const stage of ['before', 'after']) {
  const data = JSON.parse(readFileSync(`${work}/performance-${stage}/results.json`))
  for (const cpu of [1, 4]) {
    const runs = data.results.filter(run => run.cpu === cpu)
    console.log(JSON.stringify({ stage, cpu, runs: runs.map(run => ({ p95: run.p95, max: run.max, paint: run.costs.Paint.ms, style: run.costs.UpdateLayoutTree.ms, layout: run.costs.Layout.ms, longtasks: run.performance.longtasks.length })) }))
  }
}
const trace = JSON.parse(readFileSync(`${work}/performance-after/cpu-4-run-3.json`)).traceEvents
const events = trace.filter(event => event.ph === 'X' && ['UpdateLayoutTree', 'Layout', 'Paint'].includes(event.name)).sort((a,b) => b.dur - a.dur).slice(0, 12)
console.log(JSON.stringify(events, null, 2))
