/** @file showcase-moments.ts @description 真实感样本集的朋友圈清单：正文、配图、地点与设备、关联文章及访客评论，延续旧版朋友圈页面的内容 */
interface ShowcaseMomentComment {
  author: string
  content: string
  /** 博主回复 */
  owner?: boolean
  /** 距动态发布的小时数 */
  hoursAfter: number
}
interface ShowcaseMoment {
  key: string
  content: string
  /** showcase-assets 下的素材名 */
  images: readonly string[]
  topics: readonly string[]
  /** 距今天数 */
  days: number
  likes: number
  location?: string
  device?: string
  mood?: string
  pinned?: boolean
  /** 关联文章的 showcase-posts key */
  linkedPost?: string
  linkedLink?: { url: string; title: string; description: string; siteName: string }
  comments: readonly ShowcaseMomentComment[]
}
// 最近半年内十八条，本月至少五条让日历有标记；配图数量覆盖单图、两列、三列与九宫格。
export const SHOWCASE_MOMENTS: readonly ShowcaseMoment[] = [
  {
    key: 'weekly-todo',
    content:
      '本周博客升级 TODO，慢慢推进：\n\n- [x] 闪念详情页 + OG 卡\n- [x] 评论 Markdown 渲染\n- [x] 话题聚合页\n- [ ] 闪念发布编辑器\n- [ ] 后端 API 接入',
    images: [],
    topics: ['技术分享'],
    days: 1,
    likes: 12,
    device: 'MacBook Pro',
    comments: [],
  },
  {
    key: 'theme-engine',
    content:
      '终于把博客的主题引擎重构完了！现在可以像搭积木一样换主题了，代码也干净了很多。之前搭博客的完整过程写在下面这篇里，主题这一块的细节过阵子单独写。',
    images: [],
    topics: ['技术分享'],
    days: 4,
    likes: 35,
    device: 'MacBook Pro',
    mood: '心情大好',
    pinned: true,
    linkedPost: 'nuxt3-fullstack-blog',
    comments: [
      { author: '代码小哥', content: '期待文章，主题引擎是怎么做的？', hoursAfter: 5 },
      { author: 'TixXin', content: '基于 slot contract 模式，文章里会详细说', owner: true, hoursAfter: 7 },
      { author: '前端菜鸟', content: '@代码小哥 大佬带带我', hoursAfter: 20 },
    ],
  },
  {
    key: 'city-night',
    content: '下班路上拍到一张很满意的街景，天刚擦黑，路灯和车灯都亮起来了，手持慢门居然也能出片。',
    images: ['city-night'],
    topics: ['摄影记录'],
    days: 7,
    likes: 45,
    location: '深圳·福田CBD',
    device: 'Sony A7M4',
    comments: [
      { author: '摄影师老张', content: '手持长曝？快门速度多少？', hoursAfter: 9 },
      { author: 'TixXin', content: '1/4s，开了 IBIS 防抖，靠在栏杆上稳住', owner: true, hoursAfter: 11 },
    ],
  },
  {
    key: 'sushi-dinner',
    content: '试了一下新开的日料店，三文鱼卷很新鲜，寿司船拼盘也做得用心，两个人吃刚好。推荐大家去试试。',
    images: ['sushi', 'sushi-boat'],
    topics: ['美食探店', '生活日常'],
    days: 10,
    likes: 22,
    location: '广州·天河城',
    device: 'iPhone 16 Pro',
    comments: [
      { author: '美食家小王', content: '这家我也去过，确实不错！', hoursAfter: 3 },
      { author: 'TixXin', content: '@美食家小王 下次试试拼盘，比单点划算', owner: true, hoursAfter: 4 },
    ],
  },
  {
    key: 'rss-feed',
    content: '给博客加了 RSS 订阅功能，终于可以用 Feedly 追更了。技术栈：Nitro server routes + XML 模板，意外地简单。',
    images: [],
    topics: ['技术分享'],
    days: 14,
    likes: 27,
    device: 'MacBook Pro',
    comments: [],
  },
  {
    key: 'hidden-cafe',
    content: '探索了一家隐藏在巷子里的咖啡店，拿铁拉花很漂亮，蛋糕也好吃。适合一个人安静地待一下午。',
    images: ['latte'],
    topics: ['美食探店', '生活日常'],
    days: 18,
    likes: 19,
    location: '深圳·南山',
    comments: [
      { author: '咖啡控', content: '在哪里呀，求地址！', hoursAfter: 2 },
      { author: 'TixXin', content: '南山大道旁边的小巷子里，叫“慢时光”', owner: true, hoursAfter: 3 },
    ],
  },
  {
    key: 'vue-transition',
    content:
      '用 Vue 3 的 Transition 组件做了一组微交互动画，效果比想象中好很多。CSS animation + JS hooks 的组合真的很灵活，之前写过的 Web Animation API 那篇正好能接上。',
    images: [],
    topics: ['技术分享'],
    days: 23,
    likes: 31,
    device: 'MacBook Pro',
    linkedPost: 'web-animation-api',
    comments: [],
  },
  {
    key: 'seaside-sunset',
    content: '今天天气真好，下午去爬了趟七娘山，傍晚的光打在山坡上，草绿得有点不真实。风很大但心情很好。',
    images: ['green-hills', 'mountain-light'],
    topics: ['生活日常', '摄影记录'],
    days: 29,
    likes: 42,
    location: '深圳·七娘山',
    comments: [],
  },
  {
    key: 'library-afternoon',
    content:
      '周末去了趟图书馆，安安静静看了一下午《设计模式》。观察者模式在前端应用真的太广了，Vue 的响应式系统就是一个经典实现。',
    images: [],
    topics: ['读书笔记', '技术分享'],
    days: 35,
    likes: 14,
    location: '深圳·图书馆',
    comments: [],
  },
  {
    key: 'refactoring-book',
    content: '最近在读《重构：改善既有代码的设计》，每次翻开都有新的收获。好的代码就像好的文章，清晰、简洁、有逻辑。',
    images: [],
    topics: ['读书笔记', '技术分享'],
    days: 42,
    likes: 18,
    comments: [{ author: '读书人', content: '这本书是经典，值得反复看', hoursAfter: 14 }],
  },
  {
    key: 'wutong-cloud-sea',
    content: '前阵子去川西自驾，雪山一座接一座，河谷里全是针叶林。下次要早点出发，争取赶上日照金山。',
    images: ['summit', 'mountain-valley'],
    topics: ['生活日常', '摄影记录'],
    days: 50,
    likes: 56,
    location: '四川·新都桥',
    comments: [
      { author: '驴友阿杰', content: '川西的雪山确实绝了！走的哪条线？', hoursAfter: 6 },
      { author: 'TixXin', content: '318 进去，新都桥住一晚，再往塔公走', owner: true, hoursAfter: 8 },
      { author: '户外小白', content: '@驴友阿杰 新手自驾能去吗？', hoursAfter: 30 },
      { author: 'TixXin', content: '@户外小白 路况还行，主要注意高反，备好氧气慢慢开', owner: true, hoursAfter: 33 },
    ],
  },
  {
    key: 'nuxt4-notes',
    content:
      '研究了一下 Nuxt 4 的新特性，目录结构调整后项目组织清晰了很多。app/ 目录的概念很好，把运行时代码和配置文件分开了。',
    images: [],
    topics: ['技术分享'],
    days: 61,
    likes: 23,
    device: 'MacBook Pro',
    comments: [
      { author: 'Nuxt爱好者', content: '升级麻烦吗？有 breaking changes 吗？', hoursAfter: 12 },
      { author: 'TixXin', content: '官方有迁移指南，主要是目录结构变化，逻辑基本兼容', owner: true, hoursAfter: 15 },
    ],
  },
  {
    key: 'sichuan-restaurant',
    content: '发现了一家很棒的川菜馆，水煮鱼又麻又辣，回锅肉也很正宗。辣度可以选择，不太能吃辣的也可以尝试。',
    images: [],
    topics: ['美食探店'],
    days: 72,
    likes: 16,
    location: '深圳·华强北',
    comments: [],
  },
  {
    key: 'bay-morning-run',
    content: '这个月跑量第一次过了一百公里，顺手把这一季跑步、爬山拍的照片翻出来，挑了九张凑个九宫格。',
    images: [
      'stairs-run',
      'track-aerial',
      'sprint',
      'mountain-light',
      'green-hills',
      'mountain-valley',
      'summit',
      'tree-canopy',
      'sunflower',
    ],
    topics: ['生活日常', '摄影记录'],
    days: 86,
    likes: 33,
    location: '深圳·深圳湾体育中心',
    comments: [],
  },
  {
    key: 'bookshelf-flag',
    content: '整理了一下书架，发现好多买了还没读的书，连那本诗集都还夹着书签。立个 flag：这个月至少读完两本。',
    images: ['bookshelf', 'reading'],
    topics: ['读书笔记', '生活日常'],
    days: 100,
    likes: 8,
    comments: [],
  },
  {
    key: 'mythical-man-month',
    content:
      '在家翻完了《人月神话》，虽然是几十年前的书，但关于软件工程的很多观点现在依然适用。“没有银弹”这一章值得每个程序员读一遍。',
    images: [],
    topics: ['读书笔记'],
    days: 118,
    likes: 11,
    comments: [],
  },
  {
    key: 'blinko-star',
    content: '看到一个有意思的开源项目，把 AI 笔记和 RAG 检索做得很轻量，自托管也方便。先 star 收着以后研究。',
    images: [],
    topics: ['技术分享'],
    days: 135,
    likes: 19,
    device: 'MacBook Pro',
    linkedLink: {
      url: 'https://github.com/blinkospace/blinko',
      title: 'blinkospace/blinko: AI Native Note App',
      description: 'Blinko 是一款开源的 AI 原生闪念笔记应用，支持 Markdown、双向链接、RAG 检索与多端同步。',
      siteName: 'GitHub',
    },
    comments: [],
  },
  {
    key: 'spring-garden',
    content:
      '春天来了，周末去了趟植物园：温室里的仙人掌、园子中间那棵老榕树，还有一小片提前开了的向日葵，随手拍了几张。',
    images: ['cactus', 'tree-canopy', 'sunflower'],
    topics: ['生活日常', '摄影记录'],
    days: 180,
    likes: 28,
    location: '深圳·仙湖植物园',
    comments: [
      { author: '小林', content: '好美啊！这个季节去植物园最合适了', hoursAfter: 4 },
      { author: 'TixXin', content: '是的，推荐周中去人少', owner: true, hoursAfter: 6 },
    ],
  },
]
