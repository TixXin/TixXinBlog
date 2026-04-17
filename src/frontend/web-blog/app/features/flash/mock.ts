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

/**
 * 默认示例闪念草稿，带稳定 id 和 createdAt。
 * - id：让 RSS / JSON API / 详情页链接在客户端首次 seed 后保持一致
 * - createdAt：让示例内容具有"博主过去发的"时间线效果，而非全部挤在首次访问的瞬间
 *
 * 时间基准：2026-04-11T00:00:00Z（闪念模块上线日），按内容从近到远分布
 */
export const defaultFlashNoteSeeds: FlashNoteDraft[] = [
  {
    id: 'flash-seed-welcome',
    content: '欢迎来到闪念！这里记录每一个稍纵即逝的灵感，三秒钟就能写一条。',
    tags: ['欢迎', '产品'],
    createdAt: '2026-04-11T09:00:00Z',
  },
  {
    id: 'flash-seed-focus',
    content: '今天读到一句话：「专注是一种排除噪音的能力」——值得贴在屏幕边。',
    tags: ['读书笔记', '思考'],
    createdAt: '2026-04-09T12:30:00Z',
  },
  {
    id: 'flash-seed-vapor',
    content: 'Vue 4 的 Vapor Mode 让组件运行时开销更接近 Svelte，值得跟进。',
    tags: ['前端', '技术'],
    createdAt: '2026-04-07T16:45:00Z',
  },
  {
    id: 'flash-seed-ai-summary',
    content: '想做一个用 AI 总结全年闪念的脚本，年终回顾就有素材了。',
    tags: ['想法', 'AI'],
    createdAt: '2026-04-05T20:10:00Z',
  },
  {
    id: 'flash-seed-coffee',
    content: '咖啡机水垢三个月清一次，下次提醒：6 月 11 日。',
    tags: ['生活', '提醒'],
    createdAt: '2026-04-02T08:20:00Z',
  },
  {
    id: 'flash-seed-repo-pattern',
    content: '设计 Repository 模式时，优先抽接口、再写实现 —— 这样未来切换数据源代价最小。',
    tags: ['架构', '复盘'],
    createdAt: '2026-03-29T14:00:00Z',
  },
]
