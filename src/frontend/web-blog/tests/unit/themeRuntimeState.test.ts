/** @vitest-environment node */
/**
 * @file themeRuntimeState.test.ts
 * @description 布局主题运行时纯逻辑回归：名称/来源白名单、来源优先级、水合 payload 校验、预览不持久、对账与存储降级
 */
import { describe, expect, it } from 'vitest'
import type { LayoutThemeSource, ThemeStorageLike } from '../../app/features/appearance/themeRuntimeState'
import {
  isLayoutThemeId,
  isLayoutThemeSource,
  LAYOUT_THEME_COOKIE_KEY,
  LAYOUT_THEME_COOKIE_MAX_AGE,
  LAYOUT_THEME_STORAGE_KEY,
  layoutThemeCookieOptions,
  parseQueryLayoutTheme,
  planThemeReconcile,
  readStoredLayoutTheme,
  resolveLayoutTheme,
  writeStoredLayoutTheme,
} from '../../app/features/appearance/themeRuntimeState'

const knownIds = ['nexus', 'aurora', 'dock'] as const
const defaultTheme = 'nexus'

function storageOf(value: string | null): ThemeStorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>()
  if (value !== null) values.set(LAYOUT_THEME_STORAGE_KEY, value)
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, next) => void values.set(key, next),
  }
}

/** 与 useThemeRuntime 水合分支同构：payload 合法时才采用，非法时只回退默认主题/来源，不读 localStorage */
function hydratedPayload(theme: unknown, source: unknown) {
  return {
    theme: isLayoutThemeId(theme, knownIds) ? theme : defaultTheme,
    source: isLayoutThemeSource(source) ? source : 'default',
  }
}

describe('持久化常量', () => {
  it('主题 cookie 是唯一事实源并持久一年，localStorage 只是降级备份', () => {
    expect(LAYOUT_THEME_COOKIE_KEY).toBe('blog-layout-theme')
    expect(LAYOUT_THEME_STORAGE_KEY).toBe('theme-engine:storage')
    expect(LAYOUT_THEME_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365)
    expect(layoutThemeCookieOptions()).toEqual({
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  })
})

describe('isLayoutThemeId', () => {
  it.each(['nexus', 'aurora', 'dock'])('接受已注册主题 %s', (id) => {
    expect(isLayoutThemeId(id, knownIds)).toBe(true)
  })

  it.each([
    ['空字符串', ''],
    ['未知主题', 'unknown-theme'],
    ['大小写不符', 'NEXUS'],
    ['带空格', ' dock '],
    ['原型链键', '__proto__'],
    ['构造函数键', 'constructor'],
    ['数字', 42],
    ['布尔值', true],
    ['null', null],
    ['undefined', undefined],
    ['数组', ['aurora']],
    ['对象', { theme: 'dock' }],
    ['函数', () => 'nexus'],
  ])('拒绝非主题名：%s', (_label, value) => {
    expect(isLayoutThemeId(value, knownIds)).toBe(false)
  })
})

describe('resolveLayoutTheme 来源优先级', () => {
  it('query > cookie > storage：三者同时有效时取 query', () => {
    expect(
      resolveLayoutTheme({ queryTheme: 'aurora', cookieTheme: 'dock', storedTheme: 'nexus' }, knownIds, defaultTheme),
    ).toEqual({ theme: 'aurora', source: 'query' })
  })

  it('query 非法时回退到 cookie', () => {
    expect(
      resolveLayoutTheme({ queryTheme: 'unknown', cookieTheme: 'dock', storedTheme: 'aurora' }, knownIds, defaultTheme),
    ).toEqual({ theme: 'dock', source: 'cookie' })
  })

  it('cookie 优先于 storage：会话 cookie 丢失前的权威值不被旧备份覆盖', () => {
    expect(resolveLayoutTheme({ cookieTheme: 'dock', storedTheme: 'aurora' }, knownIds, defaultTheme)).toEqual({
      theme: 'dock',
      source: 'cookie',
    })
  })

  it('没有 cookie 时用 storage 恢复偏好', () => {
    expect(resolveLayoutTheme({ storedTheme: 'aurora' }, knownIds, defaultTheme)).toEqual({
      theme: 'aurora',
      source: 'storage',
    })
  })

  it('全部无效时回退默认主题', () => {
    expect(
      resolveLayoutTheme({ queryTheme: ['aurora'], cookieTheme: '', storedTheme: 'NEXUS' }, knownIds, defaultTheme),
    ).toEqual({ theme: defaultTheme, source: 'default' })
  })

  it('默认主题不在白名单时原样返回，由调用方保证配置正确', () => {
    expect(resolveLayoutTheme({}, knownIds, 'missing')).toEqual({ theme: 'missing', source: 'default' })
  })
})

describe('isLayoutThemeSource', () => {
  it.each<LayoutThemeSource>(['query', 'cookie', 'storage', 'user', 'default'])('接受合法来源 %s', (source) => {
    expect(isLayoutThemeSource(source)).toBe(true)
  })

  it.each([
    ['空字符串', ''],
    ['未知来源', 'unknown-source'],
    ['大小写不符', 'Query'],
    ['数字', 42],
    ['布尔值', true],
    ['null', null],
    ['undefined', undefined],
    ['数组', ['query']],
    ['对象', { source: 'cookie' }],
    ['原型链键', '__proto__'],
  ])('拒绝非法来源：%s', (_label, value) => {
    expect(isLayoutThemeSource(value)).toBe(false)
  })
})

describe('水合 payload 校验（useThemeRuntime 内联组合）', () => {
  it('信任 SSR payload 里的合法主题与来源，不重新解析 query/cookie/storage', () => {
    expect(hydratedPayload('aurora', 'cookie')).toEqual({ theme: 'aurora', source: 'cookie' })
    expect(hydratedPayload('dock', 'query')).toEqual({ theme: 'dock', source: 'query' })
    expect(hydratedPayload('nexus', 'default')).toEqual({ theme: 'nexus', source: 'default' })
  })

  it('payload 非法时回退默认主题与 default 来源，避免水合期出现未知布局', () => {
    expect(hydratedPayload('unknown', 'cookie')).toEqual({ theme: defaultTheme, source: 'cookie' })
    expect(hydratedPayload(undefined, undefined)).toEqual({ theme: defaultTheme, source: 'default' })
    expect(hydratedPayload(undefined, 'user')).toEqual({ theme: defaultTheme, source: 'user' })
  })

  it('主题与来源独立校验：一个合法不会让另一个非法值透传', () => {
    expect(hydratedPayload('aurora', 'unknown-source')).toEqual({ theme: 'aurora', source: 'default' })
    expect(hydratedPayload('unknown-theme', 'storage')).toEqual({ theme: defaultTheme, source: 'storage' })
  })
})

describe('planThemeReconcile 水合后对账', () => {
  it('?theme= 首屏预览不写任何持久化，也不改动本地备份', () => {
    expect(
      planThemeReconcile({ theme: 'dock', source: 'query' }, { cookieTheme: null, storedTheme: 'aurora' }, knownIds),
    ).toEqual({})
  })

  it('cookie 是权威：storage 备份与 cookie 不一致时同步为 cookie 值', () => {
    expect(
      planThemeReconcile({ theme: 'dock', source: 'cookie' }, { cookieTheme: 'dock', storedTheme: 'aurora' }, knownIds),
    ).toEqual({ syncStorageTo: 'dock' })
  })

  it('cookie 与 storage 一致时没有对账动作', () => {
    expect(
      planThemeReconcile({ theme: 'dock', source: 'cookie' }, { cookieTheme: 'dock', storedTheme: 'dock' }, knownIds),
    ).toEqual({})
  })

  it('用户本会话切换过主题时，按当前主题修复 storage 备份', () => {
    expect(
      planThemeReconcile({ theme: 'aurora', source: 'user' }, { cookieTheme: 'dock', storedTheme: 'dock' }, knownIds),
    ).toEqual({ syncStorageTo: 'aurora' })
  })

  it('没有 cookie 时恢复 storage 里仍有效的偏好（水合后切换，不制造 mismatch）', () => {
    expect(planThemeReconcile({ theme: defaultTheme, source: 'default' }, { storedTheme: 'aurora' }, knownIds)).toEqual(
      { switchTo: 'aurora' },
    )
  })

  it('没有 cookie 且 storage 也无效时保持默认主题', () => {
    expect(
      planThemeReconcile(
        { theme: defaultTheme, source: 'default' },
        { cookieTheme: '', storedTheme: 'unknown' },
        knownIds,
      ),
    ).toEqual({})
    expect(planThemeReconcile({ theme: 'aurora', source: 'default' }, { storedTheme: 'aurora' }, knownIds)).toEqual({})
  })

  it('storage 来源的对账只同步丢失的备份，不产生新的切换', () => {
    expect(planThemeReconcile({ theme: 'aurora', source: 'storage' }, { storedTheme: 'aurora' }, knownIds)).toEqual({})
    expect(planThemeReconcile({ theme: 'aurora', source: 'storage' }, { storedTheme: 'dock' }, knownIds)).toEqual({
      syncStorageTo: 'aurora',
    })
  })
})

describe('readStoredLayoutTheme', () => {
  it('读取有效的本地备份', () => {
    expect(readStoredLayoutTheme(storageOf('aurora'), knownIds)).toBe('aurora')
  })

  it('缺失或非法备份返回 null', () => {
    expect(readStoredLayoutTheme(storageOf(null), knownIds)).toBeNull()
    expect(readStoredLayoutTheme(storageOf('unknown'), knownIds)).toBeNull()
  })

  it('存储不可用（隐私模式/被禁用）时安全返回 null', () => {
    expect(readStoredLayoutTheme(null, knownIds)).toBeNull()
    expect(readStoredLayoutTheme(undefined, knownIds)).toBeNull()
    const throwing: ThemeStorageLike = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
    }
    expect(readStoredLayoutTheme(throwing, knownIds)).toBeNull()
  })
})

describe('writeStoredLayoutTheme', () => {
  it('写入成功返回 true，键名沿用引擎旧键以保留老访客偏好', () => {
    const storage = storageOf(null)
    expect(writeStoredLayoutTheme(storage, 'dock')).toBe(true)
    expect(storage.values.get(LAYOUT_THEME_STORAGE_KEY)).toBe('dock')
  })

  it('存储不可用或写入抛错时返回 false，主题仍在本会话生效', () => {
    expect(writeStoredLayoutTheme(null, 'dock')).toBe(false)
    const throwing: ThemeStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(writeStoredLayoutTheme(throwing, 'dock')).toBe(false)
  })
})

describe('parseQueryLayoutTheme', () => {
  it('字符串原样返回', () => {
    expect(parseQueryLayoutTheme('dock')).toBe('dock')
    expect(parseQueryLayoutTheme('')).toBe('')
  })

  it('数组、对象、数字、布尔与空值一律忽略', () => {
    for (const value of [['dock'], { theme: 'dock' }, 42, true, null, undefined]) {
      expect(parseQueryLayoutTheme(value)).toBeNull()
    }
  })

  it('空字符串不会被当作合法主题（交由白名单校验拒绝）', () => {
    expect(resolveLayoutTheme({ queryTheme: parseQueryLayoutTheme('') }, knownIds, defaultTheme)).toEqual({
      theme: defaultTheme,
      source: 'default',
    })
  })
})
