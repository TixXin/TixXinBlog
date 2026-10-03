/** @file prompt-content.ts @description 提示词样本的可追溯图片、原始生成描述与摄影参考练习 */
export const PROMPT_ORIGINALS = [
  {
    key: 'dawn-gate',
    title: '雾起时，山与水之间',
    description: '让朱红成为青绿色画面里唯一醒目的颜色，用远处的小船交代空间尺度。',
    imageAlt: '晨雾笼罩群山与湖水，朱红鸟居倒映在湖面上',
    tags: ['风景', '电影感'],
    prompt:
      'Use case: stylized-concept. Create one original landscape image for a personal image-prompt collection. A solitary vermilion torii gate in a silver-green mountain lake, seen from a quiet stone shore at dawn. Low mist curls across still water; layered dark teal mountain ridges recede into pale gold sky. A tiny single rowing boat far away gives scale. Contemporary cinematic landscape illustration with realistic water reflections, delicate film grain, painterly atmospheric depth, restrained color. Wide 3:2 horizontal framing, gate on the right third, expansive calm negative space to the left, no people close up, no text, no letters, no logos, no watermark. Only the scene, not a UI or collage.',
  },
  {
    key: 'ceramic-light',
    title: '一枝灯笼果，一整个下午',
    description: '奶油色陶瓷、粗粝石材和透光的果实。用一道斜向窗光，让安静的静物有了时间感。',
    imageAlt: '暖杏色墙前，象牙白陶瓷花瓶与橙色灯笼果立在洞石台上',
    tags: ['静物', '光影'],
    prompt:
      'Use case: product-mockup. Create one original portrait 2:3 still life image for a personal image-prompt collection. A sculptural ivory ceramic vase with one orange physalis branch standing on a rough pale travertine plinth in a peach and warm chalk studio. Late afternoon window light from upper left creates a crisp diagonal shadow across the wall and plinth. Refined tactile editorial product photography; visible subtle ceramic pores, fine stone texture, very restrained matte warm palette, elegant asymmetric composition, generous breathing space, close but not cropped. No text, no letters, no logo, no watermark. Only the scene, not a UI or collage.',
  },
  {
    key: 'rain-bookshop',
    title: '雨停之前，书店还亮着',
    description: '冷蓝街角遇上暖金橱窗，保留水粉纸张的颗粒和铅笔线条，让一间书店成为画面的温度。',
    imageAlt: '雨夜街角的深蓝书店亮着暖黄灯光，门边停着橙色自行车',
    tags: ['插画', '城市'],
    prompt:
      'Use case: illustration-story. Create one original square image for a personal image-prompt collection. A tiny independent bookshop glowing warmly on a rainy indigo city corner at blue hour, viewed at sidewalk height. Dark blue facade, a large arched amber-lit window showing stacks of books, a rust orange bicycle leaned outside, wet pavement with shimmering reflections, deep green leaves above. No readable shop signs. Hand painted gouache editorial illustration, delicate pencil contours, textured cold-press paper, sophisticated midnight blue and burnt amber palette, cinematic intimacy, tranquil atmosphere, intricate but readable silhouettes. No people, no text, no letters, no logos, no watermark. Only the scene, not a UI or collage.',
  },
] as const

// 这些照片是明确署明来源的视觉参考，不冒充由下述练习提示词生成的图片。
const references = [
  [
    'ridge',
    '山脊的明暗层次',
    '风景',
    '1506905925346-21bda4d32df4',
    '以层叠山脊为主体，横向构图，近景岩壁保留清晰纹理，远山逐渐淡入浅灰蓝色空气。云隙光只照亮中段山脊，控制天空高光，保持自然低饱和色调。纪实风景摄影，清晨微冷的空气感，不添加建筑和人物。',
  ],
  [
    'night',
    '把城市留给蓝调时刻',
    '城市',
    '1514565131-fce0801e5785',
    '蓝调时刻的城市天际线，密集窗格透出克制的暖光，建筑形成有秩序的纵向节奏。深蓝天空保留层次，暗部不要压成纯黑。远距离城市摄影，平视机位，清晰而不过度锐化，不添加霓虹文字。',
  ],
  [
    'pizza',
    '刚出炉的温度',
    '静物',
    '1565299624946-b28f40a0ae38',
    '近距离拍摄刚出炉的手工披萨，突出微焦的饼边、融化芝士和新鲜配料。柔和侧光照亮表面，背景简洁，暖色自然，保留食物真实纹理。竖向餐桌构图，浅景深但主体清晰，不出现文字、手和餐厅标志。',
  ],
  [
    'mist',
    '山谷里的慢镜头',
    '风景',
    '1470071459604-3b5ec3a7fe05',
    '薄雾填满起伏山谷，深绿色草坡沿对角线延伸，稀疏树影从雾中露出。宽幅构图，前景深、远景浅，日出前柔软的漫射光，低对比度，安静而辽阔。保留自然植被细节，不添加梦幻光球和过度饱和的颜色。',
  ],
  [
    'skyline',
    '楼宇之间的秩序',
    '城市',
    '1480714378408-67cf0d13bc1b',
    '从较高机位观察密集城市街区，让水平屋顶和竖直窗格构成细密的几何节奏。自然日光，灰白建筑与少量绿色形成简洁配色，画面有纵深，避免超广角夸张畸变。建筑摄影，保留生活细节但不突出广告文字。',
  ],
  [
    'breakfast',
    '早晨的暖色调',
    '静物',
    '1567620905732-2d1ec7ab7445',
    '一份自然摆放的松饼早餐，柔软饼身、果实与少量糖浆形成丰富质地。靠窗自然光，奶油白和蜂蜜色为主，微俯视近景，餐盘边缘留白，竖向构图。食物摄影，避免塑料质感与过强高光。',
  ],
  [
    'portrait',
    '让目光成为主角',
    '摄影',
    '1506794778202-cad84cf45f1d',
    '一位成年男性的自然肖像，正面视线，简单柔和的背景，肩部以上竖向构图。保留皮肤纹理与细小发丝，柔和侧前方光源，眼神清晰，浅景深。沉稳自然的表情，避免过度磨皮、夸张锐化和商业广告标志。',
  ],
  [
    'lake',
    '水面之外还有远方',
    '风景',
    '1501785888041-af3ef285b470',
    '平静湖泊与远山形成水平层次，前景留出水面，让视线自然走向山间。柔和自然日光，青绿湖水，低饱和山体，横向构图，适度空气透视。旅行风景摄影，不添加虚构景点标志。',
  ],
  [
    'ridge',
    '留白让远山更近',
    '摄影',
    '1506905925346-21bda4d32df4',
    '以山脊照片为视觉起点，设计一幅留白充分的风景：山体位于画面下半部，上半部保留柔和云层，浅灰蓝背景和细腻石壁纹理。采用自然光与克制色彩，不添加文字、水印和人物。',
  ],
  [
    'night',
    '夜色里的窗格练习',
    '摄影',
    '1514565131-fce0801e5785',
    '观察城市夜景中明暗窗格的节奏，创作克制的建筑影像。少量暖窗光散布在深蓝建筑立面，保持直线与清晰结构，背景安静。以光点和留白组织画面，不使用霓虹招牌或赛博朋克配色。',
  ],
  [
    'mist',
    '等待另一种山色',
    '风景',
    '1470071459604-3b5ec3a7fe05',
    '以雾中山谷为参考，继续探索草坡、云雾与远山的层次。保持清晨漫射光，绿色自然，前景纹理细腻，远景柔和。横向构图，不添加文字与人造光源。',
  ],
] as const

export const PROMPT_REFERENCES = references.map(([asset, title, tag, source, prompt], index) => ({
  key: `reference-${index}`,
  asset,
  title,
  description: '以摄影作品为视觉参考的提示词练习。配图来自 Unsplash，供观察构图与光线，并非此提示词的生成结果。',
  imageAlt: title,
  tags: [tag, '视觉参考'],
  sourceUrl: `https://images.unsplash.com/photo-${source}`,
  prompt,
  status: index === references.length - 1 ? ('draft' as const) : ('published' as const),
}))
