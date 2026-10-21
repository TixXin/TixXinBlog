/** @file maintenance.controller.spec.ts @description 维护诊断与媒体核验控制器委托与权限的单元测试。 */
import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { MaintenanceController } from './maintenance.controller'
import type { MaintenanceService } from './maintenance.service'

describe('MaintenanceController', () => {
  function setup() {
    const maintenanceService = {
      diagnostics: jest.fn(),
      mediaCheck: jest.fn(),
    } as unknown as MaintenanceService
    const controller = new MaintenanceController(maintenanceService)
    return { maintenanceService, controller }
  }

  it('保留管理员守卫', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MaintenanceController)).toContain(AdminAuthGuard)
  })

  it('diagnostics 委托给 maintenanceService 并返回其结果', async () => {
    const { maintenanceService, controller } = setup()
    const mockDiagnostics = {
      checkedAt: '2026-10-21T00:00:00.000Z',
      databaseReachable: true,
      pendingMigrations: 0,
      schemaDrift: false,
      storage: { readable: true, writable: true, cleaned: true },
      mediaRecords: 5,
      contentContextRequired: true,
      runtime: {
        node: process.version,
        nodeSupported: true,
        environment: 'test',
      },
    }
    jest.mocked(maintenanceService.diagnostics).mockResolvedValue(mockDiagnostics)

    const result = await controller.diagnostics()
    expect(result).toBe(mockDiagnostics)
    expect(maintenanceService.diagnostics).toHaveBeenCalledTimes(1)
  })

  it('mediaCheck 委托给 maintenanceService 并传递语言参数', async () => {
    const { maintenanceService, controller } = setup()
    const mockResult = {
      checkedAt: '2026-10-21T00:00:00.000Z',
      checked: 10,
      problems: [],
    }
    jest.mocked(maintenanceService.mediaCheck).mockResolvedValue(mockResult)

    const result = await controller.mediaCheck('en')
    expect(result).toBe(mockResult)
    expect(maintenanceService.mediaCheck).toHaveBeenCalledWith('en')
  })
})
