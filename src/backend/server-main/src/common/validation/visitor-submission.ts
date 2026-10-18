/** @file visitor-submission.ts @description 访客表单的蜜罐与最短填写时间校验，不向业务或持久层传递防垃圾字段。 */
import { BadRequestException } from '@nestjs/common'
import { ValidateBy } from 'class-validator'

export interface VisitorSubmissionFields {
  website?: string
  formRenderedAt?: number
}

const rejectionMessage = '提交未完成，请稍后重试'
const minimumFillTime = 1000

function validField(field: keyof VisitorSubmissionFields, value: unknown): boolean {
  if (value === undefined) return true
  // 蜜罐不去除空白，也不接受 null 等非字符串值。
  if (field === 'website') return value === ''
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && Date.now() - value >= minimumFillTime
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
  const { website, formRenderedAt, ...submission } = body
  if (!validField('website', website) || !validField('formRenderedAt', formRenderedAt)) {
    throw new BadRequestException(rejectionMessage)
  }
  return submission
}
