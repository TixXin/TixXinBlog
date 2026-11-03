/**
 * @file markdown-it-task-lists.d.ts
 * @description markdown-it-task-lists 未发布类型声明，按其 CommonJS 导出与 2.x 选项在本地补齐
 */
declare module 'markdown-it-task-lists' {
  import type { MarkdownIt } from 'markdown-it'

  interface TaskListsOptions {
    /** 复选框可点击；缺省为 false，输出 disabled 的复选框 */
    enabled?: boolean
    /** 用 label 包裹复选框与文字 */
    label?: boolean
    /** label 放在复选框之后，需同时开启 label */
    labelAfter?: boolean
  }

  function taskLists(md: MarkdownIt, options?: TaskListsOptions): void
  export = taskLists
}
