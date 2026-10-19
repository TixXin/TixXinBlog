/**
 * @file index.ts
 * @description 后端接口文案国际化入口：语言解析、字典渲染与持久化中文的读取时翻译
 * @author TixXin
 * @since 2026-10-19
 */
export { siteDefaultLocale } from './site-locale'
export { API_LOCALES, DEFAULT_API_LOCALE, requestLocale, resolveApiLocale, type ApiLocale } from './locale'
export {
  isLocalizedMessage,
  messageCode,
  msg,
  rethrowable,
  storedMessage,
  translate,
  translateStored,
  zh,
  type LocalizedMessage,
  type MessageKey,
  type MessageParams,
} from './translate'
