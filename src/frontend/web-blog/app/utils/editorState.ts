/** @file editorState.ts @description 编辑器通用小工具：未保存改动检测、请求错误的状态码与冲突后静默读取最新版本 */
import { computed, ref } from 'vue'

/** 以 JSON 快照比较表单与已保存基线，判断是否有未保存改动 */
export function createDirtyTracker(form: object) {
  const baseline = ref(JSON.stringify(form))
  const dirty = computed(() => JSON.stringify(form) !== baseline.value)
  /** 以给定内容为已保存基线；省略时以当前表单为准 */
  const markClean = (value: unknown = form) => {
    baseline.value = JSON.stringify(value)
  }
  return { baseline, dirty, markClean }
}

/** 请求失败时附带的 HTTP 状态码 */
export function requestStatusCode(cause: unknown) {
  return (cause as { statusCode?: number }).statusCode
}

/** 冲突后读取最新版本；读取失败时保留原错误与本地输入，不再报错 */
export async function readLatestQuietly<T>(read: () => Promise<T>, apply: (latest: T) => void) {
  try {
    apply(await read())
  } catch {
    /* 保留原错误与本地输入，待连接恢复后再次读取。 */
  }
}
