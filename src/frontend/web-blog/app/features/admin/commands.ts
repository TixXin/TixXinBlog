/**
 * @file commands.ts
 * @description 后台命令面板的命令清单与匹配：跳转到任一后台页面、快速新建内容；文章按标题由接口搜索，不在此列出。
 *              名称为 admin-system 字典 key，由调用方翻译后再匹配
 * @author TixXin
 * @since 2026-11-06
 */
import { adminNavigation } from './navigation'

export type AdminCommandGroup = 'create' | 'pages' | 'posts'

export interface AdminCommand {
  id: string
  group: AdminCommandGroup
  label: string
  icon: string
  to: string
  /** 匹配时额外参考的关键词（路径、英文名等） */
  keywords?: string
}

/** 快速新建：路径与各模块列表页的“新建”入口一致 */
export const ADMIN_CREATE_COMMANDS = [
  { id: 'create-post', labelKey: 'admin-system.command.create.post', icon: 'lucide:file-plus', to: '/admin/posts/new' },
  {
    id: 'create-moment',
    labelKey: 'admin-system.command.create.moment',
    icon: 'lucide:message-square-plus',
    to: '/admin/moments/new',
  },
  {
    id: 'create-flash',
    labelKey: 'admin-system.command.create.flash',
    icon: 'lucide:lightbulb',
    to: '/admin/flashes?create=true',
  },
  {
    id: 'create-gallery',
    labelKey: 'admin-system.command.create.gallery',
    icon: 'lucide:image-plus',
    to: '/admin/gallery/new',
  },
  {
    id: 'create-project',
    labelKey: 'admin-system.command.create.project',
    icon: 'lucide:folder-plus',
    to: '/admin/projects/new',
  },
  { id: 'create-link', labelKey: 'admin-system.command.create.link', icon: 'lucide:link', to: '/admin/links/new' },
  {
    id: 'create-subscription',
    labelKey: 'admin-system.command.create.subscription',
    icon: 'lucide:credit-card',
    to: '/admin/subscriptions/new',
  },
] as const

/** 全部静态命令（新建在前，页面按导航顺序），名称已翻译 */
export function adminStaticCommands(t: (key: string) => string): AdminCommand[] {
  return [
    ...ADMIN_CREATE_COMMANDS.map((item) => ({
      ...item,
      group: 'create' as const,
      label: t(item.labelKey),
      keywords: item.to,
    })),
    ...adminNavigation.map((item) => ({
      id: `page:${item.path}`,
      group: 'pages' as const,
      label: t(item.labelKey),
      icon: item.icon,
      to: item.path,
      keywords: item.path,
    })),
  ]
}

/** 不区分大小写、忽略空白的子串匹配；空查询返回全部 */
export function matchCommands(commands: AdminCommand[], query: string) {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!needle) return commands
  return commands.filter((command) =>
    `${command.label}${command.keywords ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(needle),
  )
}
