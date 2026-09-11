/** @file operation-config.spec.ts @description 运行开关、显式目标与安全故障分类，不连接外部服务 */
import { readOperationConfig, operationConfigStatus } from './operation-config'
import { classifyMailError } from './task-runner'
describe('运行任务配置', () => {
  it('默认不启动循环、备份或邮件', () => {
    const value = operationConfigStatus(readOperationConfig({}))
    expect(value.workerEnabled).toBe(false)
    expect(value.email.enabled).toBe(false)
    expect(value.email.configured).toBe(false)
    expect(value.backup.enabled).toBe(false)
  })
  it('不允许把显式本机明文通道指向外部 SMTP', () => {
    expect(() =>
      readOperationConfig({ NOTIFICATION_SMTP_HOST: 'smtp.example.com', NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN: 'true' }),
    ).toThrow('本机')
    expect(() => readOperationConfig({ BACKUP_INTERVAL_MINUTES: '0' })).toThrow('BACKUP_INTERVAL_MINUTES')
  })
  it('状态只返回缺失字段名，不返回凭据与目标目录', () => {
    const status = operationConfigStatus(
      readOperationConfig({
        NOTIFICATION_SMTP_PASSWORD: 'secret-marker',
        BACKUP_TRANSFER_TOKEN: 'secret-marker',
        BACKUP_DIRECTORY: 'private-directory',
      }),
    )
    expect(JSON.stringify(status)).not.toContain('secret-marker')
    expect(JSON.stringify(status)).not.toContain('private-directory')
  })
})
describe('SMTP 故障边界', () => {
  it('明确临时拒绝与 DNS 失败可重试，永久拒绝终止', () => {
    expect(classifyMailError({ responseCode: 450 }).state).toBe('retry')
    expect(classifyMailError({ code: 'EDNS' }).state).toBe('retry')
    expect(classifyMailError({ syscall: 'connect' }).state).toBe('retry')
    expect(classifyMailError({ responseCode: 550 }).state).toBe('failed')
  })
  it('即使 command=CONN，也不能把接收后断线自动重投', () => {
    expect(classifyMailError({ code: 'ECONNECTION', command: 'CONN' }).state).toBe('uncertain')
    expect(classifyMailError({ code: 'ETIMEDOUT', command: 'DATA' }).state).toBe('uncertain')
  })
})
