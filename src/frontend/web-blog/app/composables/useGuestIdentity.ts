/**
 * @file useGuestIdentity.ts
 * @description 游客身份管理：未登录访客的昵称/邮箱/头像等信息，存入 localStorage 持久化。
 *              支持 QQ 邮箱自动获取 QQ 头像，其他邮箱或无邮箱时用昵称首字母文字头像。
 *              跨页面可复用（闪念评论、留言板等场景统一走此 composable）。
 * @author TixXin
 * @since 2026-04-12
 */

export interface GuestIdentity {
  /** 自动生成的设备级唯一 ID，作为 authorId */
  id: string
  /** 必填昵称 */
  nickname: string
  /** 可选简介 */
  bio?: string
  /** 可选站点地址 */
  website?: string
  /** 可选邮箱（QQ 邮箱自动获取头像） */
  email?: string
  /** 可选自定义头像 URL */
  avatarUrl?: string
}

const STORAGE_KEY = 'guest-identity'

/** QQ 邮箱正则：纯数字@qq.com */
const QQ_EMAIL_RE = /^(\d+)@qq\.com$/i

/** 安全读取 localStorage */
function readIdentity(): GuestIdentity | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestIdentity
    if (typeof parsed?.id === 'string' && typeof parsed?.nickname === 'string') {
      return parsed
    }
  } catch {
    /* fallthrough */
  }
  return null
}

/** 安全写入 localStorage */
function writeIdentity(identity: GuestIdentity) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    /* 隐私模式可能写入失败 */
  }
}

/** 生成设备级唯一 ID */
function generateGuestId(): string {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 根据游客身份信息解析最终头像 URL：
 * 1. 有自定义 avatarUrl → 直接返回
 * 2. QQ 邮箱 → q1.qlogo.cn 接口获取 QQ 头像
 * 3. 其他情况 → 返回空字符串，UI 层用首字母文字头像
 */
export function resolveGuestAvatar(identity: GuestIdentity | null): string {
  if (!identity) return ''
  if (identity.avatarUrl) return identity.avatarUrl
  if (identity.email) {
    const match = identity.email.match(QQ_EMAIL_RE)
    if (match) {
      return `https://q1.qlogo.cn/g?b=qq&nk=${match[1]}&s=100`
    }
  }
  return ''
}

/** 判断邮箱是否为 QQ 邮箱 */
export function isQQEmail(email: string): boolean {
  return QQ_EMAIL_RE.test(email)
}

export function useGuestIdentity() {
  const guestIdentity = useState<GuestIdentity | null>('guest-identity', () => readIdentity())

  const hasIdentity = computed(() => guestIdentity.value !== null)

  function setIdentity(data: Omit<GuestIdentity, 'id'> & { id?: string }) {
    const identity: GuestIdentity = {
      id: data.id || guestIdentity.value?.id || generateGuestId(),
      nickname: data.nickname,
      bio: data.bio,
      website: data.website,
      email: data.email,
      avatarUrl: data.avatarUrl,
    }
    guestIdentity.value = identity
    writeIdentity(identity)
  }

  function clearIdentity() {
    guestIdentity.value = null
    if (import.meta.client) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }

  /** 解析当前游客身份的头像 URL */
  function resolveAvatar(): string {
    return resolveGuestAvatar(guestIdentity.value)
  }

  return {
    guestIdentity,
    hasIdentity,
    setIdentity,
    clearIdentity,
    resolveAvatar,
  }
}
