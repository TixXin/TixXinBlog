/** @file guestbook-fixture.mjs @description 浏览器隔离库的真实留言分页样本，不写入日常数据库 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
export async function seedGuestbookBrowserFixture(fixture) {
  const orm = fixture.testOrm
  assert(/^tixxin_browser_\d+_\d+$/.test(orm.config.get('dbName')))
  const { GuestbookMessage } = require('../dist/entities/guestbook-message.entity.js')
  const em = orm.em.fork()
  for (let index = 0; index < 47; index++)
    em.create(GuestbookMessage, {
      author: index % 5 === 0 ? 'TixXin' : `读者${index % 5}`,
      avatar: '/avatar.svg',
      content: `一起讨论阅读与技术 ${String(index).padStart(2, '0')}。把思考写下来，交流不同的经验。`,
      visitorIdHash: createHash('sha256')
        .update(`fixture:${index % 5}`)
        .digest('hex'),
      isOwner: index % 5 === 0,
      status: index === 45 ? 'pending' : index === 46 ? 'hidden' : 'published',
      isPinned: index === 0,
      createdAt: new Date(Date.now() - index * 60000),
    })
  await em.flush()
}
