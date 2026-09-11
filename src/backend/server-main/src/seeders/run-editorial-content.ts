/** @file run-editorial-content.ts @description 首发候选唯一维护CLI：默认只读预览，显式迁正与受控子包导出。 */
import { prepareEditorialContent } from './editorial-maintenance'
import { exportEditorialPackage } from './editorial-package'
async function main() {
  const [action = 'status', ...args] = process.argv.slice(2)
  if (!['status', 'refresh', 'export'].includes(action))
    throw new Error(
      '用法：editorial:prepare status | refresh [--apply --confirm 数据库] | export [--output .artifacts内新文件]',
    )
  let apply = false,
    confirm = '',
    output: string | undefined
  for (let index = 0; index < args.length; index++) {
    if (action === 'refresh' && args[index] === '--apply' && !apply) apply = true
    else if (action === 'refresh' && args[index] === '--confirm' && !confirm && args[index + 1])
      confirm = args[++index]!
    else if (action === 'export' && args[index] === '--output' && !output && args[index + 1]) output = args[++index]!
    else throw new Error('首发工具参数不合法；默认status只读，refresh写入需显式确认')
  }
  const result =
    action === 'export' ? await exportEditorialPackage(output) : await prepareEditorialContent(apply, confirm)
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}
void main().catch(() => {
  process.stderr.write('首发候选操作未完成；请核对参数、四候选状态、迁移和新产物路径。没有发布内容或启用外部任务。\n')
  process.exitCode = 1
})
