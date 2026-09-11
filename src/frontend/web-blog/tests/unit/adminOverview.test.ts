/** @file adminOverview.test.ts @description 工作台六域创作地址与互动统计筛选落点。 */
import { describe, expect, it } from 'vitest'
import { overviewDomains, overviewEditorPath, overviewTasks } from '../../app/features/admin/overview'
describe('工作台入口', () => {
  it('六域编辑跳转到真实表单，闪念通过行内编辑深链打开指定记录', () => {
    expect(overviewDomains).toHaveLength(6)
    for (const domain of overviewDomains) {
      expect(overviewEditorPath({ domain: domain.domain, id: 'item/with?symbol' })).toBe(
        domain.domain === 'flash' ? '/admin/flashes?edit=item%2Fwith%3Fsymbol' : domain.path + '/item%2Fwith%3Fsymbol',
      )
    }
  })
  it('审核与回复分开筛选，不把不支持的回复关系制造成待办', () => {
    expect(overviewTasks.map((item) => item.to)).toEqual([
      '/admin/comments?status=pending',
      '/admin/moment-comments?status=pending',
      '/admin/guestbook?status=pending',
      '/admin/comments?unanswered=true',
      '/admin/guestbook?unanswered=true',
    ])
  })
})
