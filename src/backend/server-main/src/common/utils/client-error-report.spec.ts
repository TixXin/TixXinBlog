/** @file client-error-report.spec.ts @description 上报地址和错误文本脱敏的边界回归。 */
import { isClientErrorPath, sanitizeClientErrorText, sanitizeClientErrorUrl } from './client-error-report'

describe('客户端错误日志脱敏', () => {
  it('移除相对地址、绝对地址、重复查询、片段及大小写协议的内嵌凭据', () => {
    const clean = sanitizeClientErrorText(
      'HTTP://user:secret@host/path?a=secret&a=again#secret "/app.js?secret:1:2" //u:p@cdn/path#private',
    )
    expect(clean).toBe('HTTP://host/path "/app.js" //cdn/path')
    expect(sanitizeClientErrorText('失败\r\n\u0000\t\u001b\u2028\u2029\u202e伪造日志')).toBe('失败        伪造日志')
  })

  it('页面地址只保留源与路径，规范化后的 Unicode 地址仍受长度限制', () => {
    expect(sanitizeClientErrorUrl('https://user:secret@blog.example.com/path?secret#private')).toBe(
      'https://blog.example.com/path',
    )
    expect(sanitizeClientErrorUrl(`https://blog.example.com/${'路'.repeat(1000)}`)).toHaveLength(2048)
  })

  it('匹配 Express 接受的大小写与尾斜线，不匹配其他业务路径', () => {
    expect(isClientErrorPath('/API/V1/CLIENT-ERRORS/')).toBe(true)
    expect(isClientErrorPath('/api/v1/client-errors-extra')).toBe(false)
    expect(isClientErrorPath('/api/v1/client-errors/other')).toBe(false)
  })
})
