/**
 * @file auth.client.ts
 * @description 水合后恢复管理员会话，避免服务端公共 HTML 与客户端身份状态不一致
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useCurrentUser()
  nuxtApp.hook('app:mounted', () => {
    void auth.restore()
  })
})
