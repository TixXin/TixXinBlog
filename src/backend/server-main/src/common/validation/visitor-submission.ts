/** @file visitor-submission.ts @description 访客表单的蜜罐与最短填写时间校验，不向业务或持久层传递防垃圾字段。 */
import { BadRequestException } from '@nestjs/common'
import { ValidateBy } from 'class-validator'

export interface VisitorSubmissionFields {
  website?: string
  /** 表单打开到提交经过的毫秒数，由客户端单调时钟计算，不依赖设备时间 */
  formElapsedMs?: number
  /** 旧客户端的渲染时间戳；为兼容仍接受，但不再参与时间判断 */
  formRenderedAt?: number
}

const rejectionMessage = '提交未完成，请稍后重试'
/** 最短填写时间 */
export const MIN_FORM_ELAPSED_MS = 1000
/** 合理上限：表单开着超过 30 天视为异常值，前端上报前同样截断到该值 */
export const MAX_FORM_ELAPSED_MS = 30 * 24 * 60 * 60 * 1000

function validField(field: keyof VisitorSubmissionFields, value: unknown): boolean {
  if (value === undefined) return true
  // 蜜罐不去除空白，也不接受 null 等非字符串值。
  if (field === 'website') return value === ''
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false
  if (field === 'formRenderedAt') return value > 0
  return value >= MIN_FORM_ELAPSED_MS && value <= MAX_FORM_ELAPSED_MS
}

/** 保留 DTO 白名单并用同一通用错误拒绝非法字段，不泄露命中的防垃圾规则。 */
export function ValidateVisitorSubmissionField(field: keyof VisitorSubmissionFields): PropertyDecorator {
  return ValidateBy({
    name: 'visitorSubmissionField',
    validator: {
      validate: (value: unknown) => validField(field, value),
      defaultMessage: () => rejectionMessage,
    },
  })
}

/** 在业务调用前再次校验并剥离临时字段，避免影响原提交幂等摘要及内容持久化。 */
export function validateVisitorSubmission<T extends VisitorSubmissionFields>(
  body: T,
): Omit<T, keyof VisitorSubmissionFields> {
  const { website, formElapsedMs, formRenderedAt, ...submission } = body
  if (
    !validField('website', website) ||
    !validField('formElapsedMs', formElapsedMs) ||
    !validField('formRenderedAt', formRenderedAt)
  ) {
    throw new BadRequestException(rejectionMessage)
  }
  return submission
}
