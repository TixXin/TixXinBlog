/** @file useAdminMomentEditor.ts @description 动态编辑、版本冲突与本标签页输入恢复，未知保存结果复用原提交标识 */
import { createMomentActions, useMomentEditorLifecycle } from '~/features/moment/editorLifecycle'
import { createMomentSave } from '~/features/moment/editorSave'
import { createMomentEditorSession, createMomentLoader } from '~/features/moment/editorSession'
import { useMomentArticleSearch } from '~/features/moment/useMomentArticleSearch'

export function useAdminMomentEditor(initialId: string | null) {
  // 会话与读取、保存、恢复副本与生命周期、引用文章搜索分别在 features/moment 下实现，这里只负责组装。
  const session = createMomentEditorSession(initialId)
  const articles = useMomentArticleSearch({
    apiBase: String(useRuntimeConfig().public.apiBaseUrl),
    isAlive: () => session.session.alive,
    linkedArticleId: () => session.form.linkedArticleId,
  })
  const { load } = createMomentLoader(session, articles.showLinkedArticle)
  const { save } = createMomentSave(session)
  const { change, reload, restoreRecovery, discardRecovery } = createMomentActions(session, load)
  useMomentEditorLifecycle(session, load, articles.dispose)
  const { form, id, saved, serverVersion, dirty, ready, loading, saving, error, notice, localError, recovery } = session
  const { articleChoices, articlesPending, articlesError, searchArticles } = articles
  return {
    form,
    id,
    saved,
    serverVersion,
    dirty,
    ready,
    loading,
    saving,
    error,
    notice,
    localError,
    recovery,
    change,
    save,
    reload,
    restoreRecovery,
    discardRecovery,
    persistLocal: session.persistLocal,
    articleChoices,
    articlesPending,
    articlesError,
    searchArticles,
  }
}
