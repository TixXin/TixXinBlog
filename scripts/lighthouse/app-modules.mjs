/**
 * @file app-modules.mjs
 * @description 让裸 node 加载前端领域模块：解析 Nuxt 的 ~ 与 ~~ 别名，并把 nuxt/app 换成脱离应用上下文的桩；
 *   同时按 zh-CN 字典提供翻译函数，使夹具里的缺省页脚与每日一言是自然文案而不是字典 key。
 * 只供 Lighthouse 夹具使用，不改变应用自身的模块解析。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const web = resolve(fileURLToPath(new URL('../../src/frontend/web-blog', import.meta.url)))
const NUXT_APP_STUB = 'data:text/javascript,export const tryUseNuxtApp = () => null'

/** 把别名映射为前端源码文件地址；省略扩展名时补 .ts，与 Nuxt 的解析结果一致 */
export function aliasTarget(specifier) {
  const base = specifier.startsWith('~~/')
    ? join(web, specifier.slice(3))
    : specifier.startsWith('~/')
      ? join(web, 'app', specifier.slice(2))
      : null
  if (!base) return null
  return pathToFileURL(extname(base) ? base : `${base}.ts`).href
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'nuxt/app') return { url: NUXT_APP_STUB, shortCircuit: true }
    return next(aliasTarget(specifier) ?? specifier, context)
  },
})

/** 合并 zh-CN 各字典域（每个文件唯一的顶层键即域名），按点号路径取词，缺词时原样返回 key */
export function zhTranslate() {
  const directory = join(web, 'i18n/locales/zh-CN')
  const messages = Object.assign(
    {},
    ...readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8'))),
  )
  return (key) => {
    const value = key.split('.').reduce((node, part) => node?.[part], messages)
    return typeof value === 'string' ? value : key
  }
}

/** 钩子注册后再动态导入，静态导入会在注册前完成解析 */
export async function loadAppModules() {
  const [nav, footer] = await Promise.all([
    import('../../src/frontend/web-blog/app/features/nav/routes.ts'),
    import('../../src/frontend/web-blog/app/features/site/footer.ts'),
  ])
  return { ...nav, ...footer }
}
