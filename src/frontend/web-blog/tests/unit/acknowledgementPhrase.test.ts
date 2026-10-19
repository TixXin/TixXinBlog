/**
 * @file acknowledgementPhrase.test.ts
 * @description 确认短语按界面语言输入，只有与当前语言短语完全一致时才换回后端认可的原值
 * @author TixXin
 * @since 2026-10-19
 */
import { describe, expect, it } from 'vitest'
import zhSystem from '../../i18n/locales/zh-CN/admin-system.json?raw'
import enSystem from '../../i18n/locales/en/admin-system.json?raw'
import zhContent from '../../i18n/locales/zh-CN/admin-content.json?raw'
import enContent from '../../i18n/locales/en/admin-content.json?raw'
import { IMPORT_ACKNOWLEDGEMENT, importAcknowledgement } from '../../app/features/backup/types'
import { POST_DELETE_ACKNOWLEDGEMENT, postDeleteAcknowledgement } from '../../app/features/post/batchTypes'

function translator(...sources: string[]) {
  const messages = Object.assign({}, ...sources.map((source) => JSON.parse(source)))
  return (key: string) =>
    String(
      key
        .split('.')
        .reduce((node: Record<string, unknown>, part) => node?.[part] as Record<string, unknown>, messages) ?? key,
    )
}
const zh = translator(zhSystem, zhContent)
const en = translator(enSystem, enContent)

describe('确认短语', () => {
  it('中文界面的短语即后端原值，流程不变', () => {
    expect(importAcknowledgement('导入为新草稿', zh)).toBe(IMPORT_ACKNOWLEDGEMENT)
    expect(postDeleteAcknowledgement('永久删除', zh)).toBe(POST_DELETE_ACKNOWLEDGEMENT)
    expect(importAcknowledgement('import as new drafts', zh)).toBeNull()
  })

  it('英文界面要求输入英文短语，提交中文原值；中文原值、大小写或空白不符都不通过', () => {
    expect(importAcknowledgement('import as new drafts', en)).toBe('导入为新草稿')
    expect(postDeleteAcknowledgement('delete permanently', en)).toBe('永久删除')
    for (const typed of ['导入为新草稿', 'Import as new drafts', ' import as new drafts', ''])
      expect(importAcknowledgement(typed, en)).toBeNull()
    for (const typed of ['永久删除', 'delete permanently ', 'DELETE PERMANENTLY'])
      expect(postDeleteAcknowledgement(typed, en)).toBeNull()
  })
})
