/** @file writing-fixtures.ts @description 创作与关联日常样本：真实来源图片、长文和跨域阅读，不覆盖已编辑内容 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { MediaStorage } from '../modules/media/media-storage'
import type { FixtureProgress } from './fixture-ledger'
import { ensureFixture, fixtureHash, fixtureRow } from './fixture-ledger'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaService } from '../modules/media/media.service'
import { MediaAsset } from '../entities/media-asset.entity'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { ProjectService } from '../modules/project/project.service'
import { GalleryService } from '../modules/gallery/gallery.service'
import type { ContentRelation } from '../common/types/content-relation'

export const WRITING_DATASET = 'writing-v1'
export const WRITING_FIXTURE_COUNT = 7
const chapters = [
  [
    '内容职责',
    '页面负责组织内容，展示组件通过属性接收数据，通过事件报告操作。业务类型和数据访问集中在各自领域，避免主题各自保存一份内容。',
  ],
  [
    '文章提纲',
    '先写下要解决的问题，再按背景、实现和验证组织章节。标题应描述该节具体内容，避免多个含义不明的标题让读者反复寻找。',
  ],
  [
    '正文与摘要',
    '摘要说明文章要回答的问题，正文保留推导过程和验证依据。摘要不应夸大正文没有支持的结论，也不把尚未实现的设想描述为已完成。',
  ],
  [
    '版本比较',
    '保存时核对修订版本，冲突后读取服务器最新资料。只合并当前真正编辑的字段，保留其他标签页独立修改的配置。',
  ],
  [
    '输入恢复',
    '本机恢复副本与服务器内容是不同来源。载入副本前核对账号、内容库和基线，确定哪些内容需要继续编辑，再决定是否保存。',
  ],
  ['不确定提交', '网络超时不代表服务器没有写入。保留稳定提交标识，先核对原结果，避免由于响应丢失再次创建相同内容。'],
  [
    '章节定位',
    '根据当前Markdown解析标题及原始行号。定位只移动选区和滚动位置，不改变正文；代码围栏中的标题文本不会作为正文章节。',
  ],
  [
    '中文输入',
    '输入法合成期间保持编辑器稳定，不重新挂载输入框，也不替换正在合成的文字。章节定位和其他动作应等待合成完成。',
  ],
  [
    '素材检索',
    '文件名、替代文本与说明用于查找图片，横竖构图来自实际像素。使用状态应查询真实引用，不能用手写计数判断图片是否可删除。',
  ],
  [
    '替代文本',
    '替代文本描述图片中与当前内容相关的信息。装饰图与具有内容意义的图片需要分别判断，不把文件名直接当作有用的说明。',
  ],
  [
    '图片来源',
    '第三方图片保留可以核查的来源，未知拍摄地点、设备与时间不补造。受管图片和外部地址分别维护，不用外链冒充媒体库文件。',
  ],
  [
    '媒体引用',
    '当前文章和历史修订都可能使用同一张图片。清理前检查跨业务与历史引用，保留仍被其他内容使用的文件与索引。',
  ],
  [
    '内容关联',
    '关联从当前内容指向目标，顺序由编辑者维护。公开展示时再次判断目标状态，草稿和已删除目标不会泄露到公开阅读路径。',
  ],
  [
    '项目介绍',
    '项目进展与是否公开是独立状态。介绍围绕可核查的实现、技术选择和维护边界，不添加没有来源的用户规模或成果数字。',
  ],
  [
    '图库组织',
    '分类便于浏览，作品说明保留上下文。没有填写的拍摄资料保持缺省，来源转换不应改变作品编号或错误增减媒体引用。',
  ],
  [
    '搜索范围',
    '搜索只读取允许公开的内容。文章正文检索与其他模块检索共同服务发现路径，各类型提供明确总数和分页，部分来源失败时说明实际情况。',
  ],
  [
    '稳定分页',
    '相同时间的记录需要稳定次级排序。页码、筛选条件和返回位置共同构成浏览上下文，不能仅在本页临时保存筛选结果。',
  ],
  [
    '互动审核',
    '审核状态与内容是否可见相互关联。祖先内容隐藏时，公开回复也可能不可见；修改审核状态后需要重新核对列表和统计。',
  ],
  [
    '回复关系',
    '待回复应来自确切的业务规则。没有父回复关系的模块不制造待回复事项，已读通知也不能代替已经审核或回复的事实。',
  ],
  [
    '通知投递',
    '站内通知记录事件和当前业务状态，邮件通过独立队列处理。未配置的通道保持关闭，发送结果不确定时不自动重新投递。',
  ],
  [
    '备份生成',
    '完整备份同时保存数据库一致快照与受管媒体清单。外部图片仅保存地址，不能因为执行备份而访问不受控的远程内容。',
  ],
  [
    '完整性校验',
    '生成文件之后检查清单、摘要和实际图片内容。校验成功说明这一份文件集合保持完整，不能单凭生成成功承诺将来一定恢复。',
  ],
  [
    '恢复演练',
    '使用隔离目标核对数据库和媒体恢复，保留应用读取验证。恢复出的旧通知队列默认暂停，避免历史邮件因队列回放再次发送。',
  ],
  [
    '内容迁入',
    '先预览，再根据目标当前状态确认迁入。来源编号需要映射到目标编号，跳过相同内容和创建副本也必须维护关联方向与排序。',
  ],
  [
    '发布顺序',
    '应用镜像版本、数据库迁移与持久数据需要分别核对。迁移失败时停止后续步骤，应用回退不等于数据库逆迁移或备份恢复。',
  ],
  [
    '运行观察',
    '健康检查、备份记录与存储容量提供不同角度的状态。无法查询时保留未知和失败，不用零计数或固定正常文案掩盖问题。',
  ],
  [
    '性能证据',
    '在同一内容规模和可说明的缓存条件下比较开销。数据库取回量、服务方法耗时和浏览器加载时间是不同指标，结论应与实际测量对应。',
  ],
  [
    '持续整理',
    '维护文档应区分当前能力、未来计划和历史记录。重复逻辑只在语义一致时抽取，业务发布规则和恢复策略仍保留各自边界。',
  ],
] as const
export const writingHandbook =
  '# 博客内容与维护手册\n\n这份手册按日常整理顺序记录内容、创作和维护的核对要点。\n\n' +
  chapters
    .map(
      ([title, detail], index) =>
        `## ${index + 1}. ${title}\n\n${detail}\n\n### 准备资料\n\n整理${title}时，先记录内容身份、当前版本与资料来源。打开相关页面确认已有数据，再决定要修改的范围。已经由博主维护的内容保持原值，不把参考资料直接替换成个人经历。\n\n### 完成后的核对\n\n修改后重新读取实际记录，检查标题、正文、关联目标和公开状态是否一致。返回原入口确认筛选与位置，遇到失败时保留当前输入和具体反馈。若这次操作涉及保存或迁入，使用已有结果确认是否完成，不根据等待时间猜测提交结果。\n\n### 后续维护\n\n把本节涉及的使用入口、数据来源与可恢复方式记录下来。需要撤回内容时，确认公开搜索和相关阅读不再出现它；需要清理资源时，先检查其他内容与历史是否仍然使用。保留可核查的事实，让下一次维护能够理解当时的选择。\n`,
    )
    .join('\n')

// 第二篇长文记录页面与交互的处理过程，与手册互为阅读入口，并保留一条指向草稿的关联用于验证公开过滤。
const practiceSections: readonly (readonly [string, string, string])[] = [
  [
    '首屏与骨架',
    '页面打开时先出现的是结构而不是内容。骨架占位要和真实内容的高度接近，否则数据到达后整页会跳一次，读者正在看的位置被挤走。',
    '把占位高度按真实卡片量了一遍，列表项固定两行标题加一行摘要；图片容器先按比例留白，加载完成再淡入。调整之后翻页时页面不再抖动。',
  ],
  [
    '列表与详情的状态',
    '从列表进入详情再退回来，读者期望回到原来的位置，而不是重新从第一屏开始。',
    '把页码、筛选条件和滚动位置一起当作浏览上下文记录下来，退回时按这份上下文恢复。只在本页内存里保存会在刷新后丢失，所以同时写进地址栏。',
  ],
  [
    '空状态的分寸',
    '没有数据有几种不同的情况：本来就没有、筛选之后没有、以及请求失败。三者如果共用同一句提示，读者无法判断下一步该做什么。',
    '筛选为空时给出清除筛选的入口，本来就没有时说明这里会放什么，请求失败时保留错误原因和重试。空状态不应该假装一切正常。',
  ],
  [
    '表单的反馈时机',
    '校验太早会在还没写完时就报错，太晚又要等到提交才知道哪里不对。',
    '改成离开输入框时校验、提交时整体复核。错误信息放在对应字段下方并与输入框关联，读屏软件能读到；整体错误放在提交按钮附近，不滚动到页面顶部。',
  ],
  [
    '长文的阅读路径',
    '长文章需要知道自己读到哪里，也需要能快速跳到某一节。',
    '目录从正文的标题解析，定位只移动选区和滚动位置，不改写正文。代码块里的井号不当作标题，否则目录会出现读者看不懂的条目。',
  ],
  [
    '图片与布局',
    '配图数量不同，排布方式也不同；一张图、两张图和九张图如果共用一套网格，画面会散。',
    '一张图保持原比例单列展示，两张或四张用两列，三张以上用三列。每种档位都准备了实际数据，改样式时可以直接对照，而不是凭想象。',
  ],
  [
    '关联阅读的方向',
    '关联是从当前内容指向目标，顺序由编辑者维护。目标的状态会变，关联却留在原地。',
    '展示之前重新判断目标是否仍然公开，草稿和已删除的目标不出现在公开阅读路径上。后台仍然看得到这条关联，便于编辑者决定是保留还是移除。',
  ],
  [
    '主题与对比度',
    '三套主题共用同一批内容，颜色换了之后，原本够用的对比度可能不够。',
    '把文字与背景的组合按主题分别核对，弱化文本也要满足最低对比度。不用固定的灰色值，改为各主题自己定义的变量，切换时跟着一起变。',
  ],
  [
    '加载失败的图片',
    '图片地址有效不代表一定能显示，缓存里的失败结果在水合之前就已经发生。',
    '挂载时补查一次缓存状态，发现宽度为零就直接降级成占位图标。错误本身不触发重新加载，避免在失败和重试之间来回循环。',
  ],
  [
    '搜索的结果范围',
    '搜索只读取允许公开的内容，但各个模块的数据形态不同，合并之后容易出现总数对不上的情况。',
    '每类来源各自给出总数和分页，页面按类型分区展示。某一类失败时说明实际情况，保留其他类型的结果，而不是整页报错或把失败当成零条。',
  ],
  [
    '时间的显示口径',
    '带时区的时刻和纯日期是两回事，混在一起显示会出现差一天的问题。',
    '带时区的时刻按本地日历换算，纯日期保持原有的日历含义不做时区转换。断言和展示都按这个口径，测试里也不把期望值写死在某一个时区。',
  ],
  [
    '分页的稳定次序',
    '相同时间的记录如果只按时间排序，两次请求的顺序可能不同，翻页时会看到重复或遗漏。',
    '在时间之外补一个稳定的次级排序字段。翻到第几页、带着什么筛选条件，都写进地址栏，分享出去的链接能还原同一份结果。',
  ],
  [
    '表单的未保存提醒',
    '切换数据来源或离开页面时，正在编辑的内容如果直接丢掉，读者会失去刚写的东西。',
    '有未保存改动时先确认再切换，确认文案说明会保留什么。本机草稿与服务器内容来自不同来源，载入草稿前核对身份和基线，由编辑者决定保留哪一份。',
  ],
  [
    '媒体的引用关系',
    '同一张图片可能被当前内容和历史修订同时使用，只看当前内容会误判它可以删除。',
    '删除前查询真实的引用记录，包括历史版本和跨模块引用。仍被使用的文件保留索引；确实没有引用的保留在媒体库里，作为可清理的候选而不是直接消失。',
  ],
  [
    '接口失败的呈现',
    '接口失败时如果回退到示例数据，页面看起来正常，问题会被一直掩盖下去。',
    '失败就是失败，保留可恢复的错误提示和重试入口。演示数据只在显式开启时使用，不在真实链路里充当兜底，也不伪造空列表或零统计。',
  ],
  [
    '权限与可见性',
    '同一条内容对博主和访客应该呈现不同状态，判断散落在各处容易出现泄露。',
    '公开可见性在读取路径上统一判断，后台视图单独处理。审核中的内容不进入公开搜索，祖先隐藏时后代回复也一并不可见，状态变化后重新核对列表与统计。',
  ],
  [
    '样本与真实数据',
    '开发时手头的数据太少，很多状态根本没有机会出现，问题就留到上线之后才暴露。',
    '按功能的实际状态准备代表样本，覆盖常见情况、分页、关联和边界；需要验证数量级时另外生成可整批清理的容量数据，两者分开管理，不混在一起长期留存。',
  ],
  [
    '留给下次的判断',
    '把处理过程写下来，意义不在于结论，而在于当时为什么排除了另外几种做法。',
    '每一节都保留了当时考虑过但没有采用的方案和原因。过段时间回看，如果条件变了，可以直接从这些被排除的选项里重新挑，而不用从头推一遍。',
  ],
]
export const practiceArticle =
  '# 页面与交互的整理记录\n\n这篇按处理顺序记录页面和交互上做过的调整，每一节保留当时的现象、处理方式和留下的判断。\n\n' +
  practiceSections
    .map(
      ([title, problem, handling], index) =>
        `## ${index + 1}. ${title}\n\n${problem}\n\n### 当时的处理\n\n${handling}\n\n### 核对方式\n\n改动之后重新打开对应页面，按真实数据确认表现是否符合预期。先看常见情况，再逐项检查边界：数据为空时提示有没有说明原因，数量很多时分页和滚动是否稳定，内容很长时布局会不会被撑开，请求失败时有没有保留错误信息和重试入口。确认以实际记录为准，不用截图或印象代替；需要对照数据时直接查当前库里的记录，而不是凭上一次的印象判断。\n\n### 留下的判断\n\n这一节涉及的取舍记录在这里，包括当时考虑过但没有采用的做法，以及排除它们的理由。条件变化时可以回到这些选项重新判断，不必从头推演一遍；如果后来证明当时的判断有误，也能看出是在哪一步出的问题，而不是只剩下一个孤立的结论。记录判断比记录结论更花时间，但回看时真正有用的恰恰是这部分。\n\n### 影响范围\n\n把本节涉及的页面入口、数据来源和影响范围写下来。涉及多个页面共用的组件时，列出所有使用它的位置，改动前逐个确认；涉及接口返回结构时，说明哪些字段是新增的、哪些是语义发生了变化的。后续维护的人需要知道改一处会牵动到哪里，这部分信息如果不写，下一次只能重新梳理一遍。\n`,
    )
    .join('\n')
export async function seedWritingFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const media = new MediaService(em, storage)
  const mediaId = await ensureFixture(
    em,
    WRITING_DATASET,
    'city',
    'media',
    async () => {
      const buffer = await readFile(resolve(__dirname, 'gallery-assets/skyline.webp')),
        id = randomUUID()
      createdMedia.push(id)
      await media.upload(
        { buffer, originalname: 'city-light.webp', mimetype: 'image/webp', size: buffer.length },
        '远处城市建筑与天空',
        id,
      )
      const asset = await em.findOneOrFail(MediaAsset, { id })
      asset.description =
        '来源：Unsplash，https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b；用于整理城市画面，不作为博主拍摄经历。'
      await em.flush()
      return id
    },
    progress,
  )
  if (!mediaId || !(await storage.readIfExists(`${mediaId}.webp`))) {
    progress.unavailable.push(`${WRITING_DATASET}/media/file`)
    return
  }
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const postId = await ensureFixture(
    em,
    WRITING_DATASET,
    'handbook',
    'post',
    async () =>
      (
        await posts.save(
          null,
          Object.assign(new SavePostDto(), {
            title: '博客内容与维护手册',
            summary: '从创作、图片和阅读路径到备份恢复，整理日常维护的核对要点。',
            contentRaw: writingHandbook,
            category: 'tech',
            folder: '博客建设',
            tags: ['内容维护', '工程实践'],
            status: 'published',
          }),
          '整理内容维护手册',
        )
      ).id,
    progress,
  )
  const draftId = await ensureFixture(
    em,
    WRITING_DATASET,
    'writing-notes',
    'post',
    async () =>
      (
        await posts.save(
          null,
          Object.assign(new SavePostDto(), {
            title: '写作流程中的几个边界',
            contentRaw:
              '# 写作流程\n\n## 输入\n\n保留中文合成与撤销记录。\n\n## 保存\n\n使用版本和提交凭据核对结果。\n\n## 阅读\n\n关联只展示允许公开的内容。',
            category: 'tech',
            folder: '博客建设',
            status: 'draft',
            relatedContent: postId ? [{ type: 'post', id: Number(postId) }] : [],
          }),
          '保留写作提纲',
        )
      ).id,
    progress,
  )
  const projectId = await ensureFixture(
    em,
    WRITING_DATASET,
    'content-workspace',
    'project',
    async () =>
      (
        await new ProjectService(em).save(null, {
          title: '博客内容工作台',
          description:
            '围绕TixXinBlog的真实内容组织创作、媒体、阅读入口和维护记录。图片封面来自Unsplash城市素材，来源说明随媒体保留。',
          requestId: randomUUID(),
          status: 'published',
          progress: 'active',
          sortOrder: 0,
          coverMediaId: mediaId,
          tags: [{ label: 'Nuxt', color: 'emerald' }],
          links: [{ kind: 'source', href: 'https://github.com/TixXin/TixXinBlog' }],
          relatedContent: [postId, draftId]
            .filter((id): id is string => !!id)
            .map((id) => ({ type: 'post' as const, id: Number(id) })),
        })
      ).id,
    progress,
  )
  const galleryIds: string[] = []
  for (const [index, title] of ['城市画面的留白', '光线与建筑的层次'].entries()) {
    const id = await ensureFixture(
      em,
      WRITING_DATASET,
      `city-${index}`,
      'gallery',
      async () =>
        (
          await new GalleryService(em).save(null, {
            title,
            description:
              '收录城市与天空的画面。图片来源：Unsplash（https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b），不作为博主原创摄影展示。',
            requestId: randomUUID(),
            mediaId,
            status: index ? 'withdrawn' : 'published',
            category: '城市',
            sortOrder: 0,
            relatedContent: [
              projectId ? { type: 'project', id: Number(projectId) } : null,
              postId ? { type: 'post', id: Number(postId) } : null,
            ].filter((item): item is ContentRelation => !!item),
          })
        ).id,
      progress,
    )
    if (id) galleryIds.push(id)
  }
  // 第二篇长文同时指向手册、草稿与项目：公开路径需要据此过滤掉草稿目标。
  await ensureFixture(
    em,
    WRITING_DATASET,
    'practice',
    'post',
    async () =>
      (
        await posts.save(
          null,
          Object.assign(new SavePostDto(), {
            title: '页面与交互的整理记录',
            summary: '按处理顺序记录页面和交互上做过的调整，保留当时的现象、处理方式与留下的判断。',
            contentRaw: practiceArticle,
            category: 'tech',
            folder: '博客建设',
            tags: ['工程实践', '交互设计'],
            status: 'published',
            relatedContent: [
              postId ? { type: 'post', id: Number(postId) } : null,
              draftId ? { type: 'post', id: Number(draftId) } : null,
              projectId ? { type: 'project', id: Number(projectId) } : null,
            ].filter((item): item is ContentRelation => !!item),
          }),
          '整理页面与交互记录',
        )
      ).id,
    progress,
  )
  // 只完善本次新建长文的反向阅读入口，并在初次种子事务内登记最终指纹。
  const postKey = `${WRITING_DATASET}/post/handbook`
  if (postId && progress.created.includes(postKey)) {
    const current = await posts.detail(Number(postId))
    await posts.save(
      Number(postId),
      Object.assign(new SavePostDto(), current, {
        relatedContent: [
          projectId ? { type: 'project', id: Number(projectId) } : null,
          galleryIds[0] ? { type: 'gallery', id: Number(galleryIds[0]) } : null,
        ].filter((item): item is ContentRelation => !!item),
      }),
      '整理有序关联阅读',
    )
    const ledger = await em.findOneOrFail(DevelopmentFixture, { key: postKey })
    ledger.snapshotHash = fixtureHash((await fixtureRow(em, 'post', postId))!)
    await em.flush()
  }
}
