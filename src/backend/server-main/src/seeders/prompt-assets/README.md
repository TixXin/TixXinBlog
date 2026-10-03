# 图片提示词素材

`dawn-gate.webp`（横幅湖上鸟居）、`ceramic-light.webp`（竖幅陶瓷静物）与 `rain-bookshop.webp`（方形雨夜书店）由本项目通过内置 ImageGen 工具生成，用于灵感图鉴的真实开发样本。完整生成输入保存在 [prompt-content.ts](../prompt-content.ts) 的 `PROMPT_ORIGINALS`，与每张图片逐一对应。工具未返回精确模型版本，模型字段因此只写 `ImageGen`。

原始 PNG 转为 WebP，未裁剪或改变构图。补种通过正常媒体上传服务提取实际宽高，图片随数据库中的媒体引用进入备份。样本不代表博主的真实经历。

其余练习复用 [gallery-assets](../gallery-assets/README.md) 已有且注明 Unsplash 来源的照片；公开说明明确区分「视觉参考」和提示词生成结果，不把摄影图片冒充为生成图。所有素材均保留在仓库，日常补种不依赖外站。

`prompts-v1` 含 13 条公开内容、1 条草稿及 11 张独立归属媒体。重复补种保留用户编辑与已删除归属，不重复创建媒体。
