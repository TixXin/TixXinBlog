/** @file authCookieLock.test.ts @description Cookie 轮换标记只作短期协调，不保存身份，失败与跨文档等待均能结束 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withAuthCookieLock, withAuthCookieRead } from '~/utils/authCookieLock'
const key = 'blog-auth-cookie-pending'
describe('认证 Cookie 请求协调', () => {
  beforeEach(() => {
    localStorage.removeItem(key)
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {})
  })
  afterEach(() => {
    localStorage.removeItem(key)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('读取等待当前写入结束，再读取新 Cookie', async () => {
    const events: string[] = []
    let release!: () => void
    const mutation = withAuthCookieLock(async () => {
      events.push('写入')
      await new Promise<void>((resolve) => {
        release = resolve
      })
      events.push('完成')
    })
    await vi.advanceTimersByTimeAsync(1)
    const read = withAuthCookieRead(async () => {
      events.push('读取')
      return true
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(events).toEqual(['写入'])
    release()
    await mutation
    expect(await read).toBe(true)
    expect(events).toEqual(['写入', '完成', '读取'])
    expect(localStorage.getItem(key)).toBeNull()
  })
  it('上一文档未完成的标记到期后允许恢复', async () => {
    localStorage.setItem(key, JSON.stringify({ id: 'interrupted-document', until: Date.now() + 250 }))
    const operation = vi.fn(async () => true)
    const result = withAuthCookieRead(operation)
    await vi.advanceTimersByTimeAsync(200)
    expect(operation).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(await result).toBe(true)
  })
  it('上一文档卸载前未清标记时，版本 Cookie 变化即结束等待；版本未变仍等到期', async () => {
    document.cookie = 'tixxin_rv=before; path=/'
    localStorage.setItem(key, JSON.stringify({ id: 'unloaded-document', until: Date.now() + 10000, version: 'before' }))
    const operation = vi.fn(async () => true)
    const result = withAuthCookieRead(operation)
    await vi.advanceTimersByTimeAsync(500)
    expect(operation).not.toHaveBeenCalled()
    document.cookie = 'tixxin_rv=after; path=/'
    await vi.advanceTimersByTimeAsync(100)
    expect(await result).toBe(true)
    document.cookie = 'tixxin_rv=; path=/; max-age=0'
  })
  it('写入时记下当前版本，不在标记里保存其他 Cookie', async () => {
    document.cookie = 'tixxin_rv=v1; path=/'
    let seen = ''
    await withAuthCookieLock(async () => {
      seen = localStorage.getItem(key) || ''
    })
    expect(JSON.parse(seen)).toEqual({ id: expect.any(String), until: expect.any(Number), version: 'v1' })
    document.cookie = 'tixxin_rv=; path=/; max-age=0'
  })
  it('失败释放标记，不阻止后续登录或读取', async () => {
    await expect(
      withAuthCookieLock(async () => {
        throw new Error('连接中断')
      }),
    ).rejects.toThrow('连接中断')
    expect(localStorage.getItem(key)).toBeNull()
    expect(await withAuthCookieRead(async () => true)).toBe(true)
  })
  it('拒绝无限期或无效的本地标记', async () => {
    localStorage.setItem(key, JSON.stringify({ id: 'invalid', until: Date.now() + 100000 }))
    expect(await withAuthCookieRead(async () => true)).toBe(true)
    localStorage.setItem(key, 'not-json')
    expect(await withAuthCookieLock(async () => true)).toBe(true)
  })
})
