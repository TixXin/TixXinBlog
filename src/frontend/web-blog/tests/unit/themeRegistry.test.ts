/** @vitest-environment node */
/**
 * @file themeRegistry.test.ts
 * @description 四主题契约（RootLayout/ThemeAccessory/StatusFooter/PostCard）、宿主能力位与引擎生成元信息
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
    // 引擎构建期常量必须与宿主运行时同源，否则 cookieKey 漂移会让 SSR 首屏选错主题
    expect(themeEngineOptions.defaultTheme).toBe('nexus')
    expect(themeEngineOptions.cookieKey).toBe('blog-layout-theme')
  })

  it.each([
    [
      'nexus',
      {
        rightSidebar: true,
        rightSidebarBreakpoint: 1440,
        mobileNav: true,
        guestbookChat: true,
        momentInfoPlacement: 'left',
      },
      ['colorMode', 'contentTransition', 'sidebarAnimation'],
    ],
    [
      'aurora',
      {
        rightSidebar: true,
        rightSidebarBreakpoint: 1280,
        mobileNav: true,
        guestbookChat: false,
        momentInfoPlacement: 'right',
      },
      ['colorMode', 'contentTransition', 'sidebarAnimation'],
    ],
    [
      'dock',
      {
        rightSidebar: false,
        mobileNav: false,
        guestbookChat: false,
      },
      ['colorMode', 'contentTransition'],
    ],
  ] as const)('%s 只用能力位声明侧栏断点、移动导航、留言聊天态与朋友圈资料归属', (id, capabilities, customizer) => {
    // 能力位替代宿主里按主题 id 写死的分支，新增主题只需补齐这张表
    expect(hostConfigs[id].capabilities).toMatchObject(capabilities)
    expect(hostConfigs[id].capabilities.customizer).toEqual(customizer)
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
    ['nexus', nexusDefinition],
    ['aurora', auroraDefinition],
    ['dock', dockDefinition],
  ] as const)('%s 的版本与图标只来自 theme.json，theme.config 不再重复维护', (id, definition) => {
    const engineTheme = (themeEngineThemes as Array<{ name: string; meta?: Record<string, unknown> }>).find(
      (theme) => theme.name === id,
    )
    expect(engineTheme?.meta).toMatchObject(definition.meta)
    expect(definition.meta.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(definition.meta.icon).toMatch(/^lucide:[a-z0-9-]+$/)
    // 宿主配置只剩 capabilities；再写一份 version/icon 会重新制造双事实源
    expect(hostConfigs[id]).not.toHaveProperty('version')
    expect(hostConfigs[id]).not.toHaveProperty('icon')
  })

  it('契约收缩为 4 个逻辑组件，SidebarNav 不再出现', () => {
    expect(themeEngineContracts.importId).toBe('#theme-contracts')
    expect(themeContractNames).toEqual(['RootLayout', 'ThemeAccessory', 'StatusFooter', 'PostCard'])
    expect(themeContractNames).not.toContain('SidebarNav')
  })

  it('生成的组件注册保证 RootLayout 必有，PostCard/StatusFooter 可由宿主默认壳层承接', () => {
    for (const id of Object.keys(hostConfigs)) {
      const registry = themeComponentRegistry[id]
      // RootLayout 是唯一必选契约：所有主题必须提供自己的布局壳
      expect(registry.RootLayout).toMatchObject({ sourceTheme: id })
      expect(registry.RootLayout.alias).toEqual(expect.stringContaining('RootLayout'))
      // 其余契约允许主题缺省：PostCard/StatusFooter 退回宿主默认壳层，ThemeAccessory 合法不渲染
      for (const optionalContract of ['ThemeAccessory', 'StatusFooter', 'PostCard'] as const) {
        const entry = registry[optionalContract]
        if (!entry) continue
        expect(entry).toMatchObject({ sourceTheme: id })
        expect(entry.alias).toEqual(expect.stringContaining(optionalContract))
      }
      // 僵尸契约已从宿主删除，主题侧不得再暴露同名组件
      expect(registry).not.toHaveProperty('SidebarNav')
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
