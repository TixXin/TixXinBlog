/** @file backup.controller.spec.ts @description 内容包控制器的真实参数校验、管理员绑定与下载审计边界。 */
import 'reflect-metadata'
import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA, PARAMTYPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import type { Response } from 'express'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { BackupController } from './backup.controller'
import { ContentExportService } from './content-export.service'
import { ContentImportService } from './content-import.service'

const requestId = '541c13e8-b1f2-4186-91a5-a6a2645025f2'
const admin = { id: 'admin-one', sessionVersion: 2, sessionId: 'session-one' }
const confirmation = 'a1'.repeat(32)
const validation = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })

function validate(method: 'export' | 'preview' | 'execute', value: unknown) {
  // 直接使用路由声明的 DTO，覆盖 multipart 转换而不创建监听端口。
  const metatype = Reflect.getMetadata(PARAMTYPES_METADATA, BackupController.prototype, method)[
    method === 'export' ? 0 : 1
  ]
  return validation.transform(value, { type: 'body', metatype })
}

function setup() {
  const exporter = { snapshot: jest.fn() }
  const importer = {
    preview: jest.fn(),
    recent: jest.fn(),
    get: jest.fn(),
    repreview: jest.fn(),
    execute: jest.fn(),
  }
  const controller = new BackupController(
    exporter as unknown as ContentExportService,
    importer as unknown as ContentImportService,
  )
  return { controller, exporter, importer }
}

describe('内容包请求校验', () => {
  it('所有内容包入口保留管理员守卫，导出默认包含媒体', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, BackupController)).toContain(AdminAuthGuard)
    await expect(validate('export', {})).resolves.toMatchObject({ mediaIncluded: true })
    await expect(validate('export', { mediaIncluded: false })).resolves.toMatchObject({ mediaIncluded: false })
  })

  it.each([{ mediaIncluded: 'false' }, { mediaIncluded: 0 }, { mediaIncluded: null }, { extra: true }])(
    '导出拒绝非布尔值及未知字段 %j',
    async (body) => {
      await expect(validate('export', body)).rejects.toMatchObject({ status: 400 })
    },
  )

  it('预览默认跳过重复项且保留设置，显式 multipart 布尔字符串会转换', async () => {
    await expect(validate('preview', { requestId })).resolves.toMatchObject({
      requestId,
      strategy: 'skip',
      includeSettings: false,
    })
    for (const includeSettings of [true, false, 'true', 'false'])
      await expect(validate('preview', { requestId, strategy: 'copy', includeSettings })).resolves.toMatchObject({
        requestId,
        strategy: 'copy',
        includeSettings: includeSettings === true || includeSettings === 'true',
      })
  })

  it.each([
    { requestId: undefined },
    { requestId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
    { requestId: 'bad' },
    { strategy: 'overwrite' },
    { includeSettings: 'TRUE' },
    { includeSettings: '0' },
    { includeSettings: ['true', 'false'] },
    { includeSettings: null },
    { adminId: 'another-admin' },
  ])('预览拒绝非法请求编号、策略、布尔值及身份注入 %j', async (change) => {
    await expect(validate('preview', { requestId, ...change })).rejects.toMatchObject({ status: 400 })
  })

  it('执行只接受准确确认文本及 64 位小写十六进制摘要', async () => {
    await expect(validate('execute', { acknowledgement: '导入为新草稿', confirmation })).resolves.toMatchObject({
      acknowledgement: '导入为新草稿',
      confirmation,
    })
  })

  it.each([
    { acknowledgement: undefined },
    { acknowledgement: '导入为新草稿 ' },
    { acknowledgement: '覆盖现有内容' },
    { confirmation: undefined },
    { confirmation: 'a'.repeat(63) },
    { confirmation: 'a'.repeat(65) },
    { confirmation: 'A'.repeat(64) },
    { confirmation: 'g'.repeat(64) },
    { confirmation: 123 },
    { extra: true },
  ])('执行拒绝不完整或被改写的确认 %j', async (change) => {
    await expect(
      validate('execute', { acknowledgement: '导入为新草稿', confirmation, ...change }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it.each(['get', 'repreview', 'execute'] as const)('%s 路由使用 UUID v4 校验票据编号', async (method) => {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, BackupController, method) as Record<
      string,
      { data: string; pipes: ParseUUIDPipe[] }
    >
    const pipe = Object.values(params).find((param) => param.data === 'id')!.pipes[0]!
    await expect(pipe.transform(requestId, { type: 'param' })).resolves.toBe(requestId)
    for (const id of ['../ticket', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'])
      await expect(pipe.transform(id, { type: 'param' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('内容包控制器委托与响应边界', () => {
  it.each([true, false])('导出媒体选项为 %s 时发送 JSON 下载，审计只返回计数', async (mediaIncluded) => {
    const { controller, exporter } = setup()
    const content = {
      posts: [{ title: '私有文章正文' }],
      flashes: [{}, {}],
      moments: [],
      guestbook: [{}],
      gallery: [],
      projects: [{}],
      links: [],
      prompts: [{}],
      media: [{ data: 'private-media-bytes' }],
    }
    exporter.snapshot.mockResolvedValue(content)
    const response = { type: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis(), send: jest.fn() }
    const summary = await controller.export({ mediaIncluded }, response as unknown as Response)
    expect(exporter.snapshot).toHaveBeenCalledWith(mediaIncluded)
    expect(response.type).toHaveBeenCalledWith('application/json; charset=utf-8')
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^attachment; filename="blog-content-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}\.json"$/),
    )
    expect(response.send).toHaveBeenCalledWith(JSON.stringify(content))
    expect(summary).toEqual({
      id: expect.any(String),
      exportedPosts: 1,
      exportedFlashes: 2,
      exportedMoments: 0,
      exportedGuestbook: 1,
      exportedGallery: 0,
      exportedProjects: 1,
      exportedLinks: 0,
      exportedPrompts: 1,
      exportedMedia: mediaIncluded ? 1 : 0,
    })
    expect(JSON.stringify(summary)).not.toMatch(/私有文章正文|private-media-bytes/)
  })

  it('导出失败保留原异常，不发送部分内容包', async () => {
    const { controller, exporter } = setup()
    const error = new Error('无法读取内容')
    exporter.snapshot.mockRejectedValue(error)
    const response = { type: jest.fn(), setHeader: jest.fn(), send: jest.fn() }
    await expect(controller.export({ mediaIncluded: true }, response as unknown as Response)).rejects.toBe(error)
    expect(response.send).not.toHaveBeenCalled()
    expect(response.setHeader).not.toHaveBeenCalled()
  })

  it.each([undefined, { buffer: Buffer.from('{}'), originalname: 'content.json' }])(
    '预览把文件与已校验参数原样绑定到当前管理员',
    async (file) => {
      const { controller, importer } = setup()
      const result = { id: requestId, state: 'previewed' }
      importer.preview.mockResolvedValue(result)
      const body = await validate('preview', { requestId, includeSettings: 'false' })
      await expect(controller.preview(file, body, admin)).resolves.toBe(result)
      expect(importer.preview).toHaveBeenCalledWith(file, body, admin)
    },
  )

  it('查询和重新预览始终传递当前管理员身份', async () => {
    const { controller, importer } = setup()
    importer.recent.mockResolvedValue([])
    importer.get.mockResolvedValue({ id: requestId })
    importer.repreview.mockResolvedValue({ id: requestId, confirmation })
    await expect(controller.recent(admin)).resolves.toEqual([])
    await expect(controller.get(requestId, admin)).resolves.toEqual({ id: requestId })
    await expect(controller.repreview(requestId, admin)).resolves.toEqual({ id: requestId, confirmation })
    expect(importer.recent).toHaveBeenCalledWith(admin)
    expect(importer.get).toHaveBeenCalledWith(requestId, admin)
    expect(importer.repreview).toHaveBeenCalledWith(requestId, admin)
  })

  it.each([
    { result: undefined, posts: 0, flashes: 0, prompts: 0, comments: 0, media: 0 },
    {
      result: { posts: ['p1'], flashes: ['f1', 'f2'], comments: 3, media: 4 },
      posts: 1,
      flashes: 2,
      prompts: 0,
      comments: 3,
      media: 4,
    },
    {
      result: { posts: [], flashes: [], prompts: ['prompt1'], comments: 0, media: 0 },
      posts: 0,
      flashes: 0,
      prompts: 1,
      comments: 0,
      media: 0,
    },
  ])('执行保留原票据结果并按真实数组计算审计计数', async ({ result, posts, flashes, prompts, comments, media }) => {
    const { controller, importer } = setup()
    const value = { id: requestId, state: result ? 'completed' : 'previewed', result }
    importer.execute.mockResolvedValue(value)
    await expect(
      controller.execute(requestId, { acknowledgement: '导入为新草稿', confirmation }, admin),
    ).resolves.toEqual({
      ...value,
      importedPosts: posts,
      importedFlashes: flashes,
      importedMoments: 0,
      importedGuestbook: 0,
      importedGallery: 0,
      importedProjects: 0,
      importedLinks: 0,
      importedPrompts: prompts,
      importedComments: comments,
      importedMedia: media,
    })
    expect(importer.execute).toHaveBeenCalledWith(requestId, '导入为新草稿', confirmation, admin)
  })
})
