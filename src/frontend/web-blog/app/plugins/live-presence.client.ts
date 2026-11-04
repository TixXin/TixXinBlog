/**
 * @file live-presence.client.ts
 * @description 启动实时在线心跳：应用挂载后才发送第一次心跳，结果不参与水合；站内跳转到新路径时计一次浏览。
 *   静态发布与纯 Mock 演示没有后端，不启动。
 */
import { startLivePresence, useLivePresenceState } from '~/composables/useLivePresence'

export default defineNuxtPlugin({
  name: 'live-presence',
  setup(app) {
    const config = useRuntimeConfig().public
    if (config.staticSite || config.useMockRepo) return
    const state = useLivePresenceState()
    const accessToken = useState<string | null>('auth-access-token', () => null)
    const router = useRouter()
    let handle: ReturnType<typeof startLivePresence> | null = null
    app.hook('app:mounted', () => {
      handle = startLivePresence(state, {
        apiBase: String(config.apiBaseUrl || '/api/v1'),
        path: () => router.currentRoute.value.path,
        token: () => accessToken.value,
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
