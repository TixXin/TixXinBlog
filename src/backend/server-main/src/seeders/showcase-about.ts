/** @file showcase-about.ts @description showcase 样本集的关于页资料：六类栏目、条目链接、英文资料、本站信息与支持方式 */
import type { AboutSettingsDto } from '../modules/site/about-settings'

const item = (title: string, period: string, detail = '') => ({ title, period, detail, visible: true })
// 关于页六类栏目：“现在”带更新日期，经历按时间倒序，技能写年限与用法，装备写日常在用的东西，兴趣与在读呼应文章和朋友圈里的内容；
// 部分条目带链接与英文版本，覆盖英文界面的逐字段回退。支持方式只放博主本人 GitHub 账号的 Sponsors 页，不虚构收款账号。
export const SHOWCASE_ABOUT: AboutSettingsDto = {
  visible: true,
  introduction:
    '我是 **TixXin**，在深圳做前端开发。这里记录 Vue、Nuxt 和 TypeScript 的实践，也写部署运维的踩坑、读过的书和周末去过的地方。\n\n文章尽量写清楚“为什么这么做”，而不只是“怎么做”。博客本身的实现在 [GitHub](https://github.com/TixXin/TixXinBlog) 上。',
  en: {
    introduction:
      "I'm **TixXin**, a front-end developer in Shenzhen. I write about Vue, Nuxt and TypeScript in practice, deployment lessons, books and weekend trips.\n\nI try to explain *why*, not just *how*. The blog itself is on [GitHub](https://github.com/TixXin/TixXinBlog).",
  },
  showSiteInfo: true,
  support: {
    visible: true,
    message: '如果某篇文章帮到了你，收藏、分享或留一句话就是最好的支持；也可以在 GitHub 上赞助。',
    messageEn:
      'If a post helped you, bookmarking, sharing or leaving a note is the best support. You can also sponsor on GitHub.',
    methods: [{ label: 'GitHub Sponsors', url: 'https://github.com/sponsors/TixXin', image: '' }],
  },
  sections: [
    {
      kind: 'now',
      visible: true,
      updatedAt: '2026-11-01',
      items: [
        {
          ...item('给博客做关于页和发版脚本', '进行中', '把“现在”“装备与工具”栏目做出来，顺手把发版流程脚本化。'),
          url: 'https://github.com/TixXin/TixXinBlog',
          en: { title: 'Building the About page and release scripts', detail: '', period: 'In progress' },
        },
        {
          ...item('读《置身事内》第二遍', '这个月'),
          en: { title: 'Rereading “置身事内”', detail: '', period: 'This month' },
        },
        item('周末骑行恢复到每周一次', '入秋以后'),
      ],
    },
    {
      kind: 'experience',
      visible: true,
      items: [
        item(
          '高级前端工程师 · 一家做企业服务的公司',
          '2023 - 至今',
          '负责中后台产品的前端架构，主导从 Vue 2 迁到 Vue 3 和 Vite，搭了组件库和前端监控，团队从三个人带到七个人。',
        ),
        item(
          '前端工程师 · 一家电商创业公司',
          '2021 - 2023',
          '做商城小程序、营销活动页和运营后台，第一次接触 SSR 和性能优化，也是在这里开始写这个博客。',
        ),
        item(
          '前端实习生',
          '2020 - 2021',
          '在外包团队写了一年页面，学会了把设计稿还原到像素级，也学会了不在周五下午上线。',
        ),
      ],
    },
    {
      kind: 'skill',
      visible: true,
      items: [
        item('Vue / Nuxt', '5 年', '日常主力，组合式函数、SSR 与水合问题是踩坑最多的地方。'),
        item('TypeScript', '4 年', '类型收窄和泛型约束写得比较多，喜欢让类型替代注释。'),
        item('CSS / SCSS', '6 年', '设计还原、主题变量和动效，容器查询已经在项目里用起来了。'),
        item('Node.js / NestJS', '3 年', '写过博客后端和几个内部工具服务，PostgreSQL 打交道最多。'),
        item('Docker / CI', '3 年', '本地开发环境、GitHub Actions 流水线和小机器上的部署。'),
      ],
    },
    {
      kind: 'interest',
      visible: true,
      items: [
        item('摄影', '', '周末带相机出门，城市夜景和山里的云海拍得最多。'),
        item('骑行', '', '深圳湾到大梅沙，一次五十公里左右。'),
        item('咖啡', '', '在找城市角落里安静的独立咖啡馆。'),
        item('阅读', '', '一年二十多本，技术和非虚构各一半。'),
        item('做饭', '', '从完全不会到能做几道像样的菜。'),
      ],
    },
    {
      kind: 'reading',
      visible: true,
      items: [
        {
          ...item('重构：改善既有代码的设计', 'Martin Fowler', '第三遍，这次对照自己的代码一条条看坏味道。'),
          url: 'https://martinfowler.com/books/refactoring.html',
          en: { title: 'Refactoring: Improving the Design of Existing Code', detail: '', period: '' },
        },
        item('人月神话', 'Frederick Brooks', '“没有银弹”那一章值得每年重读。'),
        item('置身事内', '兰小欢', '读完写了一篇书评，放在随笔日记里。'),
      ],
    },
    {
      kind: 'uses',
      visible: true,
      items: [
        item('MacBook Air', '电脑', '轻，续航够一整天，跑本地开发环境也够用。'),
        {
          ...item('VS Code', '编辑器', 'Vue 官方插件加 ESLint、Prettier，主题用暗色。'),
          url: 'https://code.visualstudio.com/',
        },
        item('Docker Desktop', '开发环境', '本地 PostgreSQL 和发布前的镜像冒烟都靠它。'),
        item('机械键盘', '外设', '茶轴，敲久了手不累。'),
        item('Sony A7M4', '相机', '周末出门的主力机身，图库里大部分照片出自它。'),
      ],
    },
  ],
}

/** 按值比较关于页资料：jsonb 读回时会重排对象键，直接比较 JSON 字符串永远不相等 */
export function sameAbout(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, canonical(item)]),
          )
        : value
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}
