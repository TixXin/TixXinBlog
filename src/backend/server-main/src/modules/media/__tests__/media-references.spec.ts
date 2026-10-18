/**
 * @file media-references.spec.ts
 * @description 媒体地址识别、引用替换及历史归属保护的单元测试，持久操作全部使用内存模拟。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../../entities/media-asset.entity'
import { MediaReference } from '../../../entities/media-reference.entity'
import { lockMedia, managedMediaIds, mediaUrl, synchronizeMediaReferences } from '../media-references'

const firstId = 'aabbeeff-1234-4567-89ab-0123456789ab'
const secondId = 'bbccddaa-5678-4abc-abcd-abcdef012345'
type Owner = Parameters<typeof synchronizeMediaReferences>[4]
type ReferenceData = Omit<MediaReference, 'id'>

function reference(sourceKey: string, kind: MediaReference['kind'], owner: Owner = {}, id = firstId): ReferenceData {
  return { asset: Object.assign(new MediaAsset(), { id }), sourceKey, kind, ...owner }
}

function fixture(initialReferences: ReferenceData[] = []) {
  const references = [...initialReferences]
  const em = {
    count: jest.fn().mockResolvedValue(1),
    nativeDelete: jest.fn(async (_entity: typeof MediaReference, where: { sourceKey: string }) => {
      const retained = references.filter((item) => item.sourceKey !== where.sourceKey)
      const removedCount = references.length - retained.length
      references.splice(0, references.length, ...retained)
      return removedCount
    }),
    getReference: jest.fn((_entity: typeof MediaAsset, id: string) => Object.assign(new MediaAsset(), { id })),
    create: jest.fn((_entity: typeof MediaReference, data: ReferenceData) => {
      references.push(data)
      return data
    }),
    execute: jest.fn().mockResolvedValue([]),
  }
  return { em, manager: em as unknown as EntityManager, references }
}

describe('受管媒体地址识别', () => {
  it('生成公开 WebP 地址，并从正文、嵌套对象和变体地址中按首次出现顺序去重', () => {
    expect(mediaUrl(firstId)).toBe(`/api/v1/media/${firstId}.webp`)
    expect(
      managedMediaIds([
        `![封面](${mediaUrl(secondId)}?w=320)`,
        { images: [{ url: mediaUrl(firstId) }, { url: mediaUrl(secondId.toUpperCase()) }] },
        `<img src="https://blog.example${mediaUrl(firstId)}#image">`,
      ]),
    ).toEqual([secondId, firstId])
  })

  it.each([
    ['JSON 转义斜杠', mediaUrl(firstId).replaceAll('/', '\\/')],
    ['双重转义斜杠', mediaUrl(firstId).replaceAll('/', '\\\\/')],
    ['一次百分号编码', encodeURIComponent(mediaUrl(firstId))],
    ['两次百分号编码', encodeURIComponent(encodeURIComponent(mediaUrl(firstId)))],
    ['不完整百分号旁的有效地址', `%ZZ%2${encodeURIComponent(mediaUrl(firstId))}`],
  ])('识别%s中的媒体编号', (_label, value) => {
    expect(managedMediaIds([value])).toEqual([firstId])
  })

  it.each(['8', '9', 'a', 'b'])('接受 UUID v4 的 %s 变体并统一为小写', (variant) => {
    const id = `ABCDEFAB-1234-4ABC-${variant}BCD-0123456789AB`
    expect(managedMediaIds([mediaUrl(id)])).toEqual([id.toLowerCase()])
  })

  it.each([
    ['非 v4 UUID', firstId.replace('-4567-', '-3567-')],
    ['非法 UUID 变体', firstId.replace('-89ab-', '-79ab-')],
    ['非十六进制字符', firstId.replace('aabb', 'zzbb')],
    ['过短 UUID', firstId.slice(0, -1)],
    ['过长 UUID', `${firstId}0`],
  ])('不把%s登记为媒体引用', (_label, id) => {
    expect(managedMediaIds([mediaUrl(id)])).toEqual([])
  })

  it('忽略空值、普通外链、裸编号及不支持的路径或扩展名', () => {
    expect(
      managedMediaIds([
        null,
        undefined,
        42,
        false,
        {},
        firstId,
        `https://images.example/${firstId}.webp`,
        `/api/v2/media/${firstId}.webp`,
        `/api/v1/media/${firstId}.png`,
        `/api/v1/media/${firstId}`,
      ]),
    ).toEqual([])
  })
})

describe('媒体引用登记与释放', () => {
  it('先校验全部去重后的活跃媒体，再替换引用，并为每个媒体登记一次', async () => {
    const { em, manager, references } = fixture()
    em.count.mockResolvedValue(2)
    await synchronizeMediaReferences(
      manager,
      'post:7',
      'post',
      [mediaUrl(firstId), mediaUrl(secondId), mediaUrl(firstId)],
      {},
    )

    expect(em.count).toHaveBeenCalledTimes(1)
    expect(em.count).toHaveBeenCalledWith(MediaAsset, { id: { $in: [firstId, secondId] }, deletedAt: null })
    expect(em.nativeDelete).toHaveBeenCalledTimes(1)
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'post:7' })
    expect(em.count.mock.invocationCallOrder[0]).toBeLessThan(em.nativeDelete.mock.invocationCallOrder[0]!)
    expect(em.nativeDelete.mock.invocationCallOrder[0]).toBeLessThan(em.create.mock.invocationCallOrder[0]!)
    expect(em.getReference).toHaveBeenNthCalledWith(1, MediaAsset, firstId)
    expect(em.getReference).toHaveBeenNthCalledWith(2, MediaAsset, secondId)
    expect(em.create).toHaveBeenCalledTimes(2)
    expect(references.map((item) => item.asset.id)).toEqual([firstId, secondId])
  })

  it('活跃媒体查询尚未完成时不能删除旧引用', async () => {
    const old = reference('post:7', 'post')
    const { em, manager, references } = fixture([old])
    let resolveCount!: (value: number) => void
    em.count.mockReturnValue(new Promise<number>((resolve) => (resolveCount = resolve)))

    const pending = synchronizeMediaReferences(manager, 'post:7', 'post', [mediaUrl(secondId)], {})
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
    expect(references).toEqual([old])

    resolveCount(1)
    await pending
    expect(references).toHaveLength(1)
    expect(references[0]?.asset.id).toBe(secondId)
  })

  it.each([0, 1])('两项媒体中只有 %i 项活跃时拒绝写入，保留所有旧引用', async (activeCount) => {
    const old = reference('post:7', 'post')
    const history = reference('revision:7:2', 'revision', { revision: 2 })
    const { em, manager, references } = fixture([old, history])
    em.count.mockResolvedValue(activeCount)

    await expect(
      synchronizeMediaReferences(manager, 'post:7', 'post', [mediaUrl(firstId), mediaUrl(secondId)], {}),
    ).rejects.toMatchObject({ status: 409, message: '内容引用的媒体已移除或不存在，请重新选择图片' })

    expect(references).toEqual([old, history])
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.getReference).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
  })

  it('活跃媒体验证失败时传播原始错误，不动旧引用', async () => {
    const old = reference('post:7', 'post')
    const { em, manager, references } = fixture([old])
    const error = new Error('媒体查询失败')
    em.count.mockRejectedValue(error)

    await expect(synchronizeMediaReferences(manager, 'post:7', 'post', [mediaUrl(secondId)], {})).rejects.toBe(error)
    expect(references).toEqual([old])
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
  })

  it('旧引用删除失败时传播原始错误，不继续登记新引用', async () => {
    const old = reference('post:7', 'post')
    const { em, manager, references } = fixture([old])
    const error = new Error('引用删除失败')
    em.nativeDelete.mockRejectedValue(error)

    await expect(synchronizeMediaReferences(manager, 'post:7', 'post', [mediaUrl(secondId)], {})).rejects.toBe(error)
    expect(references).toEqual([old])
    expect(em.getReference).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
  })

  it('只替换指定 sourceKey，当前换图仍保留同文章历史和其他内容引用', async () => {
    const old = reference('post:7', 'post')
    const history = reference('revision:7:2', 'revision', { revision: 2 })
    const otherPost = reference('post:70', 'post')
    const comment = reference('comment:7', 'comment')
    const { em, manager, references } = fixture([old, history, otherPost, comment])

    await synchronizeMediaReferences(manager, 'post:7', 'post', [mediaUrl(secondId)], {})

    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'post:7' })
    expect(references).toHaveLength(4)
    expect(references.slice(0, 3)).toEqual([history, otherPost, comment])
    expect(references[3]).toMatchObject({ sourceKey: 'post:7', kind: 'post', asset: { id: secondId } })
    expect(references).not.toContain(old)
  })

  it.each([
    { label: '空内容', values: [] },
    { label: '普通外链与空值', values: [null, '', 'https://images.example/photo.webp'] },
  ])('$label不再使用受管媒体时释放自身引用，历史引用仍保留', async ({ values }) => {
    const old = reference('post:7', 'post')
    const history = reference('revision:7:2', 'revision', { revision: 2 })
    const { em, manager, references } = fixture([old, history])

    await synchronizeMediaReferences(manager, 'post:7', 'post', values, {})

    expect(em.count).not.toHaveBeenCalled()
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'post:7' })
    expect(em.getReference).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
    expect(references).toEqual([history])
  })

  const ownerCases: { kind: MediaReference['kind']; owner: Owner }[] = [
    { kind: 'post', owner: { post: { id: 7 } as Owner['post'] } },
    { kind: 'revision', owner: { post: { id: 7 } as Owner['post'], revision: 3 } },
    { kind: 'flash', owner: { flashNote: { id: 'flash-7' } as Owner['flashNote'] } },
    { kind: 'site', owner: {} },
    { kind: 'site-revision', owner: { revision: 4 } },
    { kind: 'comment', owner: { post: { id: 7 } as Owner['post'], comment: { id: 8 } as Owner['comment'] } },
    {
      kind: 'flash-comment',
      owner: {
        flashNote: { id: 'flash-7' } as Owner['flashNote'],
        flashComment: { id: 'flash-comment-8' } as Owner['flashComment'],
      },
    },
    { kind: 'moment', owner: { moment: { id: 'moment-7' } as Owner['moment'] } },
    {
      kind: 'moment-comment',
      owner: {
        moment: { id: 'moment-7' } as Owner['moment'],
        momentComment: { id: 'moment-comment-8' } as Owner['momentComment'],
      },
    },
    { kind: 'guestbook', owner: { guestbookMessage: { id: 7 } as Owner['guestbookMessage'] } },
    { kind: 'gallery', owner: { galleryPhoto: { id: 7 } as Owner['galleryPhoto'] } },
    { kind: 'project', owner: { project: { id: 7 } as Owner['project'] } },
    { kind: 'subscription', owner: { subscription: { id: 7 } as Owner['subscription'] } },
    { kind: 'link', owner: { friendLink: { id: 7 } as Owner['friendLink'] } },
    { kind: 'image-prompt', owner: { imagePrompt: { id: 7 } as Owner['imagePrompt'] } },
  ]

  it.each(ownerCases)('$kind 引用完整保留业务归属与修订号', async ({ kind, owner }) => {
    const { em, manager } = fixture()
    const sourceKey = `${kind}:7`
    await synchronizeMediaReferences(manager, sourceKey, kind, [mediaUrl(firstId)], owner)

    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.create).toHaveBeenCalledWith(MediaReference, {
      asset: em.getReference.mock.results[0]?.value,
      sourceKey,
      kind,
      ...owner,
    })
    const created = em.create.mock.calls[0]?.[1]
    for (const key of Object.keys(owner) as (keyof Owner)[]) expect(created?.[key]).toBe(owner[key])
  })
})

describe('媒体共用事务锁', () => {
  it('通过传入的事务管理器获取固定 advisory 锁', async () => {
    const { em, manager } = fixture()
    await lockMedia(manager)
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(em.nativeDelete).not.toHaveBeenCalled()
  })

  it('锁获取失败时传播原始错误', async () => {
    const { em, manager } = fixture()
    const error = new Error('事务锁失败')
    em.execute.mockRejectedValue(error)
    await expect(lockMedia(manager)).rejects.toBe(error)
  })
})
