/**
 * @file highlightCode.ts
 * @description 精简代码高亮器：shiki/core + JavaScript 正则引擎，只注册常用语言并按需懒加载语法，
 *              亮暗两套主题以 CSS 变量同时输出（defaultColor: false），切换明暗不需要重新高亮；
 *              文章 Markdown 与回退渲染的 CodeBlock 共用同一个实例，避免打入 Shiki 全量语言包
 */
import type { HighlighterCore, LanguageRegistration } from 'shiki/core'

type LanguageModule = { default: LanguageRegistration[] }

/** 已注册语言的懒加载入口；按 docs 与现有文章实际出现的语言取舍，未列出的语言回退为纯文本 */
const languageLoaders: Record<string, () => Promise<LanguageModule>> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  docker: () => import('shiki/langs/docker.mjs'),
  nginx: () => import('shiki/langs/nginx.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  wgsl: () => import('shiki/langs/wgsl.mjs'),
}

/** 常见别名归一到注册名 */
const aliases: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  bash: 'shellscript',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  console: 'shellscript',
  ps1: 'powershell',
  pwsh: 'powershell',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  dockerfile: 'docker',
  json5: 'jsonc',
  svg: 'xml',
  conf: 'nginx',
  patch: 'diff',
}

/** 代码块标签展示名；未注册语言直接展示原始标记 */
const displayNames: Record<string, string> = {
  typescript: 'TypeScript',
  tsx: 'TSX',
  javascript: 'JavaScript',
  jsx: 'JSX',
  vue: 'Vue',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  jsonc: 'JSONC',
  shellscript: 'Shell',
  powershell: 'PowerShell',
  sql: 'SQL',
  yaml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  markdown: 'Markdown',
  diff: 'Diff',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  docker: 'Dockerfile',
  nginx: 'Nginx',
  xml: 'XML',
  wgsl: 'WGSL',
  text: '文本',
}

const plainLanguages = new Set(['', 'text', 'txt', 'plain', 'plaintext'])

/** 解析 Markdown 代码块语言：返回注册名，纯文本返回 'text'，未注册返回 null */
export function resolveCodeLanguage(language?: string | null): string | null {
  const key = (language ?? '').trim().toLowerCase()
  if (plainLanguages.has(key)) return 'text'
  const name = aliases[key] ?? key
  return name in languageLoaders ? name : null
}

/** 代码块标签文本 */
export function codeLanguageLabel(language?: string | null): string {
  const resolved = resolveCodeLanguage(language)
  return resolved ? displayNames[resolved]! : (language ?? '').trim().slice(0, 24)
}

/** 收集 Markdown 中出现的已注册语言，用于渲染前按需加载语法 */
export function collectCodeLanguages(markdown: string): string[] {
  const found = new Set<string>()
  for (const match of markdown.matchAll(/^ {0,3}(?:`{3,}|~{3,})[ \t]*([^\s`{]+)/gm)) {
    const resolved = resolveCodeLanguage(match[1])
    if (resolved && resolved !== 'text') found.add(resolved)
  }
  return [...found]
}

/** 同步高亮接口：语法已加载时返回 HTML，否则返回 null 由调用方回退纯文本 */
export interface CodeHighlighter {
  highlight(code: string, language?: string | null): string | null
}

/** 单行分词时间上限（毫秒） */
const TOKENIZE_TIME_LIMIT = 5000

let corePromise: Promise<HighlighterCore> | undefined
const loadedLanguages = new Set<string>(['text'])

function loadCore() {
  corePromise ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light.mjs'),
    // 高对比主题的注释色在站点 --surface-2 背景上达到 4.5:1，亮色主题保持不变。
    import('shiki/themes/github-dark-high-contrast.mjs'),
  ])
    .then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark]) =>
      createHighlighterCore({
        themes: [light.default, dark.default],
        langs: [],
        // forgiving：个别语法规则无法转换时跳过该规则而非整体报错
        engine: createJavaScriptRegexEngine({ forgiving: true }),
      }),
    )
    .catch((error: unknown) => {
      corePromise = undefined
      throw error
    })
  return corePromise
}

function createFacade(core: HighlighterCore): CodeHighlighter {
  return {
    highlight(code, language) {
      const resolved = resolveCodeLanguage(language)
      if (!resolved || !loadedLanguages.has(resolved)) return null
      try {
        const html = core.codeToHtml(code, {
          lang: resolved,
          themes: { light: 'github-light', dark: 'github-dark-high-contrast' },
          // 只输出 --shiki-light/--shiki-dark 变量，由样式按站点明暗模式选择
          defaultColor: false,
          // 语法规则在首次使用时才编译，默认 500ms 预算可能在首次渲染时耗尽，剩余文本退化为无高亮正文色；
          // 放宽到 5s 保证首次输出与后续一致，同时仍为异常输入保留上限，避免长时间阻塞渲染。
          tokenizeTimeLimit: TOKENIZE_TIME_LIMIT,
        })
        // 完整转义文本中的注释结束符，兼容会把裸结束符误判为标记的 HTML 解析器。
        return html.replace(/(--!?)>/g, '$1&gt;')
      } catch {
        return null
      }
    },
  }
}

/** 加载高亮器与指定语言；语言加载失败只影响该语言（回退纯文本） */
export async function loadCodeHighlighter(languages: string[] = []): Promise<CodeHighlighter> {
  const core = await loadCore()
  const pending = [...new Set(languages.map(resolveCodeLanguage).filter((name): name is string => !!name))].filter(
    (name) => !loadedLanguages.has(name),
  )
  await Promise.all(
    pending.map(async (name) => {
      try {
        const module = await languageLoaders[name]!()
        await core.loadLanguage(module.default)
        loadedLanguages.add(name)
      } catch {
        // 单个语言加载失败时保持纯文本回退
      }
    }),
  )
  return createFacade(core)
}

/** 代码高亮的安全边界：仅返回高亮器结果，未知语言或失败返回空串，由组件使用文本节点兜底 */
export async function highlightCode(code: string, language = 'text'): Promise<string> {
  try {
    if (!resolveCodeLanguage(language)) return ''
    const highlighter = await loadCodeHighlighter([language])
    return highlighter.highlight(code, language) ?? ''
  } catch {
    return ''
  }
}
