/** @file preview.ts @description 草稿预览凭据规范化与请求错误脱敏 */
import { currentTranslate, type Translate } from '~/utils/format'

/** 缺失、重复或过长的令牌均不作为有效预览凭据。 */
export function postPreviewToken(value: unknown): string {
  return typeof value === 'string' && value.length <= 4096 ? value : ''
}

/** 不把可能含令牌的底层请求地址与错误正文展示或序列化到页面。 */
export function postPreviewError(error: unknown, t: Translate = currentTranslate()) {
  const status = Number(
    (error as { statusCode?: number; status?: number } | null)?.statusCode ??
      (error as { status?: number } | null)?.status,
  )
  const invalid = [400, 401, 403, 404, 410].includes(status)
  return createError({
    statusCode: invalid ? status : 503,
    message: invalid ? t('article.preview.invalidLink') : t('article.preview.unavailable'),
  })
}
