/** @file useVisitorSubmissionForm.ts @description 访客表单的客户端计时与蜜罐，独立于草稿恢复和提交去重 */
import { onMounted, ref, watch } from 'vue'
import type { VisitorSubmissionFields } from '~/features/visitor/types'

/** 与服务端上限一致：表单开着超过 30 天时按上限上报，避免长期打开的页面一直被拒绝 */
const MAX_FORM_ELAPSED_MS = 30 * 24 * 60 * 60 * 1000

export function useVisitorSubmissionForm(
  options: {
    active?: () => boolean
    submitting?: () => boolean
    error?: () => string | undefined
  } = {},
) {
  const website = ref('')
  // 使用单调时钟记录起点，上报经过的毫秒数，不受设备时间偏差影响。
  let startedAt: number | undefined
  let mounted = false
  function restart() {
    if (!mounted) return
    website.value = ''
    startedAt = performance.now()
  }
  onMounted(() => {
    mounted = true
    if (options.active?.() !== false) restart()
  })
  if (options.active)
    watch(options.active, (active) => {
      if (active) restart()
    })
  if (options.submitting)
    watch(options.submitting, (submitting, previous) => {
      if (previous && !submitting && !options.error?.()) restart()
    })
  // 不裁剪或清空蜜罐值；服务端必须能收到机器人实际填写的内容。
  function fields(): VisitorSubmissionFields {
    const formElapsedMs =
      startedAt === undefined
        ? undefined
        : Math.min(MAX_FORM_ELAPSED_MS, Math.max(0, Math.round(performance.now() - startedAt)))
    return { website: website.value, formElapsedMs }
  }
  return { website, fields, restart }
}
