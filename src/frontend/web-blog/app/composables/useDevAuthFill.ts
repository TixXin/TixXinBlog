/**
 * @file useDevAuthFill.ts
 * @description Dev 环境登录表单"测试账号一键填入"通信管道（仅 mock 阶段使用，生产构建中调用方应被 DevOnly 包裹移除）
 * @author TixXin
 * @since 2026-04-11
 */

interface DevAuthCredentials {
  email: string
  password: string
}

export function useDevAuthFill() {
  // 待消费的填入凭据；AuthDevQuickFill 写入，AuthLoginForm 监听并 consume
  const pendingCredentials = useState<DevAuthCredentials | null>(
    'dev-auth-fill-pending',
    () => null,
  )

  /** 投递一组待填入的凭据，等待 LoginForm 消费 */
  function fill(email: string, password: string) {
    pendingCredentials.value = { email, password }
  }

  /** 消费并清空待填入凭据，避免重复触发 */
  function consume(): DevAuthCredentials | null {
    const value = pendingCredentials.value
    pendingCredentials.value = null
    return value
  }

  return {
    pendingCredentials,
    fill,
    consume,
  }
}
