/** @file requestFailure.ts @description 友链与友链申请请求的统一错误文案：5xx 与网络故障不暴露细节，4xx 优先使用后端 message */
import { apiErrorMessage } from '~/utils/apiError'
import type { Translate } from '~/utils/format'

export function linkRequestFailure(value: unknown, t: Translate) {
  const cause = value as { statusCode?: number; status?: number },
    statusCode = cause?.statusCode ?? cause?.status
  const message =
    !statusCode || statusCode >= 500
      ? t('interaction.links.serviceUnavailable')
      : apiErrorMessage(value, statusCode === 404 ? 'interaction.links.notFound' : 'interaction.links.invalid', { t })
  return Object.assign(new Error(message, { cause: value }), { statusCode })
}

/** 取请求失败的状态码，用于识别版本冲突 */
export function failureStatus(cause: unknown) {
  return (cause as { statusCode?: number } | null)?.statusCode
}

/** 已生成文案的错误直接展示，其余使用给定的兜底文案 */
export function failureText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}
