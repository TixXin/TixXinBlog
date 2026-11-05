/**
 * @file live-presence.client.ts
 * @description 启动实时在线心跳：等应用完全就绪（含 Suspense 内的异步水合）才发送第一次心跳，结果不参与水合；
 *   站内跳转到新路径时计一次浏览；博主的访问令牌快过期时先续期再发，保持博主在线状态。
 *   静态发布与纯 Mock 演示没有后端，不启动。
 */
import { startLivePresence, useLivePresenceState } from '~/composables/useLivePresence'
import { freshAccessToken } from '~/features/auth/accessToken'

export default defineNuxtPlugin({
  name: 'live-presence',
  setup(app) {
    const config = useRuntimeConfig().public
    // 单元测试环境不发心跳：否则会混入其他用例对请求、fetch 次数与 sessionStorage 的断言；心跳逻辑另有直接调用的单测。
    if (config.staticSite || config.useMockRepo || import.meta.test) return
    const state = useLivePresenceState()
    const auth = useCurrentUser()
    const router = useRouter()
    // 访问令牌只有 15 分钟；心跳不经过认证拦截，令牌过期后后端会把博主当作访客，
    // 博主停留在前台时就会显示为离线。因此发送前发现令牌快过期，先用会话 Cookie 续期；续期失败按访客发送。
    const heartbeatToken = () => freshAccessToken(() => auth.accessToken.value, auth.refresh)
    let handle: ReturnType<typeof startLivePresence> | null = null
    // 不能用 app:mounted：此时 Suspense 内的页面可能仍在水合，心跳结果若先到会改动在线状态与统计卡，
    // 造成水合不一致（WebKit 快速刷新与前进后退时可复现）。onNuxtReady 在水合完成且浏览器空闲后执行。
    onNuxtReady(() => {
      handle = startLivePresence(state, {
        apiBase: String(config.apiBaseUrl || '/api/v1'),
        path: () => router.currentRoute.value.path,
        token: heartbeatToken,
      })
    })
    router.afterEach((to, from) => {
      if (handle && to.path !== from.path) handle.pageView()
    })
    const stop = () => handle?.stop()
    app.vueApp.onUnmount(stop)
    if (import.meta.hot) import.meta.hot.dispose(stop)
  },
})
