/**
 * @file messages.ts
 * @description 闪念与朋友圈非组件模块（仓库、composable 抛出的错误）的界面文案：调用时按当前界面语言翻译；
 *              脱离 Nuxt 上下文（如 SSR 异步链中途）取不到 i18n 时回退到与 zh-CN 字典逐字一致的中文，不显示裸 key
 * @author TixXin
 * @since 2026-10-19
 */
import { currentTranslate, type Translate } from '~/utils/format'

/** 中文兜底；与 i18n/locales/zh-CN/flash-moment.json 的同名条目逐字一致，由单测校验 */
export const FLASH_MOMENT_FALLBACK_MESSAGES: Readonly<Record<string, string>> = {
  'flash-moment.request.flashUnavailable': '闪念服务暂时不可用，请稍后重试',
  'flash-moment.request.sessionExpired': '登录已失效，请重新登录后重试',
  'flash-moment.request.flashInvalid': '闪念操作未完成，请检查输入后重试',
  'flash-moment.request.archiveNeedsLogin': '归档内容需要博主登录',
  'flash-moment.request.ownerChanged': '闪念所属身份或内容库已变化，请重新核对后操作',
  'flash-moment.request.momentUnavailable': '朋友圈服务暂时不可用，请稍后重试',
  'flash-moment.request.momentNotFound': '动态不存在或尚未公开',
  'flash-moment.request.momentInvalid': '操作未完成，请检查输入后重试',
  'flash-moment.request.momentFailed': '朋友圈请求未成功',
  'flash-moment.comment.pendingSubmitted': '已提交，待博主审核后公开',
  'flash-moment.comment.sent': '评论已发送',
}

/** 每次调用时求值；传入 t 时优先使用，翻译结果仍是 key 本身时按兜底表返回中文 */
export function flashMomentMessage(key: string, t: Translate = currentTranslate()): string {
  const text = t(key)
  return text && text !== key ? text : (FLASH_MOMENT_FALLBACK_MESSAGES[key] ?? key)
}
