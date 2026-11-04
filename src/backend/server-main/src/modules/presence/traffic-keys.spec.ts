/** @file traffic-keys.spec.ts @description 访问构成取值：来源域名规范化、设备与浏览器大类归类、按日期推算 */
import { deviceKey, normalizeReferrer, shiftDay } from './traffic-keys'

describe('来源域名', () => {
  it('小写、去掉 www. 与末尾点；空串表示直接访问；未携带时不计来源', () => {
    expect(normalizeReferrer('WWW.Google.com')).toBe('google.com')
    expect(normalizeReferrer('news.ycombinator.com.')).toBe('news.ycombinator.com')
    expect(normalizeReferrer('')).toBe('')
    expect(normalizeReferrer(undefined)).toBeNull()
  })

  it('只接受域名，地址、端口、路径与非法字符一律不计', () => {
    for (const value of [
      'https://example.com',
      'example.com/path',
      'example.com:8080',
      'exa mple.com',
      '-bad.com',
      'a..b',
    ])
      expect(normalizeReferrer(value)).toBeNull()
    expect(normalizeReferrer(`${'a'.repeat(64)}.com`)).toBeNull()
  })
})

describe('设备与浏览器', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      'desktop/safari',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'mobile/safari',
    ],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', 'desktop/chrome'],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'desktop/edge',
    ],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', 'mobile/chrome'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'desktop/firefox'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1',
      'mobile/chrome',
    ],
    [undefined, 'desktop/other'],
  ])('%s → %s', (userAgent, expected) => {
    expect(deviceKey(userAgent)).toBe(expected)
  })
})

describe('日期推算', () => {
  it('跨月、跨年与闰日', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29')
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31')
    expect(shiftDay('2026-11-05', -29)).toBe('2026-10-07')
    expect(shiftDay('2026-11-05', 0)).toBe('2026-11-05')
  })
})
