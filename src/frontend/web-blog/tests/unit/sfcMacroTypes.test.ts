/**
 * @file sfcMacroTypes.test.ts
 * @description defineProps/defineEmits 的类型参数必须在组件内声明：Docker 构建中 SFC 编译器无法经 ~/ 别名解析外部类型，本地构建发现不了
 * @author TixXin
 * @since 2026-10-22
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, it } from 'vitest'

const root = join(__dirname, '../..')

function listVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listVueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

it('defineProps 与 defineEmits 的类型参数不引用 ~/ 或 @/ 别名下的外部类型', () => {
  const offenders: string[] = []
  for (const file of [...listVueFiles(join(root, 'app')), ...listVueFiles(join(root, 'themes'))]) {
    const source = readFileSync(file, 'utf8')
    for (const [, name] of source.matchAll(/define(?:Props|Emits)<([A-Z]\w*)>/g)) {
      const importLine = source.match(new RegExp(`import[^\\n]*\\b${name}\\b[^\\n]*from '([^']+)'`))
      if (importLine?.[1] && /^[~@]\//.test(importLine[1])) offenders.push(`${relative(root, file)}: ${name}`)
    }
  }
  expect(offenders).toEqual([])
})
