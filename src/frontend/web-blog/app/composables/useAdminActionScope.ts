/** @file useAdminActionScope.ts @description 后台异步操作的归属：await 之后仅在同一账号、同一内容库且组件仍存活时写回结果 */
export function useAdminActionScope() {
  const auth = useCurrentUser(),
    context = useState<string>('page-content-context', () => '')
  let alive = true
  onScopeDispose(() => {
    alive = false
  })
  /** 在发起请求前调用，返回的函数用于 await 之后判断结果是否仍属于当前页面 */
  function capture() {
    const user = auth.currentUser.value?.id,
      started = context.value
    return () => alive && !!user && auth.currentUser.value?.id === user && context.value === started
  }
  return { capture, context }
}
