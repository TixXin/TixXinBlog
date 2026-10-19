/**
 * @file prompt-subscription-media-site-auth.spec.ts
 * @description 提示词、订阅、媒体、站点与认证的异常文案按 Accept-Language 输出英文；站点历史原因与会话设备名按请求语言翻译
 * @author TixXin
 * @since 2026-10-19
 */
import 'reflect-metadata'
import { BadRequestException, HttpException, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ErrorCode } from '../../constants/error-codes'
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter'
import { translate, translateStored, zh, type LocalizedMessage } from '..'
import { PromptsService } from '../../../modules/prompts/prompts.service'
import { promptId } from '../../../modules/prompts/prompts-values'
import { SubscriptionService } from '../../../modules/subscription/subscription.service'
import { validateSubscriptionDates } from '../../../modules/subscription/subscription-values'
import { MEDIA_VARIANT_WIDTHS } from '../../../modules/media/media-image'
import { validateSiteExtras } from '../../../modules/site/site-settings.service'
import { INITIAL_PROFILE_REASON, SAFE_INITIAL_PROFILE_REASON } from '../../../modules/site/initial-profile'
import { sessionDeviceLabel } from '../../../modules/auth/session-device'
import { localizeDeviceLabel } from '../../../modules/auth/auth-sessions.service'

async function rejected(run: () => unknown): Promise<HttpException> {
  try {
    await run()
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
  const request = { method: 'PUT', path: '/api/v1/admin/prompts/7', headers }
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

/** 编辑路径只需要事务、媒体锁与按编号读取；返回的记录版本落后于提交版本 */
function staleEm(record: Record<string, unknown>) {
  const em = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(record),
  }
  return {
    transactional: (run: (inner: typeof em) => unknown) => run(em),
  } as unknown as EntityManager
}

describe('提示词、订阅、媒体、站点与认证的英文异常', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  it('提示词编号校验默认中文，英文请求返回英文', () => {
    const error = (() => {
      try {
        promptId(0)
      } catch (caught) {
        return caught as HttpException
      }
      throw new Error('预期抛出异常')
    })()
    expect(error.message).toBe('提示词编号不合法')
    expect(english(error)).toBe('Invalid prompt ID')
    expect(render(error).body).toMatchObject({ code: ErrorCode.ParamInvalid, message: '提示词编号不合法' })
  })

  it('提示词与订阅的并发修改登记版本冲突码，英文请求返回英文', async () => {
    const prompt = await rejected(() =>
      new PromptsService(staleEm({ id: 7, revision: 3 })).save(7, { revision: 2, title: '晨雾' }),
    )
    expect(prompt.message).toBe('提示词已被修改，请保留输入并重新读取')
    expect(render(prompt, { 'accept-language': 'en' }).body).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: 'This prompt has been modified. Keep your input and reload it.',
    })
    expect(render(prompt).body).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: '提示词已被修改，请保留输入并重新读取',
    })

    const subscription = await rejected(() =>
      new SubscriptionService(staleEm({ id: 4, revision: 9 })).save(4, { revision: 8 }),
    )
    expect(subscription.message).toBe('订阅已被修改，请保留输入并重新读取')
    expect(render(subscription, { 'accept-language': 'en' }).body).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: 'This subscription has been modified. Keep your input and reload it.',
    })
  })

  it('已处理提交登记提交冲突码', () => {
    for (const key of ['prompt.submissionConflict', 'subscription.submissionConflict'] as const) {
      const body = render(new HttpException({ message: zh(key), messageKey: key }, 409), {
        'accept-language': 'en',
      }).body
      expect(body?.code).toBe(ErrorCode.SubmissionConflict)
      expect(body?.message).toBe(translate('en', key))
    }
    expect(zh('prompt.submissionConflict')).toBe('此提交已处理，请核查原提示词')
    expect(zh('subscription.submissionConflict')).toBe('此提交已处理，请核查原订阅')
  })

  it('订阅日期校验默认中文，英文请求返回英文', () => {
    const error = (() => {
      try {
        validateSubscriptionDates({ startDate: '2026-05-02', nextBillingDate: '2026-05-01' })
      } catch (caught) {
        return caught as HttpException
      }
      throw new Error('预期抛出异常')
    })()
    expect(error.message).toBe('下次扣费日期不能早于订阅开始日期')
    expect(english(error)).toBe('The next billing date cannot be earlier than the subscription start date')
  })

  it('站点导航校验携带参数，转抛后英文请求得到英文', () => {
    const external = (index: number) => ({
      type: 'external',
      label: `外链${index}`,
      url: `https://example.org/${index}`,
      newTab: true,
      visible: true,
    })
    const error = (() => {
      try {
        validateSiteExtras({ navigation: [1, 2, 3, 4, 5].map(external) })
      } catch (caught) {
        return caught as HttpException
      }
      throw new Error('预期抛出异常')
    })()
    expect(error).toBeInstanceOf(BadRequestException)
    expect(error.message).toBe('外链导航最多 4 个')
    expect(render(error, { 'accept-language': 'en' }).body).toMatchObject({
      code: ErrorCode.ParamInvalid,
      message: 'You can add up to 4 external navigation items',
    })
    expect(render(error).body?.message).toBe('外链导航最多 4 个')
  })

  it('DTO 自定义上线日期文案按中文反查翻译', () => {
    const error = new BadRequestException({ message: ['上线日期需为 YYYY-MM-DD'], error: 'Bad Request' })
    expect(render(error, { 'accept-language': 'en' }).body?.message).toBe(
      'The launch date must be in YYYY-MM-DD format',
    )
    expect(render(error).body?.message).toBe('上线日期需为 YYYY-MM-DD')
  })

  it('媒体文案：宽度白名单与常量一致，引用计数带参数并登记占用码', () => {
    expect(zh('media.widthUnsupported')).toBe(`图片宽度只支持 ${MEDIA_VARIANT_WIDTHS.join('、')}`)
    const body = render(
      new HttpException(
        {
          message: zh('media.stillReferenced', { count: 3 }),
          messageKey: 'media.stillReferenced',
          messageParams: { count: 3 },
        },
        409,
      ),
      { 'accept-language': 'en' },
    ).body
    expect(body).toMatchObject({
      code: ErrorCode.ResourceInUse,
      message: 'This media is still referenced in 3 places (including revision history) and cannot be removed.',
    })
    expect(zh('media.stillReferenced', { count: 3 })).toBe('媒体仍有 3 处引用（含历史修订），不能移除')
  })
})

describe('持久化中文的读取时翻译', () => {
  it('站点历史原因保持中文写入，按请求语言反查翻译', () => {
    expect(zh('site.reasonUpdate')).toBe('更新站点资料')
    expect(zh('site.reasonRestore', { revision: 12 })).toBe('恢复站点版本 12')
    expect(zh('site.reasonInitial')).toBe(INITIAL_PROFILE_REASON)
    expect(zh('site.reasonSafeInitial')).toBe(SAFE_INITIAL_PROFILE_REASON)
    expect(translateStored('en', '恢复站点版本 12')).toBe('Restored site revision 12')
    expect(translateStored('en', '更新站点资料')).toBe('Updated site settings')
    expect(translateStored('zh-CN', '恢复站点版本 12')).toBe('恢复站点版本 12')
  })

  it('会话设备名保持中文写入，列表按请求语言翻译未知片段', () => {
    const unknown = sessionDeviceLabel('')
    expect(unknown).toBe('未知系统 · 未知客户端')
    expect(localizeDeviceLabel(unknown, 'en')).toBe('Unknown OS · Unknown client')
    expect(localizeDeviceLabel(unknown, 'zh-CN')).toBe('未知系统 · 未知客户端')
    expect(localizeDeviceLabel('macOS · 未知客户端', 'en')).toBe('macOS · Unknown client')
    expect(localizeDeviceLabel('macOS · Chrome', 'en')).toBe('macOS · Chrome')
  })
})
