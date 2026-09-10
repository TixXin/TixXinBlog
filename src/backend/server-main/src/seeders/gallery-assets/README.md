# 图库日常样本图片

这八张自然照片延续原图库演示页面已使用的 Unsplash 图片，保存为本地种子素材，避免日常补种和页面验收依赖外站。它们是必要的业务样本素材，不是截图或测试报告。按 [Unsplash License](https://unsplash.com/license) 使用；来源如下。

| 文件           | 原始来源                                                             | 实际像素    |
| -------------- | -------------------------------------------------------------------- | ----------- |
| ridge.webp     | [山脊](https://images.unsplash.com/photo-1506905925346-21bda4d32df4) | 1000 × 667  |
| night.webp     | [夜景](https://images.unsplash.com/photo-1514565131-fce0801e5785)    | 1000 × 607  |
| pizza.webp     | [披萨](https://images.unsplash.com/photo-1565299624946-b28f40a0ae38) | 1000 × 1208 |
| mist.webp      | [山谷](https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05) | 1000 × 596  |
| skyline.webp   | [城市](https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b) | 1000 × 667  |
| breakfast.webp | [早餐](https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445) | 1000 × 1208 |
| portrait.webp  | [人像](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d) | 1000 × 1500 |
| lake.webp      | [湖泊](https://images.unsplash.com/photo-1501785888041-af3ef285b470) | 1000 × 667  |

原图用 `auto=format&fit=max&w=1000&q=80` 下载，再经 Sharp 自动旋转并转换为 WebP。素材不保留 EXIF。种子仍通过实际媒体上传服务读取宽高与格式，不使用表格代替解码校验。

`gallery-v1` 的手工拍摄日期用于覆盖近期、历史和缺省场景，不声称是这些素材的真实拍摄日期。地点和器材资料未知，全部留空；不会继承原 Mock 中未经验证的中国地名。首次补种后日期保持不变。公开作品的说明只描述可见画面，不加入开发标记。

源素材保留于本目录；运行时图片写入明确配置的 `MEDIA_DIRECTORY`，通过媒体 API 读取。日常补种与隔离测试的媒体目录分开，测试结束只清理隔离目录。文件仍可能被其他作品或业务使用，定向清理只移除确认可清理的数据库索引，保留磁盘文件及备份。

`project-v1` 复用 `ridge.webp`、`mist.webp`、`skyline.webp` 三份素材作为项目封面；它们经过媒体上传服务产生项目数据集独立的媒体编号与归属，不依赖图库数据集先行补种，也不覆盖图库作品或媒体记录。
