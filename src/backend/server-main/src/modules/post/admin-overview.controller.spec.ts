/** @file admin-overview.controller.spec.ts @description 运营工作台控制器委托服务与生成响应时间戳。 */
import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { AdminOverviewController } from './admin-overview.controller'
import type { AdminOverviewData, AdminOverviewService } from './admin-overview.service'

describe('AdminOverviewController', () => {
  it('保留管理员守卫，并调用服务返回结果与生成时间戳', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminOverviewController)).toContain(AdminAuthGuard)

    const mockData: AdminOverviewData = {
      counts: { posts: 10, drafts: 2 },
      recentContent: [
        {
          domain: 'post',
          id: '1',
          title: '测试文章',
          status: 'draft',
          updatedAt: '2026-09-11T00:00:00.000Z',
        },
      ],
      trends: [{ date: '2026-09-11', content: 1, interactions: 0 }],
      unavailable: [],
    }

    const overviewService = {
      getOverview: jest.fn().mockResolvedValue(mockData),
    } as unknown as AdminOverviewService

    const controller = new AdminOverviewController(overviewService)
    const result = await controller.overview()

    expect(overviewService.getOverview).toHaveBeenCalled()
    expect(result).toMatchObject({
      counts: { posts: 10, drafts: 2 },
      recentContent: [
        {
          domain: 'post',
          id: '1',
          title: '测试文章',
          status: 'draft',
          updatedAt: '2026-09-11T00:00:00.000Z',
        },
      ],
      trends: [{ date: '2026-09-11', content: 1, interactions: 0 }],
      unavailable: [],
    })
    expect(typeof result.generatedAt).toBe('string')
    expect(new Date(result.generatedAt).getTime()).not.toBeNaN()
  })
})
