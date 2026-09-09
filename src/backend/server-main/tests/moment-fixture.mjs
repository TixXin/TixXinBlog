/** @file moment-fixture.mjs @description 仅向程序创建的浏览器隔离库写入朋友圈布局与分页样本 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
export async function seedMomentBrowserFixture(fixture) {
  const orm = fixture.testOrm
  assert(/^tixxin_browser_\d+_\d+$/.test(orm.config.get('dbName')))
  const { Moment } = require('../dist/entities/moment.entity.js')
  const em = orm.em.fork()
  for (let index = 0; index < 31; index++) {
    const date = new Date(Date.UTC(2026, 3, 8, 0, index))
    em.create(Moment, {
      content: `隔离朋友圈样本 ${String(index).padStart(2, '0')}：用于验证真实分页、筛选和三主题布局。`,
      topics: [index % 2 ? '生活日常' : '技术分享'],
      status: 'published',
      publishedAt: date,
      createdAt: date,
    })
  }
  await em.flush()
}
