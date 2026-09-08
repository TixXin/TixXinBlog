/**
 * @file media-image.spec.ts
 * @description 真实解码、规范化与路径/伪造格式拒绝测试。
 */
import sharp from 'sharp'
import { normalizeImage } from '../media-image'
import { managedMediaIds } from '../media-references'

describe('媒体图片边界', () => {
  it('真实 PNG 转换为 WebP 且不携带 EXIF', async () => {
    const buffer = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#123456' } })
      .withExif({ IFD0: { Artist: 'private-metadata' } })
      .png()
      .toBuffer()
    const result = await normalizeImage({
      buffer,
      originalname: 'sample.png',
      mimetype: 'image/png',
      size: buffer.length,
    })
    const metadata = await sharp(result.buffer).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(4)
    expect(metadata.height).toBe(3)
    expect(metadata.exif).toBeUndefined()
  })
  it('路径名称与伪装 SVG 均拒绝', async () => {
    const buffer = Buffer.from('<svg><script>alert(1)</script></svg>')
    await expect(
      normalizeImage({ buffer, originalname: '../image.png', mimetype: 'image/png', size: buffer.length }),
    ).rejects.toThrow('文件名')
    await expect(
      normalizeImage({ buffer, originalname: 'image.png', mimetype: 'image/png', size: buffer.length }),
    ).rejects.toThrow('文件内容')
  })
  it('编码后的受管图片链接仍能建立引用索引', () => {
    const id = '12345678-1234-4123-8123-123456789abc'
    expect(managedMediaIds([`![图](/api/v1/media/${id}.webp)`])).toEqual([id])
    expect(managedMediaIds([`/api/v1/media/%31${id.slice(1)}.webp`])).toEqual([id])
  })
})
