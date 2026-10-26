/** @file useMediaWorkspace.ts @description 媒体工作区的共享上下文：服务、筛选与列表状态、归属校验与操作前置检查 */
import type { Ref } from 'vue'
import type { Translate } from '~/utils/format'
import type { MediaAsset, MediaOrientation, MediaRemovalResult, MediaUsage } from './types'
import { readMediaOrientation, readMediaPage, readMediaUsage } from './library'

/** 归属与请求版本：账号或内容上下文变化后，旧请求与旧操作的结果一律丢弃 */
export interface MediaWorkspaceGuard {
  disposed: boolean
  requestVersion: number
  ownershipVersion: number
  owner: { actor: string; context: string } | null
}

/** 筛选条件与列表状态；选择器模式不读取地址上的筛选 */
function createMediaState(selectable: boolean) {
  const query = selectable ? {} : useRoute().query
  return {
    search: ref(typeof query.search === 'string' ? query.search : ''),
    deleted: ref(query.deleted === 'true' ? 'true' : 'false'),
    orientation: ref<MediaOrientation>(readMediaOrientation(query.orientation)),
    usage: ref<MediaUsage>(readMediaUsage(query.usage)),
    page: ref(readMediaPage(query.page)),
    total: ref(0),
    items: ref<MediaAsset[]>([]),
    pending: ref(false),
    ready: ref(false),
    working: ref(false),
    uploading: ref(false),
    error: ref(''),
    batchResults: ref<MediaRemovalResult[]>([]),
    batchProgress: ref<{ completed: number; total: number } | null>(null),
  }
}

interface MediaOwnershipSource {
  auth: ReturnType<typeof useCurrentUser>
  pageContext: Ref<string>
  t: Translate
  guard: MediaWorkspaceGuard
  state: ReturnType<typeof createMediaState>
}

/** 归属校验：工作区只服务首次读取时的账号与内容上下文 */
function createMediaOwnership({ auth, pageContext, t, guard, state }: MediaOwnershipSource) {
  const { items, ready, pending, error } = state
  const ownershipMessage = () => t('admin-media.mediaMessages.ownership')
  const ownsWorkspace = () =>
    !guard.disposed && guard.owner?.actor === auth.currentUser.value?.id && guard.owner?.context === pageContext.value
  const ownsOperation = (version: number) => ownsWorkspace() && version === guard.ownershipVersion
  function allowAction(asset?: MediaAsset) {
    // 嵌入公开页面时，文件选择器与列表请求同时挂载；未就绪不代表身份已经变化。
    if (!ready.value) {
      if (!error.value)
        error.value = pending.value
          ? t('admin-media.mediaMessages.stillLoading')
          : t('admin-media.mediaMessages.loadFirst')
      return false
    }
    if (!ownsWorkspace() || (asset && !items.value.includes(asset))) {
      error.value = ownershipMessage()
      return false
    }
    return true
  }
  /** 读取前确认登录并记下归属；身份已变化时停止读取并提示 */
  function claimWorkspace() {
    const actor = auth.currentUser.value?.id
    if (!actor) {
      ready.value = false
      error.value = t('admin-media.mediaMessages.loginRequired')
      return false
    }
    guard.owner ??= { actor, context: pageContext.value }
    if (ownsWorkspace()) return true
    ready.value = false
    error.value = ownershipMessage()
    return false
  }
  return { ownershipMessage, ownsWorkspace, ownsOperation, allowAction, claimWorkspace }
}

export function createMediaWorkspace(selectable: boolean) {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const pageContext = useState<string>('page-content-context', () => '')
  const uploader = useMediaUpload()
  const t = currentTranslate()
  const toast = useToast()
  const state = createMediaState(selectable)
  const guard: MediaWorkspaceGuard = { disposed: false, requestVersion: 0, ownershipVersion: 0, owner: null }
  const ownership = createMediaOwnership({ auth, pageContext, t, guard, state })
  return { ...state, ...ownership, state, api, auth, pageContext, uploader, t, toast, guard, selectable }
}

export type MediaWorkspace = ReturnType<typeof createMediaWorkspace>
