/** @file client-context.spec.ts @description 浏览器解析只取主流家族与主版本；地区头仅在可信代理连接下采信 */
import type { Request } from 'express'
import { clientRegion, parseBrowser } from '../client-context'

describe('parseBrowser', () => {
  it('识别主流浏览器家族与主版本', () => {
    expect(
      parseBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 121')
    expect(
      parseBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      ),
    ).toBe('Edge 120')
    expect(parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0')).toBe('Firefox 122')
    expect(
      parseBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 17')
  })
  it('无法识别或异常的 UA 返回空串', () => {
    expect(parseBrowser(undefined)).toBe('')
    expect(parseBrowser('curl/8.4.0')).toBe('')
    expect(parseBrowser('x'.repeat(600))).toBe('')
  })
})

describe('clientRegion', () => {
  const request = (trusted: boolean, header?: string) =>
    ({
      app: { get: (key: string) => (key === 'trust proxy fn' ? () => trusted : undefined) },
      socket: { remoteAddress: '10.0.0.2' },
      get: () => header,
    }) as unknown as Request

  it('可信代理注入的地区头才采信，并压缩空白', () => {
    expect(clientRegion(request(true, ' 山东  济南 '))).toBe('山东 济南')
    expect(clientRegion(request(false, '山东济南'))).toBe('')
    expect(clientRegion(request(true))).toBe('')
    expect(clientRegion(request(true, 'x'.repeat(41)))).toBe('')
  })
})
