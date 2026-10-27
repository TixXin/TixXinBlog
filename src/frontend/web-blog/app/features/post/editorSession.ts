/** @file editorSession.ts @description 文章编辑组合函数的会话状态：草稿与标签、基线与未保存判定、冲突与恢复选择、本机副本和自动保存计时 */
import type { AdminPostDraft } from './adminTypes'
import type { PostRecoveryItem } from '~/utils/postRecovery'
import { copyContentRelations } from '~/features/content-relation/editor'

export type PostEditorSession = ReturnType<typeof createPostEditorSession>

/** 标签输入按中英文逗号拆分，去掉空白项 */
export function splitPostTags(value: string) {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** 新文章的初始草稿 */
function emptyPostDraft(): AdminPostDraft {
  return {
    relatedContent: [],
    title: '',
    summary: '',
    cover: '',
    folder: '随笔日记',
    category: 'life',
    status: 'draft',
    contentRaw: '',
    pinned: false,
    readTimeMinutes: 5,
    tags: [],
  }
}

/** 编辑器的全部响应式状态 */
function createPostEditorState(id: string | null) {
  const draft = ref<AdminPostDraft>(emptyPostDraft())
  const tags = ref('')
  const options = ref<{ folders: string[]; tags: string[] }>({ folders: [], tags: [] })
  const baseline = ref('')
  const pending = ref(false)
  const ready = ref(false)
  const error = ref('')
  const recovery = usePostRecovery(id)
  const automaticSaving = ref(false)
  const serverAutoSave = ref(true)
  const reviewingPublication = ref(false)
  const autoSavePaused = ref(false)
  const recoverySelection = ref<PostRecoveryItem | null>(null)
  const recoveryServer = ref<AdminPostDraft | null>(null)
  const recoveryReviewPending = ref(false)
  const conflict = ref<AdminPostDraft | null>(null)
  const preservedLocal = ref<AdminPostDraft | null>(null)
  return {
    ...{ draft, tags, options, baseline, pending, ready, error, recovery, automaticSaving, serverAutoSave },
    ...{ reviewingPublication, autoSavePaused, recoverySelection, recoveryServer, recoveryReviewPending },
    ...{ conflict, preservedLocal },
  }
}

export function createPostEditorSession(id: string | null) {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const route = useRoute()
  const { success } = useToast()
  const { t } = useI18n()
  const state = createPostEditorState(id)
  const { draft, tags, ready, baseline } = state
  /** 恢复副本来源与两类自动保存计时器 */
  const session = {
    recoveredSourceKey: undefined as string | undefined,
    localTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    serverTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  }
  const localForCompare = computed(() => ({
    ...draft.value,
    // 展开响应式对象不会移除嵌套代理；关联列表必须和标签一样形成独立可克隆快照。
    relatedContent: copyContentRelations(draft.value.relatedContent),
    tags: splitPostTags(tags.value),
  }))
  const snapshot = computed(() => JSON.stringify({ ...draft.value, tags: tags.value }))
  const dirty = computed(() => ready.value && snapshot.value !== baseline.value)
  /** 采用服务器返回的文章作为新基线 */
  function acceptSaved(value: AdminPostDraft) {
    draft.value = value
    tags.value = draft.value.tags.join(', ')
    baseline.value = snapshot.value
  }
  return { ...state, id, api, auth, route, success, t, session, localForCompare, snapshot, dirty, acceptSaved }
}
