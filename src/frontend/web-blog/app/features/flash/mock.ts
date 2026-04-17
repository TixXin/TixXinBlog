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
 * Seed 版本号：每次新增 seed 或调整稳定 id 时 +1。
 * useFlashNotes 读取后做一次性增量补种，让老用户能看到新增内容（不重复种已存在的 id）。
 */
export const FLASH_SEEDS_VERSION = 2

/**
 * 默认示例闪念草稿，带稳定 id 和 createdAt。
 * - id：让 RSS / JSON API / 详情页链接在客户端首次 seed 后保持一致
 * - createdAt：让示例内容具有"博主过去发的"时间线效果，而非全部挤在首次访问的瞬间
 *
 * 内容覆盖：
 * - 三种类型 idea/todo/memo 平衡分布
 * - Markdown 语法演示（粗体/链接/任务清单/引用/inline code）
 * - 图片网格（1 张 / 2 张 / 3 张）
 * - 状态机演示（isPinned / isDraft / isArchived）
 * - 时间分布：今天 + 连续 5 天 streak + 本月若干 + 历史月份 + 2025 同日（去年今日）
 */
export const defaultFlashNoteSeeds: FlashNoteDraft[] = [
  {
    id: 'flash-seed-today-think',
    content:
      '突然想通：所谓 **架构能力**，其实是「在不确定中给出最小可逆决策」的能力。\n\n参考：[A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/aphilosophyofsoftwaredesign.php)',
    tags: ['思考', '架构'],
    type: 'idea',
    createdAt: '2026-04-17T09:30:00Z',
  },
  {
    id: 'flash-seed-16-week-todo',
    content:
      '本周收尾 TODO：\n\n- [x] 闪念详情页 + RSS\n- [x] 状态机（置顶/归档/草稿）\n- [ ] 整理博客技术栈说明\n- [ ] 周末复盘 1Q 目标',
    tags: ['计划', '复盘'],
    type: 'todo',
    createdAt: '2026-04-16T21:15:00Z',
  },
  {
    id: 'flash-seed-16-walk',
    content: '傍晚去深圳湾走了一圈，海风把一周的疲惫吹散了。',
    tags: ['生活', '摄影记录'],
    type: 'memo',
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80',
      'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    ],
    createdAt: '2026-04-16T17:40:00Z',
  },
  {
    id: 'flash-seed-15-pin-tip',
    content:
      '调试 Vite 时记下来的小技巧：用 `import.meta.glob({ eager: true })` 替代手写 import，比一一列文件更稳。\n\n> Vite 4 起这是首选写法',
    tags: ['前端', '技术'],
    type: 'idea',
    isPinned: true,
    createdAt: '2026-04-15T10:25:00Z',
  },
  {
    id: 'flash-seed-14-quote',
    content: '> 我们高估了一年能做的事，低估了十年能做的事。\n\n—— Bill Gates，最近被反复想起的一句话',
    tags: ['思考', '读书笔记'],
    type: 'memo',
    createdAt: '2026-04-14T22:00:00Z',
  },
  {
    id: 'flash-seed-13-bug',
    content:
      '今天追一个 bug 追到怀疑人生，最后发现是一个 `==` 写成 `===` 引发的级联效应。Code review 时严格用 ESLint 规则可以从源头拦截。',
    tags: ['前端', 'Bug'],
    type: 'todo',
    createdAt: '2026-04-13T20:50:00Z',
  },
  {
    id: 'flash-seed-12-music',
    content: '最近循环 Bon Iver 的 22, A Million，写代码时配它特别专注。',
    tags: ['生活', '音乐'],
    type: 'memo',
    images: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80'],
    createdAt: '2026-04-12T08:10:00Z',
  },
  {
    id: 'flash-seed-welcome',
    content: '欢迎来到闪念！这里记录每一个稍纵即逝的灵感，三秒钟就能写一条。',
    tags: ['欢迎', '产品'],
    type: 'memo',
    createdAt: '2026-04-11T09:00:00Z',
  },
  {
    id: 'flash-seed-10-css',
    content: '`color-mix(in srgb, ...)` 真香，渐变色卡片再也不用预生成 5 个色阶变量了。',
    tags: ['前端', 'CSS'],
    type: 'idea',
    createdAt: '2026-04-10T15:30:00Z',
  },
  {
    id: 'flash-seed-focus',
    content: '今天读到一句话：「专注是一种排除噪音的能力」——值得贴在屏幕边。',
    tags: ['读书笔记', '思考'],
    type: 'memo',
    createdAt: '2026-04-09T12:30:00Z',
  },
  {
    id: 'flash-seed-08-mood-draft',
    content: '其实今天本来有件事想写出来，但还是先存草稿，等想清楚再发。',
    tags: ['随想'],
    type: 'memo',
    isDraft: true,
    createdAt: '2026-04-08T22:30:00Z',
  },
  {
    id: 'flash-seed-vapor',
    content: 'Vue 4 的 Vapor Mode 让组件运行时开销更接近 Svelte，值得跟进。',
    tags: ['前端', '技术'],
    type: 'idea',
    images: ['https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80'],
    createdAt: '2026-04-07T16:45:00Z',
  },
  {
    id: 'flash-seed-06-ai-conf',
    content:
      '看到 Anthropic 又发了新的 Claude 模型，长上下文 + Tool Use 的组合越来越好用了。准备给博客加一个 AI 摘要功能试试。',
    tags: ['AI', '想法'],
    type: 'idea',
    createdAt: '2026-04-06T11:00:00Z',
  },
  {
    id: 'flash-seed-ai-summary',
    content: '想做一个用 AI 总结全年闪念的脚本，年终回顾就有素材了。',
    tags: ['想法', 'AI'],
    type: 'idea',
    createdAt: '2026-04-05T20:10:00Z',
  },
  {
    id: 'flash-seed-04-archived',
    content: '原本想写一个长文聊聊「为什么我又开始用记事本」，写了一半发现没什么新东西，先归档。',
    tags: ['复盘'],
    type: 'memo',
    isArchived: true,
    createdAt: '2026-04-04T18:20:00Z',
  },
  {
    id: 'flash-seed-03-link',
    content: '[bun.sh](https://bun.sh/) 现在 install 速度真的离谱，本地装 nuxt 项目能从 30s 降到 3s。',
    tags: ['工具', '前端'],
    type: 'idea',
    createdAt: '2026-04-03T09:15:00Z',
  },
  {
    id: 'flash-seed-coffee',
    content: '咖啡机水垢三个月清一次，下次提醒：6 月 11 日。',
    tags: ['生活', '提醒'],
    type: 'todo',
    images: [
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    ],
    createdAt: '2026-04-02T08:20:00Z',
  },
  {
    id: 'flash-seed-repo-pattern',
    content: '设计 Repository 模式时，优先抽接口、再写实现 —— 这样未来切换数据源代价最小。',
    tags: ['架构', '复盘'],
    type: 'memo',
    createdAt: '2026-03-29T14:00:00Z',
  },
  {
    id: 'flash-seed-mar-25-book',
    content: '《代码大全》第二版重读了一遍 —— 几乎所有看似新潮的工程实践，里面 20 年前都讲过了。',
    tags: ['读书笔记'],
    type: 'memo',
    createdAt: '2026-03-25T19:30:00Z',
  },
  {
    id: 'flash-seed-mar-15-spring',
    content: '深圳的春天短得像一次叹息。',
    tags: ['生活'],
    type: 'memo',
    createdAt: '2026-03-15T07:45:00Z',
  },
  {
    id: 'flash-seed-jan-recall',
    content: '元旦那会儿写的年度计划，到现在已经完成了 6/12 项，剩下半年慢慢推。',
    tags: ['复盘'],
    type: 'memo',
    createdAt: '2026-01-20T11:30:00Z',
  },
  {
    id: 'flash-seed-throwback-2025',
    content:
      '一年前的今天，刚开始用闪念笔记应用。当时还在折腾选哪一款，现在已经把这事内置进自己的博客了。',
    tags: ['复盘', '产品'],
    type: 'memo',
    createdAt: '2025-04-17T12:00:00Z',
  },
]
