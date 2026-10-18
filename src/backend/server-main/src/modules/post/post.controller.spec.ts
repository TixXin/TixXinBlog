/** @file post.controller.spec.ts @description 文章导航控制器透传已校验范围并保持上下篇响应 */
import { plainToInstance } from 'class-transformer'
import { QueryPostNavigationDto } from './dto/query-post-navigation.dto'
import { PostController } from './post.controller'
import type { PostDiscoveryService } from './post-discovery.service'
import type { PostService } from './post.service'
import type { PostPreviewService } from './post-preview.service'

describe('文章导航控制器', () => {
  it.each([{}, { scope: 'all' }, { scope: 'folder' }, { scope: 'auto' }])('透传查询 %j', async (input) => {
    const result = { prev: null, next: { id: '6', title: '继续阅读' } }
    const navigation = jest.fn().mockResolvedValue(result)
    const controller = new PostController(
      {} as PostService,
      { navigation } as unknown as PostDiscoveryService,
      {} as PostPreviewService,
    )
    const query = plainToInstance(QueryPostNavigationDto, input)
    expect(await controller.navigation(7, query)).toBe(result)
    expect(navigation).toHaveBeenCalledTimes(1)
    expect(navigation).toHaveBeenCalledWith(7, input.scope ?? 'all')
  })
})
