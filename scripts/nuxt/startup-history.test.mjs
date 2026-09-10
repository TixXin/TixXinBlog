/** @file startup-history.test.mjs @description 执行固定Nuxt路由补丁的真实setup及启动钩子，隔离验证原生历史与SSR/SSG契约 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

const require = createRequire(new URL('../../src/frontend/web-blog/package.json', import.meta.url))
const nuxtPackage = require.resolve('nuxt/package.json')
const nuxtRequire = createRequire(nuxtPackage)
const { isSamePath, parseURL, withoutBase } = nuxtRequire('ufo')
const sourcePath = process.env.NUXT_STARTUP_ROUTER_SOURCE
  ? resolve(process.env.NUXT_STARTUP_ROUTER_SOURCE)
  : join(dirname(nuxtPackage), 'dist/pages/runtime/plugins/router.js')
// 只替换模块装载边界及构建期标志；函数体来自实际安装的Nuxt补丁，不另写一份实现。
const source = readFileSync(sourcePath, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export \{ plugin as default \};?/, 'return { plugin, createCurrentLocation };')
  .replaceAll('import.meta.client', 'true')
  .replaceAll('import.meta.server', 'false')
  .replaceAll('import.meta.hot', 'false')
  .replaceAll('import.meta.dev', 'false')

function harness({
  url = '/links?page=2',
  payloadPath = url,
  prerendered = false,
  base = '/',
  hashMode = false,
  refuse = false,
} = {}) {
  const location = new URL(url, 'https://example.test')
  const listeners = new Set()
  const hookCallbacks = new Map()
  const hooks = {
    hookOnce(name, callback) {
      const once = async (...args) => {
        hookCallbacks.set(
          name,
          (hookCallbacks.get(name) ?? []).filter((item) => item !== once),
        )
        return callback(...args)
      }
      hookCallbacks.set(name, [...(hookCallbacks.get(name) ?? []), once])
    },
    async callHook(name, ...args) {
      for (const callback of [...(hookCallbacks.get(name) ?? [])]) await callback(...args)
    },
  }
  const window = {
    location,
    history: {},
    addEventListener: (name, callback) => {
      if (name === 'popstate') listeners.add(callback)
    },
    removeEventListener: (name, callback) => {
      if (name === 'popstate') listeners.delete(callback)
    },
  }
  const component = {}
  const resolveRoute = (input) => {
    const value = typeof input === 'string' ? input : (input.fullPath ?? input.path)
    const parsed = new URL(value, 'https://example.test')
    return {
      path: parsed.pathname,
      fullPath: parsed.pathname + parsed.search + parsed.hash,
      name: 'content',
      meta: {},
      matched: [{ components: { default: component }, meta: {} }],
    }
  }
  const after = [],
    before = [],
    replacements = [],
    middlewareTargets = [],
    errors = []
  const router = {
    currentRoute: { value: resolveRoute('/') },
    options: {},
    resolve: resolveRoute,
    afterEach: (callback) => {
      after.push(callback)
      return () => {}
    },
    beforeEach: (callback) => {
      before.push(callback)
      return () => {}
    },
    beforeResolve: () => {},
    onError: () => {},
    isReady: async () => {},
    async replace(input) {
      const to = resolveRoute(input),
        from = router.currentRoute.value
      replacements.push({ path: to.fullPath, force: input.force })
      for (const callback of before) {
        if ((await callback(to, from)) === false) return { type: 4 }
      }
      location.href = new URL(to.fullPath, location).href
      router.currentRoute.value = to
      for (const callback of after) await callback(to, from)
    },
  }
  let lastNavigation = Promise.resolve()
  const replace = router.replace
  router.replace = (input) => (lastNavigation = replace(input))
  const nuxtApp = {
    hooks,
    callHook: hooks.callHook,
    isHydrating: true,
    payload: { path: payloadPath, serverRendered: true, state: {}, ...(prerendered ? { prerenderedAt: 1 } : {}) },
    runWithContext: (callback) => callback(),
    vueApp: {
      config: { globalProperties: {} },
      use() {
        router.currentRoute.value = resolveRoute(
          hashMode ? location.hash.slice(1) : withoutBase(location.pathname, base) + location.search + location.hash,
        )
      },
    },
  }
  const dependencies = {
    window,
    navigationDiagnostics: {},
    generateRouteKey: ({ route }) => route.path,
    toArray: (value) => (Array.isArray(value) ? value : [value]),
    isReadonly: () => false,
    reactive: (value) => value,
    shallowReactive: (value) => value,
    shallowRef: (value) => ({ value }),
    isSamePath,
    parseURL,
    withoutBase,
    defineNuxtPlugin: (plugin) => plugin,
    useRuntimeConfig: () => ({ app: { baseURL: base } }),
    routerOptions: {},
    hashMode,
    pageIslandRoutes: {},
    START_LOCATION: {},
    createMemoryHistory: () => ({}),
    createWebHashHistory: () => ({}),
    createWebHistory: () => ({}),
    createRouter: () => router,
    globalMiddleware: [
      (to) => {
        middlewareTargets.push(to.fullPath)
        if (typeof refuse === 'function' ? refuse(to) : refuse) return false
      },
    ],
    namedMiddleware: {},
    navigateTo: () => {},
    _showErrorUnlessCrawler: async (_app, error) => {
      errors.push(error)
    },
    clearError: () => {},
    createError: (value) => value,
    isNuxtError: () => false,
    showError: () => {},
    useError: () => ({ value: null }),
    _routes: [],
    handleHotUpdate: () => {},
    getRouteRules: () => ({}),
  }
  const { plugin, createCurrentLocation } = new Function(...Object.keys(dependencies), source)(
    ...Object.values(dependencies),
  )
  return {
    start: () => plugin.setup(nuxtApp),
    created: async () => {
      await hooks.callHook('app:created')
      assert.deepEqual(errors, [])
    },
    restore: async () => {
      await hooks.callHook('app:suspense:resolve')
      await lastNavigation
    },
    pop(path, routeCompleted = false) {
      location.href = new URL(path, location).href
      for (const callback of listeners) callback()
      if (routeCompleted) router.currentRoute.value = resolveRoute(path)
    },
    pluginNavigate(path) {
      location.href = new URL(path, location).href
      router.currentRoute.value = resolveRoute(path)
    },
    createCurrentLocation,
    location,
    replacements,
    middlewareTargets,
    router,
    listeners,
    hooks,
    errors,
  }
}

test('同pathname的SSR旧查询不覆盖早于路由监听的native位置，保留query顺序与hash', async () => {
  const value = harness({ url: '/links?a=A&a=B#native', payloadPath: '/links?page=2#ssr' })
  await value.start()
  await value.created()
  assert.deepEqual(value.replacements, [{ path: '/links?a=A&a=B#native', force: true }])
  assert.deepEqual(value.middlewareTargets, ['/links?a=A&a=B#native'])
  assert.equal(value.listeners.size, 0)
})
test('没有native变化时正常启动仍执行middleware', async () => {
  const value = harness()
  await value.start()
  await value.created()
  assert.deepEqual(value.replacements, [{ path: '/links?page=2', force: true }])
  assert.deepEqual(value.middlewareTargets, ['/links?page=2'])
})
test('不同pathname的SSR渲染重定向保留服务端路径和查询', async () => {
  const value = harness({ url: '/incoming?client=1', payloadPath: '/rendered?server=1' })
  await value.start()
  await value.created()
  assert.deepEqual(value.replacements, [{ path: '/rendered?server=1', force: true }])
  assert.deepEqual(value.middlewareTargets, ['/rendered?server=1'])
})
test('startup期间native查询与hash变化在force replay前使用最新目标', async () => {
  const value = harness()
  await value.start()
  value.pop('/links?q=first#first')
  value.pop('/links?q=latest#latest')
  await value.created()
  assert.deepEqual(value.replacements, [{ path: '/links?q=latest#latest', force: true }])
  assert.deepEqual(value.middlewareTargets, ['/links?q=latest#latest'])
  assert.equal(value.listeners.size, 0)
})
test('已完成的插件导航仍优先，不回放SSR或早先native位置', async () => {
  const value = harness()
  await value.start()
  value.pop('/links')
  value.pluginNavigate('/projects')
  await value.created()
  assert.deepEqual(value.replacements, [])
  assert.equal(value.location.pathname, '/projects')
  assert.equal(value.listeners.size, 0)
})
test('middleware真正拒绝最新native目标时仍遵守拒绝', async () => {
  const value = harness({ refuse: true })
  await value.start()
  value.pop('/links?q=latest')
  await value.created()
  assert.deepEqual(value.middlewareTargets, ['/links?q=latest'])
  assert.equal(value.router.currentRoute.value.fullPath, '/links?page=2')
  assert.equal(value.location.pathname + value.location.search, '/links?q=latest')
  assert.equal(value.listeners.size, 0)
})
test('无native变化时SSG仍先水合payload再恢复原查询', async () => {
  const value = harness({ payloadPath: '/links', prerendered: true })
  await value.start()
  await value.created()
  assert.deepEqual(value.replacements, [{ path: '/links', force: true }])
  assert.equal(value.listeners.size, 1)
  await value.restore()
  assert.deepEqual(
    value.replacements.map((item) => item.path),
    ['/links', '/links?page=2'],
  )
  assert.equal(value.listeners.size, 0)
})
test('SSG延后恢复前出现native查询与hash变化，不污染用户历史槽位', async () => {
  const value = harness({ payloadPath: '/links', prerendered: true })
  await value.start()
  await value.created()
  value.pop('/links?q=latest#native')
  await value.restore()
  assert.deepEqual(
    value.replacements.map((item) => item.path),
    ['/links', '/links?q=latest#native'],
  )
  assert.deepEqual(value.middlewareTargets, ['/links', '/links?q=latest#native'])
  assert.equal(value.listeners.size, 0)
})
test('SSG延后恢复时native回到payload路径也不会误恢复旧page2', async () => {
  const value = harness({ payloadPath: '/links', prerendered: true })
  await value.start()
  await value.created()
  value.pop('/links')
  await value.restore()
  assert.deepEqual(
    value.replacements.map((item) => item.path),
    ['/links', '/links'],
  )
})
test('SSG新native目标被middleware拒绝时不提前改变currentRoute', async () => {
  const value = harness({ payloadPath: '/links', prerendered: true, refuse: (to) => to.path === '/protected' })
  await value.start()
  await value.created()
  value.pop('/protected')
  await value.restore()
  assert.deepEqual(value.middlewareTargets, ['/links', '/protected'])
  assert.equal(value.router.currentRoute.value.fullPath, '/links')
  assert.equal(value.listeners.size, 0)
})
test('SSG临时路由之后已完成新导航，延后回调不再覆盖', async () => {
  const value = harness({ payloadPath: '/links', prerendered: true })
  await value.start()
  await value.created()
  value.pop('/projects', true)
  await value.restore()
  assert.deepEqual(
    value.replacements.map((item) => item.path),
    ['/links'],
  )
  assert.equal(value.router.currentRoute.value.fullPath, '/projects')
  assert.equal(value.listeners.size, 0)
})
test('baseURL与hash模式仍取真实浏览器片段', () => {
  const value = harness()
  assert.equal(
    value.createCurrentLocation('/blog/', new URL('https://example.test/blog/links?a=1#current'), '/links?old=2'),
    '/links?a=1#current',
  )
  assert.equal(
    value.createCurrentLocation('/blog/#', new URL('https://example.test/blog/#/links?a=1#current'), '/links?old=2'),
    '/links?a=1#current',
  )
})
test('启动错误与挂载出口释放原生监听', async () => {
  const error = harness()
  await error.start()
  assert.equal(error.listeners.size, 1)
  await error.hooks.callHook('app:error')
  assert.equal(error.listeners.size, 0)
  const mounted = harness()
  await mounted.start()
  await mounted.hooks.callHook('app:mounted')
  assert.equal(mounted.listeners.size, 0)
})
