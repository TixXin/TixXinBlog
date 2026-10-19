/**
 * @file translate.ts
 * @description 按 key 渲染中英文案：异常携带 key 与参数，过滤器按请求语言翻译；持久化的中文文案在读取时按字典模板反查
 * @author TixXin
 * @since 2026-10-19
 */
import { MESSAGES } from './messages'
import type { MessageEntry } from './messages/types'
import { DEFAULT_API_LOCALE, type ApiLocale } from './locale'

export type MessageKey = keyof typeof MESSAGES
export type MessageParams = Readonly<Record<string, string | number>>

/**
 * 可本地化的异常正文：message 为中文渲染结果，Nest 异常的 message 与日志沿用中文；
 * 全局过滤器读取 messageKey 与 messageParams，按请求语言重新渲染。
 */
export interface LocalizedMessage {
  message: string
  messageKey: MessageKey
  messageParams?: MessageParams
}

const PLACEHOLDER = /\{(\w+)\}/g

function entryOf(key: string): MessageEntry | undefined {
  return Object.hasOwn(MESSAGES, key) ? (MESSAGES as Record<string, MessageEntry>)[key] : undefined
}

function render(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  )
}

/** 按语言渲染；未知 key 原样返回，便于测试发现遗漏 */
export function translate(locale: ApiLocale, key: MessageKey | string, params?: MessageParams): string {
  const entry = entryOf(key)
  if (!entry) return key
  return render(locale === 'en' ? entry.en : entry.zh, params)
}

/** 中文渲染结果；用于写入数据库的计划原因、审计字段等需要保持中文的持久化内容 */
export function zh(key: MessageKey, params?: MessageParams): string {
  return translate(DEFAULT_API_LOCALE, key, params)
}

/** 构造可本地化的异常正文，可直接传给 BusinessException 与 Nest 内置 HttpException */
export function msg(key: MessageKey, params?: MessageParams): LocalizedMessage {
  return params
    ? { message: zh(key, params), messageKey: key, messageParams: params }
    : { message: zh(key), messageKey: key }
}

export function isLocalizedMessage(value: unknown): value is LocalizedMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as LocalizedMessage).message === 'string' &&
    typeof (value as LocalizedMessage).messageKey === 'string' &&
    !!entryOf((value as LocalizedMessage).messageKey)
  )
}

/** 字典为该文案登记的稳定业务码 */
export function messageCode(key: MessageKey | string): number | undefined {
  return entryOf(key)?.code
}

type StoredPattern = { key: MessageKey; names: string[]; pattern: RegExp; literal: number }
let exactIndex: Map<string, MessageKey> | undefined
let patternIndex: StoredPattern[] | undefined

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildIndexes() {
  exactIndex = new Map()
  patternIndex = []
  for (const [key, entry] of Object.entries(MESSAGES) as [MessageKey, MessageEntry][]) {
    const names = [...entry.zh.matchAll(PLACEHOLDER)].map((match) => match[1]!)
    if (!names.length) {
      if (!exactIndex.has(entry.zh)) exactIndex.set(entry.zh, key)
      continue
    }
    const parts = entry.zh.split(PLACEHOLDER).filter((_part, index) => index % 2 === 0)
    const literal = parts.join('').length
    // 只有占位符、没有固定文字的模板会匹配任意文本，不参与反查。
    if (!literal) continue
    const pattern = new RegExp(`^${parts.map(escapeRegExp).join('([\\s\\S]+?)')}$`)
    patternIndex.push({ key, names, pattern, literal })
  }
  // 固定文字更多的模板更具体，优先匹配。
  patternIndex.sort((a, b) => b.literal - a.literal)
}

/**
 * 反查已持久化的中文文案（导入计划原因、批量结果、审计字段等），能匹配字典模板时返回 key 与参数；
 * 用户内容或历史文案不在字典中时返回 undefined。
 */
export function storedMessage(text: string): LocalizedMessage | undefined {
  if (!exactIndex || !patternIndex) buildIndexes()
  const exact = exactIndex!.get(text)
  if (exact) return { message: text, messageKey: exact }
  for (const candidate of patternIndex!) {
    const match = candidate.pattern.exec(text)
    if (!match) continue
    const params: Record<string, string> = {}
    candidate.names.forEach((name, index) => {
      params[name] = match[index + 1]!
    })
    return { message: text, messageKey: candidate.key, messageParams: params }
  }
  return undefined
}

/** 按请求语言显示已持久化的中文文案；中文请求和字典外文本原样返回 */
export function translateStored(locale: ApiLocale, text: string): string {
  if (locale === DEFAULT_API_LOCALE || !text) return text
  const found = storedMessage(text)
  return found ? translate(locale, found.messageKey, found.messageParams) : text
}

/** 把持久化文案重新抛给客户端时保留 key，使英文请求也能得到翻译 */
export function rethrowable(text: string): LocalizedMessage | string {
  return storedMessage(text) ?? text
}
