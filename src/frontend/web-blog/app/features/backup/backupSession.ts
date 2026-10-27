/** @file backupSession.ts @description 内容包下载与导入的会话状态：表单与票据、请求代次、账号与内容库归属判定 */
import type { ContentImportView } from './types'
import { apiErrorMessage } from '~/utils/apiError'

export interface BackupOwner {
  actor?: string
  context: string
  generation: number
}
export interface BackupSelection {
  file: File | null
  requestId: string
  strategy: 'skip' | 'copy'
  includeSettings: boolean
}
export type BackupRecentItem = { ticket: string; createdAt: string; completed: boolean; expired: boolean }
export type BackupSession = ReturnType<typeof createBackupSession>

/** 页面绑定的全部响应式状态 */
function createBackupState() {
  const pending = ref(false)
  // 只有上传、执行、重新预览和下载这类有副作用的请求需要离开确认；只读的票据查询随时可以离开
  const guarded = ref(false)
  const error = ref('')
  const mediaIncluded = ref(true)
  const file = shallowRef<File | null>(null)
  const strategy = ref<'skip' | 'copy'>('skip')
  const includeSettings = ref(false)
  const requestId = ref('')
  const job = ref<ContentImportView | null>(null)
  const acknowledgement = ref('')
  return { pending, guarded, error, mediaIncluded, file, strategy, includeSettings, requestId, job, acknowledgement }
}

export function createBackupSession() {
  const app = useNuxtApp()
  const auth = useCurrentUser()
  const api = useAdminApi()
  const site = useSiteSettings()
  const pageContext = useState<string>('page-content-context', () => '')
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()
  const state = createBackupState()
  // 在 setup 同步阶段取翻译函数；确认短语按调用时的界面语言求值
  const translate = currentTranslate()
  const recent = ref<BackupRecentItem[]>([])
  const recentError = ref('')
  const selections = new Map<string, BackupSelection>()
  /** 请求代次与归属：换账号、换内容库或卸载后，旧请求的结果一律丢弃 */
  const session = {
    alive: true,
    generation: 0,
    operation: 0,
    recentVersion: 0,
    changingActor: false,
    identityInitialized: !!auth.currentUser.value,
    selectionActor: auth.currentUser.value?.id,
    jobOwner: null as BackupOwner | null,
  }
  // 每次取用时按当前界面语言生成，切换语言后提示随之更新。
  const ownershipMessage = () => t('admin-system.backup.ownershipChanged')
  const captureOwner = (): BackupOwner => ({
    actor: auth.currentUser.value?.id,
    context: pageContext.value,
    generation: session.generation,
  })
  const owns = (owner: BackupOwner) =>
    session.alive &&
    owner.generation === session.generation &&
    owner.actor === auth.currentUser.value?.id &&
    owner.context === pageContext.value
  const ownershipError = () => Object.assign(new Error(ownershipMessage()), { statusCode: 409, ownershipChanged: true })
  function assertOwner(owner: BackupOwner) {
    if (!owns(owner)) throw ownershipError()
  }
  function detail(cause: unknown, fallbackKey: string) {
    if ((cause as { ownershipChanged?: boolean })?.ownershipChanged) return ownershipMessage()
    return apiErrorMessage(cause, fallbackKey, { t })
  }
  return {
    ...state,
    ...{ app, auth, api, site, pageContext, route, toast, t, translate, recent, recentError, selections, session },
    ...{ ownershipMessage, captureOwner, owns, ownershipError, assertOwner, detail },
  }
}
