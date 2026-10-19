/** @vitest-environment node */
/**
 * @file themeRegistry.test.ts
 * @description 三主题注册契约：真实宿主能力、引擎生成元信息与非法主题标识回退
 */
import { describe, expect, it } from 'vitest'
import { themeEngineOptions, themeEngineThemeNames, themeEngineThemes } from '#build/theme-engine.options.mjs'
import { themeEngineContracts } from '#build/theme-engine.contracts.mjs'
import { themeComponentRegistry } from '#build/theme-engine.registry.mjs'
import {
  DEFAULT_LAYOUT_THEME_ID,
  ensureKnownThemeId,
  isKnownLayoutThemeId,
  themeHostConfigs,
} from '../../app/features/appearance/themeRegistry'
import { themeContractNames } from '../../theme-contracts'
import nexusConfig from '../../themes/nexus/theme.config'
import auroraConfig from '../../themes/aurora/theme.config'
import dockConfig from '../../themes/dock/theme.config'
import nexusDefinition from '../../themes/nexus/theme.json'
import auroraDefinition from '../../themes/aurora/theme.json'
import dockDefinition from '../../themes/dock/theme.json'

const hostConfigs = { nexus: nexusConfig, aurora: auroraConfig, dock: dockConfig }
// 读取字典原文：直接 import JSON 会被 i18n 插件预编译成消息函数
const themeDictionaries = import.meta.glob<string>('../../i18n/locales/*/theme.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function lookup(dictionary: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary)
}
const themeDefinitions = [nexusDefinition, auroraDefinition, dockDefinition]

describe('三主题真实能力与注册契约', () => {
  it('生成的宿主配置保留三主题声明和展示顺序', () => {
    expect(Object.keys(themeHostConfigs)).toEqual(['nexus', 'aurora', 'dock'])
    expect(themeHostConfigs).toEqual(hostConfigs)
    expect(DEFAULT_LAYOUT_THEME_ID).toBe('nexus')
    expect(themeEngineOptions.defaultTheme).toBe(DEFAULT_LAYOUT_THEME_ID)
  })

  it.each([
    ['nexus', true, true, ['colorMode', 'contentTransition', 'sidebarAnimation']],
    ['aurora', false, true, ['colorMode', 'contentTransition', 'sidebarAnimation']],
    ['dock', false, false, ['colorMode', 'contentTransition']],
  ] as const)('%s 只声明自身支持的侧栏和定制能力', (id, leftSidebar, rightSidebar, customizer) => {
    expect(hostConfigs[id].capabilities).toEqual({ leftSidebar, rightSidebar, customizer })
    expect(new Set(hostConfigs[id].capabilities.customizer).size).toBe(customizer.length)
  })

  it('引擎发现的主题与宿主注册集合一致，元信息来自各主题定义', () => {
    expect([...themeEngineThemeNames].sort()).toEqual(Object.keys(hostConfigs).sort())
    expect(themeEngineThemes).toHaveLength(themeDefinitions.length)
    for (const definition of themeDefinitions) {
      expect(themeEngineThemes).toContainEqual(expect.objectContaining(definition))
      expect(definition.label.trim()).not.toBe('')
      expect(definition.description.trim()).not.toBe('')
    }
  })

  it('主题名称与介绍写 theme 域字典 key，中英字典均有非空文案', () => {
    const dictionaries = Object.entries(themeDictionaries).map(([path, raw]) => [path, JSON.parse(raw)] as const)
    expect(dictionaries.map(([path]) => path.split('/').at(-2)).sort()).toEqual(['en', 'zh-CN'])
    for (const definition of themeDefinitions) {
      expect(definition.label).toBe(`theme.themes.${definition.name}.label`)
      expect(definition.description).toBe(`theme.themes.${definition.name}.description`)
      for (const [, dictionary] of dictionaries) {
        for (const key of [definition.label, definition.description]) {
          const text = lookup(dictionary, key)
          expect(typeof text === 'string' && text.trim()).toBeTruthy()
        }
      }
    }
  })

  it.each([
    ['nexus', nexusDefinition, nexusConfig],
    ['aurora', auroraDefinition, auroraConfig],
    ['dock', dockDefinition, dockConfig],
  ] as const)('%s 的宿主回退版本和 Lucide 图标与主题元信息一致', (id, definition, config) => {
    expect(definition.name).toBe(id)
    expect(config.version).toBe(definition.meta.version)
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(config.icon).toBe(definition.meta.icon)
    expect(config.icon).toMatch(/^lucide:[a-z0-9-]+$/)
  })

  it('生成的组件注册使用宿主逻辑契约并覆盖各主题所需的组件', () => {
    expect(themeEngineContracts.importId).toBe('#theme-contracts')
    expect(themeContractNames).toEqual(['RootLayout', 'ThemeAccessory', 'StatusFooter', 'SidebarNav', 'PostCard'])
    for (const id of Object.keys(hostConfigs)) {
      const registry = themeComponentRegistry[id]
      expect(Object.keys(registry)).toEqual(
        expect.arrayContaining(['RootLayout', 'ThemeAccessory', 'StatusFooter', 'PostCard']),
      )
      for (const logicalName of ['RootLayout', 'ThemeAccessory', 'StatusFooter', 'PostCard']) {
        expect(registry[logicalName]).toMatchObject({ sourceTheme: id })
        expect(registry[logicalName].alias).toEqual(expect.stringContaining(logicalName))
      }
      if (themeHostConfigs[id]?.capabilities.leftSidebar) {
        expect(registry).toHaveProperty('SidebarNav')
      }
    }
  })
})

describe('主题标识校验和回退', () => {
  it.each(['nexus', 'aurora', 'dock'])('已注册主题 %s 保留自身标识', (id) => {
    expect(isKnownLayoutThemeId(id)).toBe(true)
    expect(ensureKnownThemeId(id)).toBe(id)
  })

  it.each([
    '',
    'unknown-theme',
    'NEXUS',
    ' nexus',
    'nexus ',
    'dock/../nexus',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    'valueOf',
    '[object Object]',
  ])('非法或继承属性标识 %j 回退到默认主题', (id) => {
    expect(isKnownLayoutThemeId(id)).toBe(false)
    expect(ensureKnownThemeId(id)).toBe(DEFAULT_LAYOUT_THEME_ID)
  })
})
