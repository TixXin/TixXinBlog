/**
 * @file ssr-data-prefetch.server.ts
 * @description SSR 阶段提前并行发起布局与页面都要等的公共读取，避免站点资料、文章统计、朋友圈概览逐个串行往返
 * @author TixXin
 * @since 2026-10-16
 */

// 这些读取与布局/页面里的调用共用 useAsyncData 键，进行中的请求会被复用（dedupe: 'defer'），
// 不会重复请求；失败也只由原调用方的错误态处理，这里不额外兜底。
export default defineNuxtPlugin({
  name: 'ssr-data-prefetch',
  parallel: true,
  async setup() {
    const path = useRoute().path
    // 公共读取 composable 会注册作用域清理，放进独立 effectScope 以避免无作用域警告
    const scope = effectScope()
    await scope.run(async () => {
      const tasks: Promise<unknown>[] = [usePostMetadata()]
      if (path.startsWith('/moments')) tasks.push(useMomentOverview())
      await Promise.allSettled(tasks)
    })
  },
})
