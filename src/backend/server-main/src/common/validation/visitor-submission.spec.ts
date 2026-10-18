/** @file visitor-submission.spec.ts @description 四类访客写入的 DTO 白名单、蜜罐与时间边界、业务调用及管理回复回归。 */
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import type { Request } from 'express'
import { MAX_FORM_ELAPSED_MS } from './visitor-submission'
import { CommentController } from '../../modules/comment/comment.controller'
import type { CommentService } from '../../modules/comment/comment.service'
import { CreateCommentDto } from '../../modules/comment/dto/create-comment.dto'
import { FlashController } from '../../modules/flash/flash.controller'
import type { FlashService } from '../../modules/flash/flash.service'
import { CreateFlashCommentDto } from '../../modules/flash/dto/create-flash-comment.dto'
import { AdminGuestbookController } from '../../modules/guestbook/admin-guestbook.controller'
import type { AdminGuestbookBatchService } from '../../modules/guestbook/admin-guestbook-batch.service'
import { GuestbookController } from '../../modules/guestbook/guestbook.controller'
import { CreateGuestbookDto, GuestbookBodyDto } from '../../modules/guestbook/guestbook.dto'
import type { GuestbookReadService } from '../../modules/guestbook/guestbook-read.service'
import type { GuestbookWriteService } from '../../modules/guestbook/guestbook-write.service'
import { AdminMomentController } from '../../modules/moment/admin-moment.controller'
import { MomentController } from '../../modules/moment/moment.controller'
import { CreateMomentCommentDto, MomentCommentBody } from '../../modules/moment/moment.dto'
import type { MomentReadService } from '../../modules/moment/moment-read.service'
import type { MomentWriteService } from '../../modules/moment/moment-write.service'
import type { MomentInteractionService } from '../../modules/moment/moment-interaction.service'

const now = 1_790_000_000_000
const message = '提交未完成，请稍后重试'
const requestId = '3f21c3c8-4d65-4a58-9498-5a188f09643a'
const visitor = 'visitor-hash'
const saved = { id: 'saved-content' }
const request = {} as Request
const clientContext = { browser: 'Firefox 145', region: '上海' }
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })

const rejectedFields: Record<string, unknown>[] = [
  ...['https://spam.example', ' ', '\n', null, 0, false, {}, []].map((website) => ({ website })),
  ...[999, 0, -1, 1.5, MAX_FORM_ELAPSED_MS + 1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '2000', null, {}, []].map(
    (formElapsedMs) => ({ formElapsedMs }),
  ),
  // 旧字段只校验类型，非法值仍拒绝
  ...[0, -1, 1.5, NaN, '1790000000000', null, {}, []].map((formRenderedAt) => ({ formRenderedAt })),
]

const cases = [
  {
    name: '文章评论',
    dto: CreateCommentDto,
    body: { requestId, author: '远山', content: '感谢这篇分享', parentId: 10 },
    setup: () => {
      const create = jest.fn().mockResolvedValue(saved)
      const controller = new CommentController({ create } as unknown as CommentService)
      return {
        write: create,
        invoke: (body: Record<string, unknown>) => controller.create(42, body as unknown as CreateCommentDto, visitor),
        expectedArgs: (body: Record<string, unknown>) => [42, body, visitor],
        auxiliary: jest.fn(),
      }
    },
  },
  {
    name: '闪念评论',
    dto: CreateFlashCommentDto,
    body: { authorName: '远山', content: '记下这个想法', authorAvatar: '/avatar.svg' },
    setup: () => {
      const addComment = jest.fn().mockResolvedValue(saved)
      const controller = new FlashController({ addComment } as unknown as FlashService)
      return {
        write: addComment,
        invoke: (body: Record<string, unknown>) =>
          controller.addComment('flash-id', body as unknown as CreateFlashCommentDto, visitor),
        expectedArgs: (body: Record<string, unknown>) => ['flash-id', body, visitor],
        auxiliary: jest.fn(),
      }
    },
  },
  {
    name: '留言',
    dto: CreateGuestbookDto,
    body: { requestId, author: '远山', content: '路过来打个招呼', replyToId: 10 },
    setup: () => {
      const create = jest.fn().mockResolvedValue(saved)
      const context = jest.fn().mockReturnValue(clientContext)
      const controller = new GuestbookController(
        {} as GuestbookReadService,
        { create, clientContext: context } as unknown as GuestbookWriteService,
      )
      return {
        write: create,
        invoke: (body: Record<string, unknown>) =>
          controller.create(body as unknown as CreateGuestbookDto, visitor, request),
        expectedArgs: (body: Record<string, unknown>) => [body, visitor, undefined, clientContext],
        auxiliary: context,
      }
    },
  },
  {
    name: '朋友圈评论',
    dto: CreateMomentCommentDto,
    body: { requestId, author: '远山', content: '这片风景很安静', avatar: '/avatar.svg' },
    setup: () => {
      const comment = jest.fn().mockResolvedValue(saved)
      const controller = new MomentController(
        {} as MomentReadService,
        { comment } as unknown as MomentInteractionService,
      )
      return {
        write: comment,
        invoke: (body: Record<string, unknown>) =>
          controller.comment('moment-id', body as unknown as CreateMomentCommentDto, visitor),
        expectedArgs: (body: Record<string, unknown>) => ['moment-id', body, visitor],
        auxiliary: jest.fn(),
      }
    },
  },
]

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(now)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe.each(cases)('$name 防垃圾契约', ({ dto, body, setup }) => {
  const metadata = { type: 'body' as const, metatype: dto }

  it('旧客户端可省略字段，白名单保留合法空蜜罐、恰好 1000ms 与上限的填写时长', async () => {
    for (const fields of [
      {},
      { website: '' },
      { website: '', formElapsedMs: 1000 },
      { formElapsedMs: MAX_FORM_ELAPSED_MS },
      // 旧客户端的渲染时间戳不再与服务器时钟比较，时钟偏快的设备也不会被拒绝
      { formRenderedAt: now + 3_600_000 },
      { formRenderedAt: 1 },
    ]) {
      await expect(pipe.transform({ ...body, ...fields }, metadata)).resolves.toMatchObject({ ...body, ...fields })
    }
  })

  it('仍拒绝未声明字段，不因接受蜜罐而扩大请求白名单', async () => {
    await expect(pipe.transform({ ...body, otherField: '' }, metadata)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('非空蜜罐、非法类型、不足 1000ms 及超出上限的填写时长均返回统一参数错误', async () => {
    for (const fields of rejectedFields) {
      await expect(pipe.transform({ ...body, ...fields }, metadata)).rejects.toMatchObject({
        response: { statusCode: 400, message: [message] },
      })
    }
  })

  it('控制器命中防垃圾校验时不调用业务写入或客户端信息处理', () => {
    const { invoke, write, auxiliary } = setup()
    for (const fields of rejectedFields) {
      expect(() => invoke({ ...body, ...fields })).toThrow(new BadRequestException(message))
    }
    expect(write).not.toHaveBeenCalled()
    expect(auxiliary).not.toHaveBeenCalled()
  })

  it('合法及旧请求保持原业务参数和响应，填写时长不进入幂等摘要', async () => {
    const { invoke, write, expectedArgs } = setup()
    for (const fields of [
      {},
      { website: '', formElapsedMs: 2000 },
      { website: '', formElapsedMs: 1000 },
      { website: '', formRenderedAt: now + 60_000 },
    ]) {
      const input = { ...body, ...fields }
      await expect(invoke(input)).resolves.toBe(saved)
      expect(write).toHaveBeenLastCalledWith(...expectedArgs(body))
      expect(input).toEqual({ ...body, ...fields })
    }
    expect(write).toHaveBeenCalledTimes(4)
  })
})

describe('管理回复保持原契约', () => {
  const body = { requestId, content: '谢谢你的分享' }

  it('管理留言无需访客字段，继续传递管理员身份与客户端信息', async () => {
    const create = jest.fn().mockResolvedValue(saved)
    const controller = new AdminGuestbookController(
      {} as GuestbookReadService,
      { create, clientContext: () => clientContext } as unknown as GuestbookWriteService,
      {} as AdminGuestbookBatchService,
    )
    await expect(pipe.transform(body, { type: 'body', metatype: GuestbookBodyDto })).resolves.toMatchObject(body)
    await expect(controller.create(body, { id: 'owner-id' }, request)).resolves.toBe(saved)
    expect(create).toHaveBeenCalledWith(body, '', 'owner-id', clientContext)
  })

  it('管理朋友圈回复无需访客字段，继续传递管理员身份', async () => {
    const comment = jest.fn().mockResolvedValue(saved)
    const controller = new AdminMomentController(
      {} as MomentReadService,
      {} as MomentWriteService,
      { comment } as unknown as MomentInteractionService,
    )
    await expect(pipe.transform(body, { type: 'body', metatype: MomentCommentBody })).resolves.toMatchObject(body)
    await expect(controller.comment('moment-id', body, { id: 'owner-id' })).resolves.toBe(saved)
    expect(comment).toHaveBeenCalledWith('moment-id', body, '', 'owner-id')
  })
})
