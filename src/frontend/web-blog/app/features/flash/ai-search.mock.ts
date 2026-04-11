/**
 * @file ai-search.mock.ts
 * @description 闪念 AI 搜索的 mock 实现，模拟「思考延迟 + 结构化回答 + 引用」
 * @author TixXin
 * @since 2026-04-11
 *
 * 不接入真实 LLM，仅做关键词命中 + 模板拼接，未来可整体替换为 $fetch('/api/flash/ai-search')。
 */

import type { FlashAISearchResult, FlashNote } from './types'

/** 中英文混合分词：按空格、标点、CJK 字符边界切分；保留长度 ≥ 2 的 token */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，.。!！?？;；:：、/\\()（）【】"'`]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
}

/** 简单评分：标签命中权重 3、正文命中权重 1 */
function scoreNote(note: FlashNote, tokens: string[]): number {
  if (tokens.length === 0) return 0
  const content = note.content.toLowerCase()
  const tags = note.tags.map((t) => t.toLowerCase())
  let score = 0
  for (const token of tokens) {
    if (tags.some((t) => t.includes(token))) score += 3
    if (content.includes(token)) score += 1
  }
  return score
}

/** 模拟思考延迟 */
function simulatedLatency(): number {
  return Math.round(800 + Math.random() * 700)
}

/** 等待 N 毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 对当前用户的闪念列表执行 mock AI 搜索。
 * 命中规则：分词 → 给每条笔记评分 → 取 top 4。
 */
export async function mockFlashAISearch(query: string, notes: FlashNote[]): Promise<FlashAISearchResult> {
  const latencyMs = simulatedLatency()
  await delay(latencyMs)

  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return {
      answer: '请输入想要回顾的关键词，比如「读书」「灵感」或「6 月」。',
      citedNoteIds: [],
      latencyMs,
    }
  }

  const ranked = notes
    .map((note) => ({ note, score: scoreNote(note, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  if (ranked.length === 0) {
    return {
      answer: `还没有和「${query}」相关的闪念，要不要现在就记一条？`,
      citedNoteIds: [],
      latencyMs,
    }
  }

  const summary = ranked
    .map((entry, idx) => `${idx + 1}. ${truncate(entry.note.content, 60)}`)
    .join('\n')

  const tagPool = new Set<string>()
  ranked.forEach((entry) => entry.note.tags.forEach((t) => tagPool.add(t)))
  const tagHint = tagPool.size > 0 ? `相关标签：${[...tagPool].slice(0, 5).join(' / ')}` : ''

  const answer = [
    `根据你的 ${ranked.length} 条闪念，关于「${query}」我整理了以下要点：`,
    '',
    summary,
    '',
    tagHint,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    answer,
    citedNoteIds: ranked.map((entry) => entry.note.id),
    latencyMs,
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
