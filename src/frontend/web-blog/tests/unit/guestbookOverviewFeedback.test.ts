/** @file guestbookOverviewFeedback.test.ts @description 留言统计失败使用稳定标题，并在仍有旧数据时说明保留内容。 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Overview from '../../app/components/guestbook/Overview.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import type { GuestbookMetadata } from '../../app/features/guestbook/types'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const metadata = {
  stats: { messages: 3, members: 2, recent: 1, today: 0 },
  rules: [],
  members: [],
} as unknown as GuestbookMetadata

it('有旧统计时说明仍在显示，没有旧统计时只给出失败原因', async () => {
  const kept = await mountSuspended(Overview, {
    props: { data: metadata, pending: false, error: '留言服务暂时不可用，请稍后重试' },
    global: {
      stubs: {
        CommonRequestFeedback: RequestFeedback,
        GuestbookChatStats: true,
        GuestbookChatRules: true,
        GuestbookActiveMembers: true,
        Icon: true,
      },
    },
  })
  wrappers.push(kept)
  const keptText = kept.get('[role="alert"]').text()
  expect(keptText).toContain('留言统计暂时不可用')
  expect(keptText).toContain('仍显示上次成功读取的留言统计')
  expect(keptText).toContain('留言服务暂时不可用，请稍后重试')
  await kept.get('button').trigger('click')
  expect(kept.emitted('retry')).toHaveLength(1)

  const empty = await mountSuspended(Overview, {
    props: { data: null, pending: false, error: '留言服务暂时不可用，请稍后重试' },
    global: {
      stubs: {
        CommonRequestFeedback: RequestFeedback,
        GuestbookChatStats: true,
        GuestbookChatRules: true,
        GuestbookActiveMembers: true,
        Icon: true,
      },
    },
  })
  wrappers.push(empty)
  const emptyText = empty.get('[role="alert"]').text()
  expect(emptyText).toContain('留言统计暂时不可用')
  expect(emptyText).not.toContain('仍显示上次成功读取')
  expect(emptyText).toContain('留言服务暂时不可用，请稍后重试')
})
