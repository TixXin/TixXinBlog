/** @file project-values.ts @description 项目标签与外链规范化，不抓取站点或生成外部指标 */
import { BadRequestException } from '@nestjs/common'
import type { SaveProjectDto } from './project.dto'
import { normalizeContentRelations } from '../content-relations/content-relations'
export function projectUrl(value: string) {
  const input = value.trim()
  if (
    /[\\\s]/u.test(input) ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BadRequestException('项目链接不能包含空白、控制字符或反斜杠')
  let normalized: string
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      throw new Error('invalid')
    normalized = url.toString()
  } catch {
    throw new BadRequestException('项目链接需要完整的 HTTP(S) 地址，不能使用占位符或带凭据地址')
  }
  if (normalized.length > 2048) throw new BadRequestException('规范化后的项目链接不能超过2048个字符')
  return normalized
}
export function projectId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException('项目编号不合法')
}
export function projectValues(input: SaveProjectDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([name, value]) => !['requestId', 'revision'].includes(name) && value !== undefined),
  ) as Omit<SaveProjectDto, 'requestId' | 'revision'>
  if (input.tags) {
    const seen = new Set<string>()
    values.tags = input.tags
      .map((tag) => ({ label: tag.label.trim(), color: tag.color }))
      .filter((tag) => {
        const key = tag.label.toLowerCase()
        if (!key) throw new BadRequestException('技术标签名称不能为空')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }
  if (input.relatedContent !== undefined) values.relatedContent = normalizeContentRelations(input.relatedContent)
  if (input.links) {
    if (new Set(input.links.map((link) => link.kind)).size !== input.links.length)
      throw new BadRequestException('同一种项目链接只能填写一个地址')
    values.links = input.links.map((link) => ({ kind: link.kind, href: projectUrl(link.href) }))
  }
  return values
}
