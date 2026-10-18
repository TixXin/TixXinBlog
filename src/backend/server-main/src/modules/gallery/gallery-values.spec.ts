/** @file gallery-values.spec.ts @description 图库外链完整性、安全边界和受管媒体识别回归 */
import { BadRequestException } from '@nestjs/common'
import { galleryExternalUrl } from './gallery-values'

describe('图库外链校验', () => {
  it.each([
    'http://images.example.com/photo.jpg',
    'https://images.example.com:8443/photo.webp',
    'HTTPS://IMAGES.EXAMPLE.COM:443/Photo%2fOriginal.jpg?size=1&size=2#Preview',
    'https://images.example.com/%E5%A4%9C%E8%89%B2.jpg?signature=a%2Bb%2Fc%3D',
  ])('完整 HTTP(S) 图片地址原样保存：%s', (url) => {
    expect(galleryExternalUrl(url)).toBe(url)
  })

  it.each([
    '',
    'javascript:alert(1)',
    'data:image/png;base64,aGVsbG8=',
    'file:///tmp/photo.png',
    'ftp://images.example.com/photo.png',
    '//images.example.com/photo.png',
    '/photo.png',
    'images.example.com/photo.png',
    'https:images.example.com/photo.png',
    'https:/images.example.com/photo.png',
    'https:///images.example.com/photo.png',
    'https://',
    'https://[invalid]/photo.png',
    'https://images.example.com:invalid/photo.png',
    'https://user:password@images.example.com/photo.png',
    'https://user@images.example.com/photo.png',
  ])('拒绝危险、不完整、畸形或带凭据地址：%s', (url) => {
    expect(() => galleryExternalUrl(url)).toThrow(BadRequestException)
  })

  it.each([' ', '\t', '\n', '\r', '\u0000', '\u001f', '\u007f', '\\'])('拒绝空白、控制字符或反斜杠 %j', (character) => {
    expect(() => galleryExternalUrl(`https://images.example.com/photo${character}.png`)).toThrow(BadRequestException)
  })

  it.each([' https://images.example.com/photo.png', 'https://images.example.com/photo.png '])(
    '不静默修剪含首尾空白的图片地址：%j',
    (url) => {
      expect(() => galleryExternalUrl(url)).toThrow(BadRequestException)
    },
  )

  it('允许恰好 2048 个字符，拒绝超限地址而不截断', () => {
    const prefix = 'https://images.example.com/'
    const url = prefix + 'a'.repeat(2048 - prefix.length)
    expect(galleryExternalUrl(url)).toBe(url)
    expect(() => galleryExternalUrl(`${url}a`)).toThrow(BadRequestException)
  })

  it.each([
    '/api/v1/media/12345678-1234-4123-a123-123456789abc.webp',
    '/API/V1/MEDIA/12345678-1234-4123-A123-123456789ABC.WEBP',
    '/api/v1/./media/12345678-1234-4123-a123-123456789abc.webp',
    '/%61pi%2Fv1%2Fmedia%2F12345678-1234-4123-a123-123456789abc.webp',
    '/%2561pi%252Fv1%252Fmedia%252F12345678-1234-4123-a123-123456789abc.webp',
  ])('可识别的受管媒体路径必须改用媒体关联：%s', (path) => {
    expect(() => galleryExternalUrl(`https://images.example.com${path}`)).toThrow(
      '媒体库图片请通过媒体选择器关联，不能填写为外部图片',
    )
  })
})
