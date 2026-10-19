/**
 * @file moment-guestbook-gallery-project-link.spec.ts
 * @description 朋友圈、留言、图库、项目与友链的异常文案按 Accept-Language 输出英文，默认中文与业务码保持不变
 * @author TixXin
 * @since 2026-10-19
 */
import 'reflect-metadata'
import { HttpException, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ErrorCode } from '../../constants/error-codes'
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter'
import { messageCode, translate, translateStored, type LocalizedMessage } from '..'
import { galleryExternalUrl } from '../../../modules/gallery/gallery-values'
import { decodeGuestbookCursor } from '../../../modules/guestbook/guestbook-values'
import { linkLogoUrl } from '../../../modules/link/link-values'
import { momentValues } from '../../../modules/moment/moment-values'
import { ProjectService } from '../../../modules/project/project.service'
import type { SaveMomentDto } from '../../../modules/moment/moment.dto'

jest.mock('../../../modules/media/media-references', () => ({
  ...jest.requireActual<typeof import('../../../modules/media/media-references')>(
    '../../../modules/media/media-references',
  ),
  lockMedia: jest.fn().mockResolvedValue(undefined),
}))

function caught(run: () => unknown): HttpException {
  try {
    run()
  } catch (error) {
    return error as HttpException
  }
  throw new Error('预期抛出异常')
}

function render(exception: unknown, headers: Record<string, string> = {}) {
  const sent: { status?: number; body?: Record<string, unknown> } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: Record<string, unknown>) {
      sent.body = body
    },
  }
  const request = { method: 'DELETE', path: '/api/v1/admin/projects/7', headers }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return sent
}

const english = (error: HttpException) => {
  const body = error.getResponse() as LocalizedMessage
  return translate('en', body.messageKey, body.messageParams)
}

describe('朋友圈、留言、图库、项目与友链的英文异常', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('动态引用互斥：中文不变，英文可读', () => {
    const error = caught(() =>
      momentValues({
        content: '午后',
        linkedArticleId: 3,
        linkedLink: { url: 'https://example.com' },
      } as SaveMomentDto),
    )
    expect(error.message).toBe('站内文章和外链引用只能选择一种')
    expect(english(error)).toBe('Choose either a site post or an external link to reference, not both')
  })

  it('图库与友链地址校验', () => {
    const gallery = caught(() => galleryExternalUrl('ftp://example.com/a.jpg'))
    expect(gallery.message).toBe('图片需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠')
    expect(english(gallery)).toBe(
      'Images need a full HTTP(S) URL without whitespace, control characters, or backslashes',
    )
    const link = caught(() => linkLogoUrl('http://example.com/logo.png'))
    expect(link.message).toBe('外部头像需要完整的 HTTPS 地址')
    expect(english(link)).toBe('External avatars need a full HTTPS URL')
  })

  it('留言游标失效', () => {
    const error = caught(() => decodeGuestbookCursor('broken', {} as never))
    expect(error.message).toBe('留言游标无效或筛选已变化，请重新加载')
    expect(english(error)).toBe('The message cursor is invalid or the filters have changed. Please reload.')
  })

  it('项目删除版本冲突经过滤器输出英文与 RevisionConflict', async () => {
    const em = {
      transactional: jest.fn((run: (tx: unknown) => unknown) =>
        run({ findOne: jest.fn().mockResolvedValue({ id: 7, revision: 4, deletedAt: null }) }),
      ),
    }
    const service = new ProjectService(em as unknown as EntityManager)
    const error = await service.remove(7, 3).catch((reason: unknown) => reason)
    expect((error as HttpException).message).toBe('项目已变化，请重新读取后确认删除')
    const zhBody = render(error).body
    expect(zhBody).toMatchObject({ code: ErrorCode.RevisionConflict, message: '项目已变化，请重新读取后确认删除' })
    const enBody = render(error, { 'accept-language': 'en' }).body
    expect(enBody).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: 'The project has changed. Please reload and confirm the deletion again.',
    })
  })

  it('带参数的友链重复地址与提交冲突码', () => {
    expect(translate('en', 'link.urlExists', { id: 12 })).toBe(
      'This URL is already used by friend link #12. Edit that link or change the URL.',
    )
    expect(translate('zh-CN', 'link.urlExists', { id: 12 })).toBe('该地址已存在于友链 #12，请编辑已有友链或修改地址')
    expect(translateStored('en', '该地址的友链 #5 已公开，请修改地址或先下架原友链')).toBe(
      'Friend link #5 with this URL is already published. Change the URL or unpublish the original link first.',
    )
    expect(translateStored('en', '此提交已处理，请核查原作品')).toBe(
      'This submission has already been processed. Please check the original photo.',
    )
    expect(messageCode('gallery.submissionHandled')).toBe(ErrorCode.SubmissionConflict)
    expect(messageCode('link.submissionHandled')).toBe(ErrorCode.SubmissionConflict)
    expect(messageCode('moment.updatedKeepInput')).toBe(ErrorCode.RevisionConflict)
  })
})
