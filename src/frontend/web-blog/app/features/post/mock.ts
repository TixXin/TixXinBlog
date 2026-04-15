/**
 * @file mock.ts
 * @description 文章模块 mock 数据，提供文章列表和分类 Tab 数据
 * @author TixXin
 * @since 2025-03-17
 */

import type {
  ArticleDetail,
  CommentItem,
  PostItem,
  PostTab,
  PostTag,
  RelatedPost,
  TocItem,
} from './types'

export const mockPostTabs: PostTab[] = [
  { label: '全部文章', value: 'all' },
  { label: '朋友圈', value: 'moments' },
]

const handwrittenPosts: PostItem[] = [
  {
    id: 1,
    title: '深入理解 Vue3 的响应式原理架构设计',
    summary: 'Vue3 的响应式系统基于 Proxy 和 Reflect 实现，相比 Vue2 的 Object.defineProperty，它有着更好的性能和更广泛的拦截能力。本文将带你一步步探索响应式系统的核心设计思想...',
    cover: 'https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=400&q=80',
    tags: [
      { label: 'Vue3', color: 'emerald' },
      { label: '性能优化', color: 'blue' },
    ],
    category: 'tech',
    readTime: 12,
    likes: 48,
    views: 1024,
    comments: 24,
    date: '2026-03-21',
    folder: '前端开发',
    pinned: true,
  },
  {
    id: 2,
    title: '关于现代化个人博客交互设计的几个思考法则',
    summary: '设计一个博客不应该只是堆砌技术栈，更重要的是如何通过视觉传达博主的个人品味。极简主义不等于简陋，细节的处理、微交互的运用以及阅读体验的打磨是提升质感的关键...',
    tags: [
      { label: 'UI设计', color: 'rose' },
      { label: 'CSS', color: 'orange' },
    ],
    category: 'life',
    readTime: 8,
    likes: 36,
    views: 862,
    comments: 12,
    date: '2026-03-19',
    folder: '随笔日记',
  },
  {
    id: 3,
    title: '零成本使用 GitHub Actions 实现流水线自动化构建部署',
    summary: '每次写完文章还要手动通过 FTP 上传服务器？是时候拥抱现代化的 CI/CD 了。这篇文章将手把手教你配置 GitHub Actions 脚本，实现代码推送后自动编译部署...',
    cover: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=400&q=80',
    tags: [
      { label: 'DevOps', color: 'sky' },
      { label: 'Git', color: 'emerald' },
    ],
    category: 'tech',
    readTime: 15,
    likes: 72,
    views: 756,
    comments: 8,
    date: '2026-03-15',
    folder: 'DevOps',
  },
  {
    id: 4,
    title: '深入理解前端技术架构与性能优化',
    summary: '这是一段模拟的文章摘要内容，用于展示文章卡片列表。文章内容涵盖了各种技术细节和前端架构思考，希望能给你带来启发...',
    tags: [
      { label: '性能优化', color: 'blue' },
      { label: 'TypeScript', color: 'emerald' },
    ],
    category: 'tech',
    readTime: 10,
    likes: 28,
    views: 534,
    comments: 6,
    date: '2026-03-08',
    folder: '前端开发',
  },
  {
    id: 5,
    title: '关于生活与工作的平衡思考法则',
    summary: '这是一段模拟的文章摘要内容，用于展示文章卡片列表。文章内容涵盖了各种生活感悟和工作思考，希望能给你带来启发...',
    tags: [
      { label: '生活日常', color: 'rose' },
      { label: '摄影', color: 'amber' },
    ],
    category: 'life',
    readTime: 13,
    likes: 26,
    views: 648,
    comments: 10,
    date: '2026-02-20',
    folder: '随笔日记',
  },
]

// 生成 id 6~50 的模拟数据
function generateMockPosts(): PostItem[] {
  const titles: { title: string; summary: string; category: 'tech' | 'life'; folder: string; tags: PostTag[] }[] = [
    { title: 'TypeScript 高级类型体操实战指南', summary: '从 Conditional Types 到 Template Literal Types，通过实际案例深入掌握 TypeScript 类型编程的核心技巧与常见模式。', category: 'tech', folder: '前端开发', tags: [{ label: 'TypeScript', color: 'blue' }, { label: 'Vue3', color: 'emerald' }] },
    { title: '用 Nuxt3 搭建全栈博客的完整历程', summary: '从项目初始化到部署上线，记录使用 Nuxt3 构建个人博客过程中遇到的坑和解决方案。', category: 'tech', folder: '前端开发', tags: [{ label: 'Vue3', color: 'emerald' }, { label: 'Node.js', color: 'blue' }] },
    { title: '周末骑行：从城市到山野的 50 公里', summary: '记录一次周末从市区出发骑行到郊外山野的旅程，沿途风景和一些关于放慢脚步的感悟。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'amber' }, { label: '摄影', color: 'rose' }] },
    { title: 'CSS Container Queries 彻底改变响应式设计', summary: 'Container Queries 让组件可以根据自身容器大小调整样式，不再依赖视口宽度，真正实现组件级响应式。', category: 'tech', folder: '前端开发', tags: [{ label: 'CSS', color: 'sky' }, { label: '性能优化', color: 'blue' }] },
    { title: '读《置身事内》：理解中国经济的微观视角', summary: '兰小欢的这本书用通俗易懂的方式解释了地方政府的经济行为逻辑，读完对很多政策有了新理解。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'orange' }, { label: '摄影', color: 'amber' }] },
    { title: 'Vite 5.0 新特性与迁移指南', summary: 'Vite 5.0 带来了 Rollup 4 集成、更快的冷启动速度和改进的 SSR 支持，本文总结关键变化与迁移步骤。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Webpack', color: 'emerald' }, { label: '性能优化', color: 'orange' }] },
    { title: '独居第三年：一些关于孤独与自由的碎碎念', summary: '独居生活并不总是浪漫的，但它教会了我如何与自己相处。记录一些日常片段和心理变化。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'rose' }, { label: '摄影', color: 'amber' }] },
    { title: 'Node.js 事件循环机制深度解析', summary: '从 libuv 到 V8，详解 Node.js 事件循环的六个阶段、microtask 队列与 process.nextTick 的执行时机。', category: 'tech', folder: '后端技术', tags: [{ label: 'Node.js', color: 'emerald' }, { label: '算法', color: 'blue' }] },
    { title: 'Docker Compose 实战：本地开发环境一键启动', summary: '使用 Docker Compose 编排前端 + 后端 + 数据库的本地开发环境，告别手动配置依赖的烦恼。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Docker', color: 'sky' }, { label: 'DevOps', color: 'blue' }] },
    { title: '日本关西七日游摄影手记', summary: '京都的寺庙、大阪的街头、奈良的小鹿，用镜头记录关西地区的风土人情与美食体验。', category: 'life', folder: '随笔日记', tags: [{ label: '摄影', color: 'orange' }, { label: '生活日常', color: 'rose' }] },
    { title: 'pnpm Workspace 与 Monorepo 实践总结', summary: '在多个项目共享依赖和代码时，pnpm workspace 提供了简洁而强大的解决方案。总结实际使用中的配置技巧和踩坑记录。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Node.js', color: 'orange' }, { label: 'DevOps', color: 'emerald' }] },
    { title: 'Web Animation API：告别 CSS 动画的局限', summary: 'Web Animation API 提供了比 CSS 动画更精细的控制能力，支持暂停、倒放、速度控制等高级功能。', category: 'tech', folder: '前端开发', tags: [{ label: 'CSS', color: 'rose' }, { label: 'TypeScript', color: 'blue' }] },
    { title: '养猫半年的快乐与崩溃瞬间', summary: '从领养到现在半年，橘猫胖虎带来了无数欢乐和一些意想不到的挑战。分享新手猫奴的日常。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'amber' }, { label: '摄影', color: 'rose' }] },
    { title: 'Rust 入门：从所有权到生命周期', summary: '作为前端开发者学习 Rust 的第一步，所有权和生命周期是最大的心智转变。用 JS 思维类比帮助理解。', category: 'tech', folder: '后端技术', tags: [{ label: 'Rust', color: 'orange' }, { label: '算法', color: 'amber' }] },
    { title: 'ESLint Flat Config 迁移实录', summary: '从 .eslintrc 迁移到 eslint.config.js 的完整过程记录，包括插件兼容性处理和自定义规则配置。', category: 'tech', folder: 'DevOps', tags: [{ label: 'TypeScript', color: 'blue' }, { label: 'DevOps', color: 'emerald' }] },
    { title: '我的 2025 年度书单回顾', summary: '回顾过去一年读过的 24 本书，从技术类到文学小说，挑选出最值得推荐的 5 本。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'amber' }, { label: '摄影', color: 'orange' }] },
    { title: 'WebSocket 实时通信方案对比与选型', summary: '对比 WebSocket、SSE、Long Polling 三种实时通信方案的适用场景、性能特点和实现复杂度。', category: 'tech', folder: '后端技术', tags: [{ label: 'Node.js', color: 'sky' }, { label: '数据库', color: 'blue' }] },
    { title: 'Figma 到代码：设计稿还原的工程化实践', summary: '如何建立设计系统与前端组件库的映射关系，让设计稿到代码的转化过程更加高效和可控。', category: 'tech', folder: '前端开发', tags: [{ label: 'UI设计', color: 'rose' }, { label: 'CSS', color: 'emerald' }] },
    { title: '一个人的咖啡馆巡礼：城市角落的温暖', summary: '探访了本地十几家独立咖啡馆，记录每家店的特色饮品、空间设计和那些安静的下午时光。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'amber' }, { label: '摄影', color: 'orange' }] },
    { title: 'SQLite 在现代 Web 开发中的复兴', summary: '从 Cloudflare D1 到 Turso，SQLite 正以新的姿态重回 Web 开发舞台。探讨其在边缘计算场景的优势。', category: 'tech', folder: '后端技术', tags: [{ label: '数据库', color: 'blue' }, { label: 'Node.js', color: 'sky' }] },
    { title: 'TailwindCSS vs SCSS：我为什么选择了后者', summary: '在博客项目的技术选型中，对比了两种样式方案的优劣，最终选择 SCSS 的原因和实际体验。', category: 'tech', folder: '前端开发', tags: [{ label: 'CSS', color: 'sky' }, { label: 'Tailwind', color: 'orange' }] },
    { title: '春日徒步：穿越城市绿道的周末', summary: '趁着春天好天气，沿着城市绿道徒步了 15 公里。记录沿途的花花草草和偶遇的小惊喜。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'emerald' }, { label: '摄影', color: 'amber' }] },
    { title: 'Vue3 组合式函数设计模式与最佳实践', summary: '总结在实际项目中编写 composables 的常见模式：参数归一化、返回值设计、副作用管理等。', category: 'tech', folder: '前端开发', tags: [{ label: 'Vue3', color: 'emerald' }, { label: 'TypeScript', color: 'blue' }] },
    { title: 'Git 工作流对比：GitFlow vs Trunk-Based', summary: '在团队协作中选择合适的 Git 分支策略至关重要。对比两种主流工作流的适用场景和优缺点。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Git', color: 'orange' }, { label: 'DevOps', color: 'sky' }] },
    { title: '做菜这件小事：我的厨房实验记录', summary: '从完全不会做饭到能做出几道像样的菜，记录这半年在厨房里的尝试、失败和小成就。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'rose' }, { label: '摄影', color: 'amber' }] },
    { title: '浏览器渲染管线：从 HTML 到像素的全过程', summary: '解析浏览器将 HTML/CSS/JS 转化为屏幕像素的完整渲染管线，理解回流与重绘的性能影响。', category: 'tech', folder: '前端开发', tags: [{ label: '性能优化', color: 'blue' }, { label: 'CSS', color: 'emerald' }] },
    { title: 'Zod + TypeScript：运行时类型校验的最佳搭档', summary: 'Zod 提供了声明式的 schema 验证能力，配合 TypeScript 的类型推断，让前后端数据校验变得优雅可靠。', category: 'tech', folder: '前端开发', tags: [{ label: 'TypeScript', color: 'sky' }, { label: 'Node.js', color: 'blue' }] },
    { title: '电影《过春天》：少女视角下的深港边境', summary: '一部关于青春、身份和边界的电影。用冷静克制的镜头讲述了一个深港走私少女的成长故事。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'rose' }, { label: '摄影', color: 'orange' }] },
    { title: 'Nginx 配置速查与常见踩坑记录', summary: '总结日常部署中最常用的 Nginx 配置模板：反向代理、HTTPS、gzip、缓存策略、SPA 路由等。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Linux', color: 'emerald' }, { label: 'DevOps', color: 'sky' }] },
    { title: '关于极简主义生活的一些误解', summary: '极简不是扔掉所有东西，而是留下真正重要的。分享实践极简主义两年后的真实感受和反思。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'amber' }, { label: '摄影', color: 'rose' }] },
    { title: 'Vercel Edge Functions 实战体验', summary: '在边缘节点运行服务端逻辑，Vercel Edge Functions 带来了极低的冷启动时间。通过实际项目体验其能力与限制。', category: 'tech', folder: '后端技术', tags: [{ label: 'Node.js', color: 'blue' }, { label: 'DevOps', color: 'sky' }] },
    { title: 'UnoCSS 原子化方案深度体验报告', summary: '作为 TailwindCSS 的替代方案，UnoCSS 以更灵活的预设机制和更快的构建速度吸引了越来越多的开发者。', category: 'tech', folder: '前端开发', tags: [{ label: 'CSS', color: 'emerald' }, { label: 'Tailwind', color: 'sky' }] },
    { title: '给新手的 Linux 命令行生存指南', summary: '整理了日常开发中最常用的 Linux 命令，附带实际使用场景说明，帮助新手快速上手命令行操作。', category: 'tech', folder: 'DevOps', tags: [{ label: 'Linux', color: 'orange' }, { label: 'Git', color: 'blue' }] },
    { title: '夏夜的星空：第一次天文观测记录', summary: '入手了一台入门级天文望远镜，在远离城市灯光的郊外第一次看到了土星环和木星的卫星。', category: 'life', folder: '随笔日记', tags: [{ label: '摄影', color: 'sky' }, { label: '生活日常', color: 'amber' }] },
    { title: 'HTTP/3 与 QUIC 协议解读', summary: '基于 UDP 的 QUIC 协议如何解决 TCP 队头阻塞问题？HTTP/3 的普及现状与实际性能提升分析。', category: 'tech', folder: '后端技术', tags: [{ label: 'Node.js', color: 'blue' }, { label: '算法', color: 'emerald' }] },
    { title: '写给自己的年中复盘', summary: '半年过去了，回顾年初定下的目标完成了多少？哪些做到了，哪些需要调整，以及下半年的计划。', category: 'life', folder: '工作复盘', tags: [{ label: '生活日常', color: 'orange' }, { label: '摄影', color: 'amber' }] },
    { title: 'Playwright 自动化测试入门与实践', summary: '对比 Cypress 和 Puppeteer，Playwright 在跨浏览器支持和 API 设计上有明显优势。从零开始搭建测试框架。', category: 'tech', folder: 'DevOps', tags: [{ label: 'TypeScript', color: 'emerald' }, { label: 'DevOps', color: 'sky' }] },
    { title: 'SCSS 模块化架构：从混乱到有序', summary: '当项目样式文件越来越多时，如何通过合理的目录结构、变量管理和 mixin 设计保持样式代码的可维护性。', category: 'tech', folder: '前端开发', tags: [{ label: 'CSS', color: 'rose' }, { label: 'UI设计', color: 'blue' }] },
    { title: '深夜电台：那些陪我写代码的音乐', summary: '整理了一份适合深夜编码时听的播放列表，从 Lo-Fi 到后摇，帮助进入心流状态的背景音乐推荐。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'rose' }, { label: '摄影', color: 'amber' }] },
    { title: 'IndexedDB 完全指南：浏览器端大数据存储', summary: '当 localStorage 的 5MB 不够用时，IndexedDB 提供了异步、事务性的大容量客户端存储方案。', category: 'tech', folder: '前端开发', tags: [{ label: 'TypeScript', color: 'blue' }, { label: '性能优化', color: 'sky' }] },
    { title: '毕业三年的职业回顾与思考', summary: '从实习到正式工作，三年时间里换了两份工作，经历了不同团队文化。分享职业选择中的得与失。', category: 'life', folder: '工作复盘', tags: [{ label: '生活日常', color: 'orange' }, { label: '摄影', color: 'amber' }] },
    { title: 'WebGPU 初探：下一代浏览器图形 API', summary: 'WebGPU 作为 WebGL 的继任者，提供了更现代的 GPU 编程模型。体验其基本用法并与 WebGL 对比。', category: 'tech', folder: '前端开发', tags: [{ label: 'TypeScript', color: 'emerald' }, { label: '性能优化', color: 'rose' }] },
    { title: 'Astro 框架体验：内容优先的静态站点方案', summary: 'Astro 的 Islands Architecture 只在需要交互的地方加载 JS，非常适合博客、文档类内容站点。', category: 'tech', folder: '前端开发', tags: [{ label: 'React', color: 'orange' }, { label: 'Vue3', color: 'sky' }] },
    { title: '阳台种菜日记：从种子到收获', summary: '在阳台花盆里种了番茄、辣椒和薄荷，记录两个月来的生长过程和种植心得。', category: 'life', folder: '随笔日记', tags: [{ label: '生活日常', color: 'emerald' }, { label: '摄影', color: 'amber' }] },
    { title: '前端监控体系设计：从埋点到告警', summary: '构建完整的前端监控体系：性能指标采集、错误上报、用户行为追踪、告警通知的架构设计与实现。', category: 'tech', folder: '前端开发', tags: [{ label: '性能优化', color: 'blue' }, { label: 'DevOps', color: 'emerald' }] },
  ]

  const covers = [
    'https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1484417894907-623942c8ee29?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=400&q=80',
  ]

  const now = new Date(2026, 2, 21)
  const generated: PostItem[] = []

  for (let i = 0; i < titles.length; i++) {
    const item = titles[i]!
    const id = i + 6

    // 生成从今天到约 2 年前的日期分布
    const daysAgo = i === 0 ? 0 : i === 1 ? 1 : i <= 4 ? Math.floor(i * 1.5) : Math.floor(i * 16)
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)
    // 手动按本地时区拼 YYYY-MM-DD，避免 toISOString() 转 UTC 导致 SSR/CSR 跨时区 1 天漂移
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    // 约 60% 有封面
    const hasCover = i % 5 !== 2 && i % 5 !== 4

    generated.push({
      id,
      title: item.title,
      summary: item.summary,
      cover: hasCover ? covers[i % covers.length] : undefined,
      tags: item.tags,
      category: item.category,
      readTime: 5 + (i % 15),
      likes: 10 + ((i * 7) % 90),
      views: 200 + ((i * 37) % 1800),
      comments: (i * 3) % 30,
      date: dateStr,
      folder: item.folder,
    })
  }

  return generated
}

export const mockPosts: PostItem[] = [
  ...handwrittenPosts,
  ...generateMockPosts(),
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

export const mockArticleDetail: ArticleDetail = {
  id: '1',
  title: '深入理解 Vue3 的响应式原理架构设计',
  cover:
    'https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=1200&q=80',
  date: '2024-03-10',
  category: '前端架构',
  readTime: '12 分钟',
  views: 1024,
  likes: 48,
  comments: 4,
  content: [
    {
      type: 'heading',
      level: 2,
      id: 'intro',
      text: '引言：为什么要重新设计响应式系统',
    },
    {
      type: 'paragraph',
      text:
        'Vue.js 作为目前最主流的前端框架之一，其核心竞争力就在于「响应式数据驱动」的编程范式。当我们修改一个数据，与之关联的视图就会自动更新——这背后看似简单的机制，实际上蕴含了非常精巧的设计。Vue3 对响应式系统进行了彻底的重写，从底层的拦截机制到上层的 API 设计，都有了质的飞跃。',
    },
    {
      type: 'paragraph',
      text:
        '在 Vue2 中，响应式系统基于 Object.defineProperty 实现，这种方式虽然能够完成基本的数据劫持需求，但存在诸多先天性限制。Vue3 选择使用 ES6 的 Proxy 来重新设计整个响应式体系，不仅解决了旧方案的痛点，还带来了更优秀的性能表现和更灵活的 API。本文将带你从原理层面深入理解这套架构的设计思想。',
    },
    {
      type: 'heading',
      level: 2,
      id: 'proxy-vs-define',
      text: 'Proxy 与 Object.defineProperty 的本质差异',
    },
    {
      type: 'paragraph',
      text:
        'Object.defineProperty 只能劫持对象已有属性的 getter/setter，这意味着如果你在对象创建之后新增了属性，或者直接通过索引修改数组元素，Vue2 是无法检测到变化的。这也是为什么 Vue2 需要提供 Vue.set 和 Vue.delete 这类辅助 API 的原因。',
    },
    {
      type: 'paragraph',
      text:
        '而 Proxy 是对整个对象的代理拦截，它可以捕获几乎所有的对象操作，包括属性的读取（get）、赋值（set）、删除（deleteProperty）、枚举（ownKeys）等 13 种操作。这种「全方位」的拦截能力使得 Vue3 不再需要递归遍历对象的每一个属性进行定义，而是采用惰性的方式——只有当属性被访问时才会对其进行深层代理，大大提升了初始化性能。',
    },
    {
      type: 'quote',
      text:
        'Proxy 的引入不仅是 API 层面的变更，更是响应式设计哲学的一次范式转换——从「逐属性定义」变为「整体代理拦截」，这赋予了框架在运行时更强大的感知与控制能力。',
    },
    {
      type: 'heading',
      level: 2,
      id: 'reactive-impl',
      text: 'reactive() 的实现原理',
    },
    {
      type: 'paragraph',
      text:
        'reactive() 是 Vue3 Composition API 中最核心的响应式函数。它接收一个普通对象（或数组），返回该对象的响应式代理。其内部实现并不复杂，核心就是调用 new Proxy(target, handler)，并在 handler 中注入依赖收集和触发更新的逻辑。',
    },
    {
      type: 'heading',
      level: 3,
      id: 'reactive-core',
      text: '核心简化实现',
    },
    {
      type: 'paragraph',
      text:
        '下面是一个去除边界处理后的简化版本，展示了 reactive 的核心工作流程。在 get 陷阱中执行依赖收集（track），在 set 陷阱中触发更新（trigger）：',
    },
    {
      type: 'code',
      language: 'javascript',
      text: `function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return result;
    }
  };
  return new Proxy(target, handler);
}`,
    },
    {
      type: 'paragraph',
      text:
        '这段代码体现了 Vue3 响应式系统的三个核心设计原则：一是使用 Reflect 配合 Proxy 确保正确的 this 指向和原型链行为；二是在 get 中惰性递归代理嵌套对象，避免一次性深度遍历带来的性能开销；三是在 set 中通过对比新旧值来避免不必要的更新触发。',
    },
    {
      type: 'heading',
      level: 2,
      id: 'ref-vs-reactive',
      text: 'ref() 与 reactive() 的选择与区别',
    },
    {
      type: 'paragraph',
      text:
        '在实际开发中，我们经常面临一个选择：到底用 ref() 还是 reactive()？理解它们背后的实现差异，能帮助我们做出更合理的技术选型。',
    },
    {
      type: 'paragraph',
      text:
        'reactive() 只能作用于对象类型（Object、Array、Map、Set 等），因为 Proxy 的限制使其无法代理基本类型值。而 ref() 则通过将值包裹在一个带有 .value 属性的对象中来解决这一限制。当 ref 包裹的是对象类型时，内部实际上会调用 reactive 进行深层代理。',
    },
    {
      type: 'heading',
      level: 3,
      id: 'ref-reactive-diff',
      text: '实际开发建议',
    },
    {
      type: 'list',
      items: [
        '对于基本类型（string, number, boolean）或需要替换整个引用的场景，优先使用 ref()。',
        '对于结构稳定的对象或表单数据模型，使用 reactive() 可以避免反复 .value 的书写负担。',
        '不要对 reactive 对象进行解构赋值，否则会丢失响应式绑定。如需解构请搭配 toRefs() 使用。',
        'Vue 官方推荐在大多数场景下使用 ref()，因为它更具通用性且心智模型更统一。',
      ],
    },
    {
      type: 'heading',
      level: 2,
      id: 'effect-tracking',
      text: 'effect 与依赖追踪机制',
    },
    {
      type: 'paragraph',
      text:
        '响应式系统的另一半拼图是「副作用函数（effect）」的依赖追踪。当我们在组件的 setup 中使用响应式数据时，Vue 内部会创建一个 effect 来追踪当前渲染函数依赖了哪些响应式属性。这个追踪过程依赖于一个全局的 activeEffect 变量和一个 WeakMap → Map → Set 三层数据结构。',
    },
    {
      type: 'paragraph',
      text:
        '当 effect 执行时，会将自身赋值给 activeEffect。此时如果访问了某个响应式对象的属性，就会触发 Proxy 的 get 陷阱，进而调用 track() 函数，将当前的 activeEffect 添加到该属性对应的依赖集合中。后续当属性值发生变化时，trigger() 会遍历该属性的所有依赖 effect 并重新执行它们。',
    },
    {
      type: 'heading',
      level: 2,
      id: 'summary',
      text: '总结与展望',
    },
    {
      type: 'paragraph',
      text:
        'Vue3 的响应式系统是一次成功的架构升级。通过 Proxy 替代 defineProperty，它解决了无法检测新增属性、数组索引修改等历史痛点；通过惰性代理和精确的依赖追踪，大幅提升了运行时性能；通过 ref/reactive 等清晰的 API 设计，降低了开发者的理解成本。',
    },
    {
      type: 'paragraph',
      text:
        '如果你正在深入学习 Vue3，建议从源码的 @vue/reactivity 包开始阅读。这个包是完全独立的，可以脱离 Vue 框架使用，也是理解 Vue3 核心机制的最佳入口。',
    },
  ],
}

export const mockComments: CommentItem[] = [
  {
    id: 1,
    author: '小明',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
    content:
      '写得非常详细！尤其是 track/trigger 的三层数据结构那部分，终于搞明白了 WeakMap 在这里的作用。期待博主继续更新 Vue3 编译器原理相关的文章。',
    time: '2024-03-11',
    likes: 12,
    replies: [
      {
        id: 11,
        author: 'TixXin',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=80&q=80',
        content: '谢谢支持，编译器系列已经在路上了。',
        time: '2024-03-11',
        likes: 3,
        isOwner: true,
      },
    ],
  },
  {
    id: 2,
    author: 'DevLin',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
    content:
      '请问一下，Vue3 的响应式在处理大型数组时性能如何？之前 Vue2 的数组劫持一直是个痛点，换成 Proxy 之后是否完全解决了？',
    time: '2024-03-10',
    likes: 5,
  },
  {
    id: 3,
    author: '前端小白',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
    content:
      '代码示例很清晰，对照源码看容易理解多了。另外想补充一点，Vue3 还通过 effectScope 提供了更细粒度的 effect 管理能力，在组件卸载时自动清理所有副作用。',
    time: '2024-03-10',
    likes: 8,
  },
  {
    id: 4,
    author: 'TixXin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=80&q=80',
    content:
      '本文侧重原理脉络，effectScope 确实是组合式 API 里很值得单独展开的一块，后面会补一篇短文说明。',
    time: '2024-03-10',
    likes: 6,
    isOwner: true,
  },
]

export const mockRelatedPosts: RelatedPost[] = [
  {
    id: '2',
    title: 'Vue3 编译器优化策略：静态提升与 PatchFlag 详解',
    date: '2024-02-20',
    category: '前端架构',
  },
  {
    id: '3',
    title: '从零手写一个迷你 Vue 响应式系统',
    date: '2024-01-15',
    category: '源码笔记',
  },
  {
    id: '4',
    title: 'React Signals vs Vue Reactivity：前端响应式方案横向对比',
    date: '2024-01-05',
    category: '技术视野',
  },
]

export const mockTocItems: TocItem[] = [
  { id: 'intro', text: '引言：为什么要重新设计响应式系统', level: 2 },
  { id: 'proxy-vs-define', text: 'Proxy 与 Object.defineProperty 的本质差异', level: 2 },
  { id: 'reactive-impl', text: 'reactive() 的实现原理', level: 2 },
  { id: 'reactive-core', text: '核心简化实现', level: 3 },
  { id: 'ref-vs-reactive', text: 'ref() 与 reactive() 的选择与区别', level: 2 },
  { id: 'ref-reactive-diff', text: '实际开发建议', level: 3 },
  { id: 'effect-tracking', text: 'effect 与依赖追踪机制', level: 2 },
  { id: 'summary', text: '总结与展望', level: 2 },
]
