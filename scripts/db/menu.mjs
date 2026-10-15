/** @file menu.mjs @description 开发数据管理菜单的命令目录与参数拼装；只组织既有命令，不自行写库 */

// 条目统一描述一个既有命令：write 表示需要预览和确认，danger 额外要求输入动作名。
export const ENTRIES = [
  { id: 'status', group: '查看', label: '数据库与样本状态', args: () => ['status'] },
  { id: 'check-data', group: '查看', label: '数据覆盖体检（全部域）', args: () => ['check-data'] },
  {
    id: 'check-domain',
    group: '查看',
    label: '按域检查覆盖，可附带搜索词',
    needs: ['domain'],
    optional: ['search'],
    args: ({ domain, search }) => ['check-data', '--domain', domain, ...(search ? ['--search', search] : [])],
  },
  { id: 'list', group: '查看', label: '可用动作、数据集与数据域目录', args: () => ['list'] },
  {
    id: 'seed-dataset',
    group: '补充样本',
    label: '按数据集补充代表样本',
    needs: ['dataset'],
    write: true,
    args: ({ dataset }) => ['seed-data', '--dataset', dataset],
  },
  {
    id: 'seed-all',
    group: '补充样本',
    label: '补充全部数据集',
    write: true,
    args: () => ['seed-data', '--dataset', 'all'],
  },
  { id: 'seed-moments', group: '补充样本', label: '补充朋友圈样本', write: true, args: () => ['seed-moments'] },
  {
    id: 'normalize-samples',
    group: '补充样本',
    label: '规范化历史样本标记',
    write: true,
    args: () => ['normalize-samples'],
  },
  {
    id: 'remove-dataset',
    group: '清理',
    label: '按数据集移除样本',
    needs: ['dataset'],
    write: true,
    args: ({ dataset }) => ['remove-data', '--dataset', dataset],
  },
  { id: 'remove-samples', group: '清理', label: '移除本工具归属的样本', write: true, args: () => ['remove-samples'] },
  { id: 'clear-moments', group: '清理', label: '清空朋友圈样本', write: true, args: () => ['clear-moments'] },
  {
    id: 'clear-content',
    group: '重建',
    label: '清空全部业务内容，保留账号与配置',
    write: true,
    danger: true,
    args: () => ['clear-content'],
  },
  { id: 'reset', group: '重建', label: '重建数据库并重新执行迁移', write: true, danger: true, args: () => ['reset'] },
  {
    id: 'prepare-profile',
    group: '账号与配置',
    label: '准备博主身份与站点资料',
    write: true,
    args: () => ['prepare-profile'],
  },
  {
    id: 'backup-create',
    group: '备份',
    label: '创建完整备份',
    script: 'backup:full',
    args: () => [],
  },
  {
    id: 'backup-verify',
    group: '备份',
    label: '校验已有备份目录',
    script: 'backup:verify',
    needs: ['directory'],
    args: ({ directory }) => ['--directory', directory],
  },
]
export const GROUPS = [...new Set(ENTRIES.map((entry) => entry.group))]
export function findEntry(id) {
  const entry = ENTRIES.find((item) => item.id === id)
  if (!entry) throw new Error(`未知的数据管理条目：${id}；可用：${ENTRIES.map((item) => item.id).join('、')}`)
  return entry
}
/** 把菜单选择翻译成既有命令；缺少必填项时不拼装半成品命令。 */
export function commandFor(id, options = {}) {
  const entry = findEntry(id)
  for (const name of entry.needs ?? [])
    if (typeof options[name] !== 'string' || !options[name].trim()) throw new Error(`条目 ${id} 需要提供 ${name}`)
  const allowed = new Set([...(entry.needs ?? []), ...(entry.optional ?? [])])
  for (const name of Object.keys(options))
    if (options[name] !== undefined && !allowed.has(name)) throw new Error(`条目 ${id} 不接受 ${name}`)
  return {
    id,
    script: entry.script ?? 'db:dev',
    args: entry.args(options),
    write: !!entry.write,
    danger: !!entry.danger,
  }
}
/** 写入在底层仍需 --apply --confirm；菜单只负责把用户输入的数据库名原样带上。 */
export function withConfirmation(command, database) {
  if (!command.write) throw new Error(`条目 ${command.id} 是只读命令，不需要确认参数`)
  if (typeof database !== 'string' || !database.trim()) throw new Error('确认需要输入目标数据库名')
  return { ...command, args: [...command.args, '--apply', '--confirm', database.trim()] }
}
export function describe(command) {
  return `corepack pnpm --filter server-main run ${command.script}${command.args.length ? ' ' + command.args.join(' ') : ''}`
}
