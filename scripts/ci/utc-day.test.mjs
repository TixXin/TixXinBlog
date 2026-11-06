/** @file utc-day.test.mjs @description UTC 截日检查：计数与 utc-day-ok 注释豁免 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countUtcDays } from '../check-utc-day.mjs'

test('统计 .slice(0, 10) 截日，同一行或上一行注释 utc-day-ok 的不计', () => {
  assert.equal(countUtcDays('const day = new Date().toISOString().slice(0, 10)'), 1)
  assert.equal(countUtcDays('a.slice(0,10) + b.slice( 0 , 10 )'), 2)
  assert.equal(countUtcDays('const day = value.slice(0, 10) // utc-day-ok：已是 YYYY-MM-DD 字符串'), 0)
  assert.equal(countUtcDays('// utc-day-ok：文件名用 UTC 日期\nconst name = now.toISOString().slice(0, 10)'), 0)
  assert.equal(countUtcDays('title.slice(0, 100)'), 0)
})
