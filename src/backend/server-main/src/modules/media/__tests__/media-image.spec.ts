/**
 * @file media-image.spec.ts
 * @description 使用内存小图验证真实格式、尺寸与字节限制、元信息清除及非法上传拒绝。
 */
import { BadRequestException } from '@nestjs/common'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'
import { MAX_IMAGE_BYTES, MAX_INPUT_PIXELS, normalizeImage } from '../media-image'
import type { UploadedImage } from '../media-image'
import { managedMediaIds } from '../media-references'

describe('媒体图片边界', () => {
  let png: Buffer

  function createImage(width = 4, height = 3) {
    return sharp({ create: { width, height, channels: 3, background: '#123456' } })
  }

  function upload(buffer: Buffer = png, overrides: Partial<UploadedImage> = {}): UploadedImage {
    return { buffer, originalname: 'sample.png', mimetype: 'image/png', size: buffer.length, ...overrides }
  }

  beforeAll(async () => {
    png = await createImage().png().toBuffer()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each(['jpeg', 'png', 'webp'] as const)('真实 %s 按文件头解码并规范化为 WebP', async (format) => {
    const buffer = await createImage().toFormat(format).toBuffer()
    const result = await normalizeImage(
      upload(buffer, { originalname: `sample.${format}`, mimetype: `image/${format}` }),
    )
    const metadata = await sharp(result.buffer).metadata()

    expect(result).toMatchObject({ name: `sample.${format}`, width: 4, height: 3 })
    expect(metadata).toMatchObject({ format: 'webp', width: 4, height: 3 })
    expect(result.buffer.length).toBeGreaterThan(0)
  })

  it.each(['jpeg', 'png', 'webp'] as const)('%s 输入确有 EXIF 与色彩配置，规范化后均不保留', async (format) => {
    const buffer = await createImage()
      .withMetadata()
      .withExif({ IFD0: { Artist: 'private-metadata', Copyright: 'private-owner' } })
      .toFormat(format)
      .toBuffer()
    const inputMetadata = await sharp(buffer).metadata()
    expect(inputMetadata.exif?.includes(Buffer.from('private-metadata'))).toBe(true)
    expect(inputMetadata.exif?.includes(Buffer.from('private-owner'))).toBe(true)
    expect(inputMetadata.icc?.length).toBeGreaterThan(0)

    const result = await normalizeImage(upload(buffer, { originalname: `sample.${format}` }))
    const metadata = await sharp(result.buffer).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: 4, height: 3 })
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
    expect(result.buffer.includes(Buffer.from('private-metadata'))).toBe(false)
  })

  it('按 EXIF 方向旋转实际像素后清除方向标记', async () => {
    const buffer = await createImage().withMetadata({ orientation: 6 }).jpeg().toBuffer()
    expect(await sharp(buffer).metadata()).toMatchObject({ width: 4, height: 3, orientation: 6 })

    const result = await normalizeImage(upload(buffer, { originalname: 'portrait.jpg' }))
    const metadata = await sharp(result.buffer).metadata()
    expect(result).toMatchObject({ width: 3, height: 4 })
    expect(metadata).toMatchObject({ width: 3, height: 4 })
    expect(metadata.orientation).toBeUndefined()
    expect(metadata.exif).toBeUndefined()
  })

  it.each([
    { width: 4, height: 3, expectedWidth: 4, expectedHeight: 3 },
    { width: 1, height: 1, expectedWidth: 1, expectedHeight: 1 },
    { width: 4096, height: 2, expectedWidth: 4096, expectedHeight: 2 },
    { width: 8192, height: 2, expectedWidth: 4096, expectedHeight: 1 },
    { width: 2, height: 8192, expectedWidth: 1, expectedHeight: 4096 },
  ])('$width × $height 图片按比例限制最长边且不放大', async ({ width, height, expectedWidth, expectedHeight }) => {
    const buffer = await createImage(width, height).png().toBuffer()
    const result = await normalizeImage(upload(buffer))
    expect(result).toMatchObject({ width: expectedWidth, height: expectedHeight })
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: expectedWidth, height: expectedHeight })
  })

  it('在元信息读取阶段拒绝超出输入像素上限的图片，不分配超大像素缓冲区', async () => {
    const buffer = Buffer.from(png)
    // 仅修改 PNG 的 IHDR 尺寸与 CRC；读取元信息不解压原始像素，避免生成四千万像素样本。
    const width = 10000
    const height = Math.floor(MAX_INPUT_PIXELS / width) + 1
    buffer.writeUInt32BE(width, 16)
    buffer.writeUInt32BE(height, 20)
    buffer.writeUInt32BE(crc32(buffer.subarray(12, 29)), 29)
    expect(width * height).toBeGreaterThan(MAX_INPUT_PIXELS)
    expect(await sharp(buffer).metadata()).toMatchObject({ width, height })

    // 只观察真实解码器的返回值，证明拒绝原因是像素上限，而非后续像素数据截断。
    const metadata = jest.spyOn(sharp.prototype, 'metadata')
    await expect(normalizeImage(upload(buffer))).rejects.toThrow('图片解码失败、尺寸过大或包含不支持的多帧内容')
    expect(metadata).toHaveBeenCalledTimes(1)
    await expect(metadata.mock.results[0]?.value).rejects.toThrow('Input image exceeds pixel limit')
  })

  it('真实双帧 WebP 在解码前拒绝，不能静默接受第一帧', async () => {
    const pixels = Buffer.concat([Buffer.alloc(4 * 3 * 3, 0), Buffer.alloc(4 * 3 * 3, 255)])
    const buffer = await sharp(pixels, { raw: { width: 4, height: 6, channels: 3, pageHeight: 3 } })
      .webp({ delay: [100, 100], loop: 0 })
      .toBuffer()
    expect(await sharp(buffer).metadata()).toMatchObject({ format: 'webp', pages: 2 })

    await expect(normalizeImage(upload(buffer, { originalname: 'animated.webp' }))).rejects.toThrow('多帧内容')
  })

  it('恰好 8MB 的实际文件可接受，申报 size 不能替代真实字节数', async () => {
    const buffer = Buffer.alloc(MAX_IMAGE_BYTES)
    png.copy(buffer)
    const result = await normalizeImage(upload(buffer, { size: MAX_IMAGE_BYTES + 1 }))
    expect(result).toMatchObject({ width: 4, height: 3 })
    expect(await sharp(result.buffer).metadata()).toMatchObject({ format: 'webp', width: 4, height: 3 })
  })

  it('实际文件超过 8MB 时即使申报 size 很小也拒绝', async () => {
    const buffer = Buffer.alloc(MAX_IMAGE_BYTES + 1)
    png.copy(buffer)
    await expect(normalizeImage(upload(buffer, { size: 1 }))).rejects.toThrow('请选择不超过 8MB 的图片')
  })

  it('未提交文件或提交空字节均返回参数错误', async () => {
    await expect(normalizeImage()).rejects.toBeInstanceOf(BadRequestException)
    await expect(normalizeImage(upload(Buffer.alloc(0), { size: 1 }))).rejects.toThrow('请选择不超过 8MB 的图片')
  })

  it.each(['image/jpeg', 'application/octet-stream', 'image/svg+xml', ''])(
    'MIME 为 %s 时仍以真实字节识别图片',
    async (mimetype) => {
      const result = await normalizeImage(upload(png, { originalname: 'sample.JPG', mimetype, size: 0 }))
      expect(await sharp(result.buffer).metadata()).toMatchObject({ format: 'webp', width: 4, height: 3 })
    },
  )

  it('重新编码会丢弃图片后的额外内容', async () => {
    const trailer = Buffer.from('<script>private-trailing-payload</script>')
    const result = await normalizeImage(upload(Buffer.concat([png, trailer])))
    const clean = await normalizeImage(upload())
    expect(result.buffer.includes(trailer)).toBe(false)
    expect(result.buffer).toEqual(clean.buffer)
  })

  it.each([
    ['伪装 SVG', Buffer.from('<svg><script>alert(1)</script></svg>')],
    ['不受支持的 GIF', Buffer.from('GIF89a')],
    ['PNG 签名缺少最后一字节', Buffer.from([137, 80, 78, 71, 13, 10, 26])],
    ['非 WebP 的 RIFF', Buffer.from('RIFF0000WAVE')],
    ['JPEG 缺少第三个标记字节', Buffer.from([255, 216, 0, 224])],
  ])('%s 即使声明 PNG 类型也因文件头不符而拒绝', async (_label, buffer) => {
    await expect(normalizeImage(upload(buffer))).rejects.toThrow('文件内容不是受支持的图片')
  })

  it.each([
    ['PNG', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['JPEG', Buffer.from([255, 216, 255, 224, 0])],
    ['WebP', Buffer.from('RIFF0000WEBP')],
  ])('%s 仅有有效文件头而无完整图像时仍拒绝', async (_format, buffer) => {
    await expect(normalizeImage(upload(buffer))).rejects.toThrow('图片解码失败、尺寸过大或包含不支持的多帧内容')
  })

  it.each([
    '',
    '../image.png',
    '..\\image.png',
    '/var/image.png',
    'image\u0000.png',
    'image\n.png',
    'image\u007f.png',
    'image\u202e.png',
    'image\u2066.png',
    'image.svg',
    'image.gif',
    'image.png.exe',
    `${'a'.repeat(237)}.png`,
  ])('拒绝非法文件名 %j', async (originalname) => {
    await expect(normalizeImage(upload(png, { originalname }))).rejects.toThrow('文件名不合法')
  })

  it('拒绝运行时传入的非字符串文件名', async () => {
    await expect(normalizeImage(upload(png, { originalname: 123 as unknown as string }))).rejects.toThrow(
      '文件名不合法',
    )
  })

  it.each(['山间湖泊.png', 'café.png', `${'a'.repeat(236)}.png`])('合法名称 %j 原样保留', async (originalname) => {
    expect((await normalizeImage(upload(png, { originalname }))).name).toBe(originalname)
  })

  it('还原 multipart 中以 Latin-1 传递的 UTF-8 中文文件名', async () => {
    const name = '山间湖泊.png'
    const originalname = Buffer.from(name, 'utf8').toString('latin1')
    expect((await normalizeImage(upload(png, { originalname }))).name).toBe(name)
  })

  it('编码后的受管图片链接仍能建立引用索引', () => {
    const id = '12345678-1234-4123-8123-123456789abc'
    expect(managedMediaIds([`![图](/api/v1/media/${id}.webp)`])).toEqual([id])
    expect(managedMediaIds([`/api/v1/media/%31${id.slice(1)}.webp`])).toEqual([id])
  })
})
