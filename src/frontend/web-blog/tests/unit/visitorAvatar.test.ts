/** @file visitorAvatar.test.ts @description 访客首字母头像确定、可内联，博主与访客的缺省回退不同 */
import { describe, expect, it } from 'vitest'
import { avatarInitial, displayAvatar, visitorAvatar } from '~/utils/visitorAvatar'

describe('visitorAvatar', () => {
  it('同名结果稳定，输出 SVG data URI', () => {
    expect(visitorAvatar('小鱼儿')).toBe(visitorAvatar('小鱼儿'))
    expect(visitorAvatar('小鱼儿')).not.toBe(visitorAvatar('DevLin'))
    const value = visitorAvatar('CodeMaster_张')
    expect(value.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodeURIComponent(value.slice(value.indexOf(',') + 1))).toContain('>C</text>')
  })
  it('首字取第一个字母或汉字', () => {
    expect(avatarInitial('张伟_DevOps')).toBe('张')
    expect(avatarInitial('_luna')).toBe('L')
  })
  it('访客缺省或站点默认图回退首字母头像，博主缺省回退站点头像', () => {
    expect(displayAvatar('', '小明')).toBe(visitorAvatar('小明'))
    expect(displayAvatar('/avatar.svg', '小明')).toBe(visitorAvatar('小明'))
    expect(displayAvatar('https://example.com/a.webp', '小明')).toBe('https://example.com/a.webp')
    expect(displayAvatar('', '陈屿', true)).toBe('/avatar.svg')
    expect(displayAvatar('/api/v1/media/x.webp', '陈屿', true)).toBe('/api/v1/media/x.webp')
  })
})
