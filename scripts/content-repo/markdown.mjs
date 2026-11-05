/**
 * @file markdown.mjs
 * @description 内容仓库的 Markdown 文件读写：YAML frontmatter 加正文，正文逐字保留。
 *              写出时正文末尾固定补一个换行，读取时只去掉这一个，往返不改动正文。
 * @author TixXin
 * @since 2026-11-05
 */
import { parse, stringify } from 'yaml'

/** YAML 输出不折行，字符串原样保留，便于 Git 对比 */
export const YAML_OPTIONS = { lineWidth: 0, minContentWidth: 0, aliasDuplicateObjects: false }

export function toYaml(value) {
  return stringify(value, YAML_OPTIONS)
}

export function fromYaml(text, path) {
  try {
    return parse(text, { uniqueKeys: true })
  } catch (error) {
    throw new Error(`${path}：YAML 无法解析（${error.message}）`)
  }
}

export function writeMarkdown(frontmatter, body) {
  return `---\n${toYaml(frontmatter)}---\n${body}\n`
}

export function readMarkdown(text, path) {
  // 只有整份文件被工具转成 CRLF（开头即 ---\r\n）时才统一换行，否则正文里的 \r 原样保留
  const normalized = text.startsWith('---\r\n') ? text.replace(/\r\n/g, '\n') : text
  if (!normalized.startsWith('---\n')) throw new Error(`${path}：缺少开头的 --- frontmatter`)
  const end = normalized.indexOf('\n---\n', 3)
  if (end === -1) throw new Error(`${path}：frontmatter 没有以 --- 结束`)
  const frontmatter = fromYaml(normalized.slice(4, end + 1), path)
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter))
    throw new Error(`${path}：frontmatter 必须是键值对象`)
  const rest = normalized.slice(end + 5)
  return { frontmatter, body: rest.endsWith('\n') ? rest.slice(0, -1) : rest }
}
