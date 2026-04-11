/**
 * @file mock.ts
 * @description 闪念示例笔记，仅在用户首次进入闪念页且当前用户笔记列表为空时注入
 * @author TixXin
 * @since 2026-04-11
 *
 * 这些 seed 数据通过 useFlashNotes 在客户端 onMounted 时按需写入 localStorage，
 * 让 mock 演示一开就有内容可看。后端就绪后，HttpFlashRepository 会从服务端
 * 拉取真实数据，这份 seed 自然废弃（不会再被调用）。
 */

import type { FlashNoteDraft } from './types'

/** 默认示例闪念草稿（不含 id / userId / 时间戳，由 repo.create 补齐） */
export const defaultFlashNoteSeeds: FlashNoteDraft[] = [
  {
    content: '欢迎来到闪念！这里记录每一个稍纵即逝的灵感，三秒钟就能写一条。',
    tags: ['欢迎', '产品'],
  },
  {
    content: '今天读到一句话：「专注是一种排除噪音的能力」——值得贴在屏幕边。',
    tags: ['读书笔记', '思考'],
  },
  {
    content: 'Vue 4 的 Vapor Mode 让组件运行时开销更接近 Svelte，值得跟进。',
    tags: ['前端', '技术'],
  },
  {
    content: '想做一个用 AI 总结全年闪念的脚本，年终回顾就有素材了。',
    tags: ['想法', 'AI'],
  },
  {
    content: '咖啡机水垢三个月清一次，下次提醒：6 月 11 日。',
    tags: ['生活', '提醒'],
  },
  {
    content: '设计 Repository 模式时，优先抽接口、再写实现 —— 这样未来切换数据源代价最小。',
    tags: ['架构', '复盘'],
  },
]
